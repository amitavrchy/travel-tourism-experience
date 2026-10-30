import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type Row = { id: string; [key: string]: unknown };
export type Collection =
  | 'destinations'
  | 'pois'
  | 'experiences'
  | 'packages'
  | 'journal'
  | 'users'
  | 'plans'
  | 'bookings';
type State = Record<Collection, Row[]>;
type Delegate = {
  findMany(): Promise<Row[]>;
  create(args: { data: Row }): Promise<Row>;
  upsert(args: { where: { id: string }; create: Row; update: Partial<Row> }): Promise<Row>;
  update(args: { where: { id: string }; data: Partial<Row> }): Promise<Row>;
  delete(args: { where: { id: string } }): Promise<Row>;
};
const delegates = {
  destinations: 'destination',
  pois: 'poi',
  experiences: 'experience',
  packages: 'tripPackage',
  journal: 'journalPost',
  users: 'user',
  plans: 'tripPlan',
  bookings: 'booking',
} as const;
export const publicCollections: Collection[] = [
  'destinations',
  'pois',
  'experiences',
  'packages',
  'journal',
];

@Injectable()
export class StoreService implements OnModuleInit, OnModuleDestroy {
  private state: State;
  private prisma?: PrismaClient;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly directory = resolve(process.env.DATA_DIRECTORY || '.data');
  private readonly file = resolve(this.directory, 'store.json');

  async onModuleInit() {
    const catalogPath =
      process.env.CATALOG_PATH ||
      (existsSync(resolve('../data/catalog.json'))
        ? resolve('../data/catalog.json')
        : resolve('data/catalog.json'));
    const catalog = JSON.parse(
      await readFile(catalogPath, 'utf8'),
    ) as Partial<State>;
    if (process.env.STORAGE_MODE === 'postgres') {
      this.prisma = new PrismaClient();
      await this.prisma.$connect();
      const seeded = await this.prisma.appState.findUnique({ where: { key: 'catalog-v1' } });
      // A durable marker preserves editorial deletions across API restarts.
      if (!seeded) {
        for (const collection of publicCollections) {
          const existing = await this.all(collection);
          for (const row of catalog[collection] || []) {
            if (!existing.some(item => item.id === row.id || (row.slug && item.slug === row.slug))) {
              await this.delegate(collection).upsert({ where: { id: row.id }, create: row, update: {} });
            }
          }
        }
        await this.prisma.appState.upsert({ where: { key: 'catalog-v1' }, create: { key: 'catalog-v1', value: 'initialized' }, update: {} });
      }
    } else {
      await mkdir(this.directory, { recursive: true });
      try {
        this.state = JSON.parse(await readFile(this.file, 'utf8')) as State;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        this.state = {
          destinations: [],
          pois: [],
          experiences: [],
          packages: [],
          journal: [],
          users: [],
          plans: [],
          bookings: [],
          ...catalog,
        };
        await this.persist(this.state);
      }
    }
  }

  private delegate(collection: Collection): Delegate {
    return (this.prisma as unknown as Record<string, Delegate>)[
      delegates[collection]
    ];
  }

  async all<T extends Row = Row>(collection: Collection): Promise<T[]> {
    if (this.prisma) return (await this.delegate(collection).findMany()) as T[];
    await this.pending;
    return structuredClone(this.state[collection]) as T[];
  }

  async find<T extends Row = Row>(
    collection: Collection,
    id: string,
  ): Promise<T> {
    const row = (await this.all<T>(collection)).find(
      (item) => item.id === id || item.slug === id,
    );
    if (!row) throw new NotFoundException('This item could not be found.');
    return row;
  }

  private async persist(state: State) {
    const temp = `${this.file}.tmp`;
    await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temp, this.file);
  }

  private mutate<T>(action: (state: State) => T): Promise<T> {
    const operation = this.pending.then(async () => {
      const next = structuredClone(this.state);
      const result = action(next);
      await this.persist(next);
      this.state = next;
      return result;
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }

  async create(collection: Collection, input: Partial<Row>): Promise<Row> {
    const row = { ...input, id: input.id || randomUUID() } as Row;
    if (this.prisma) return this.delegate(collection).create({ data: row });
    return this.mutate((state) => {
      if (
        state[collection].some(
          (item) =>
            item.id === row.id ||
            (row.slug && item.slug === row.slug) ||
            (collection === 'users' && item.email === row.email),
        )
      )
        throw new ConflictException('This record already exists.');
      state[collection].push(row);
      return structuredClone(row);
    });
  }

  async update(
    collection: Collection,
    id: string,
    input: Partial<Row>,
  ): Promise<Row> {
    await this.find(collection, id);
    const { id: _id, ...changes } = input;
    if (this.prisma)
      return this.delegate(collection).update({ where: { id }, data: changes });
    return this.mutate((state) => {
      const index = state[collection].findIndex((row) => row.id === id);
      if (
        changes.slug &&
        state[collection].some(
          (row) => row.id !== id && row.slug === changes.slug,
        )
      )
        throw new ConflictException('This slug is already in use.');
      state[collection][index] = { ...state[collection][index], ...changes };
      return structuredClone(state[collection][index]);
    });
  }

  async remove(collection: Collection, id: string): Promise<Row> {
    const row = await this.find(collection, id);
    if (this.prisma) return this.delegate(collection).delete({ where: { id } });
    return this.mutate((state) => {
      state[collection] = state[collection].filter((item) => item.id !== id);
      if (collection === 'destinations') {
        const packageIds = state.packages
          .filter((item) => item.destinationId === id)
          .map((item) => item.id);
        for (const child of ['pois', 'experiences', 'packages'] as Collection[])
          state[child] = state[child].filter(
            (item) => item.destinationId !== id,
          );
        state.bookings.forEach((item) => {
          if (packageIds.includes(String(item.packageId)))
            item.packageId = null;
        });
      }
      if (collection === 'packages')
        state.bookings.forEach((item) => {
          if (item.packageId === id) item.packageId = null;
        });
      return row;
    });
  }

  async onModuleDestroy() {
    await this.pending;
    await this.prisma?.$disconnect();
  }
}
