import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
  AdminGuard,
  AuthService,
  type AuthRequest,
} from './auth.js';
import {
  publicCollections,
  StoreService,
  type Collection,
  type Row,
} from './store.service.js';
import {
  email,
  futureDate,
  number,
  object,
  strings,
  text,
} from './validation.js';
import { validateInput } from './planner.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() body: unknown) {
    return this.auth.register(object(body));
  }
  @Post('login') login(@Body() body: unknown) {
    return this.auth.login(object(body));
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() request: AuthRequest) {
    return request.user;
  }
}

@Controller()
export class CatalogController {
  constructor(private readonly store: StoreService) {}
  @Get('health') health() {
    return {
      status: 'ok',
      service: 'wanderline-api',
      storage: process.env.STORAGE_MODE === 'postgres' ? 'postgres' : 'file',
    };
  }
  @Get('catalog') async catalog() {
    return Object.fromEntries(
      await Promise.all(
        publicCollections.map(async (name) => [
          name,
          await this.store.all(name),
        ]),
      ),
    );
  }
  @Get(':collection') async list(
    @Param('collection') name: string,
    @Query('q') q?: string,
    @Query('destinationId') destinationId?: string,
  ) {
    if (!publicCollections.includes(name as Collection))
      throw new BadRequestException('Unknown collection.');
    const rows = await this.store.all(name as Collection);
    return rows.filter(
      (row) =>
        (!destinationId || row.destinationId === destinationId) &&
        (!q || JSON.stringify(row).toLowerCase().includes(q.toLowerCase())),
    );
  }
  @Get(':collection/:id') async detail(
    @Param('collection') name: string,
    @Param('id') id: string,
  ) {
    if (!publicCollections.includes(name as Collection))
      throw new BadRequestException('Unknown collection.');
    return this.store.find(name as Collection, id);
  }
}

@Controller()
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly store: StoreService) {}
  @Get('bookings') async bookings(@Req() request: AuthRequest) {
    return (await this.store.all('bookings'))
      .filter((row) => row.userId === request.user.id)
      .reverse();
  }
  @Post('bookings') async book(
    @Body() value: unknown,
    @Req() request: AuthRequest,
  ) {
    const body = object(value);
    const startDate = futureDate(body.startDate);
    const guests = number(body.guests, 'Guests', 1, 12);
    const address = email(body.email);
    let title: string;
    let totalEstimate: number;
    let packageId: string | undefined;
    let planId: string | undefined;
    if (body.packageId) {
      const trip = await this.store.find(
        'packages',
        text(body.packageId, 'Trip'),
      );
      packageId = trip.id;
      title = String(trip.title);
      totalEstimate = Number(trip.priceFrom) * guests;
    } else if (body.planId) {
      const plan = await this.store.find('plans', text(body.planId, 'Plan'));
      if (plan.userId !== request.user.id)
        throw new BadRequestException('Choose one of your saved plans.');
      planId = plan.id;
      title = String(plan.title);
      const input = plan.inputJson as { days: number; budget: number };
      totalEstimate = Math.round(input.days * input.budget * .8 * guests);
    } else throw new BadRequestException('Choose a trip or a saved plan.');
    return this.store.create('bookings', {
      userId: request.user.id,
      packageId,
      planId,
      title,
      email: address,
      startDate,
      guests,
      totalEstimate,
      status: 'INQUIRY',
      notes: body.notes ? text(body.notes, 'Notes', 1, 2000) : '',
      createdAt: new Date().toISOString(),
    });
  }
  @Patch('bookings/:id') async cancel(
    @Param('id') id: string,
    @Req() request: AuthRequest,
    @Body() body: unknown,
  ) {
    const booking = await this.store.find('bookings', id);
    if (
      booking.userId !== request.user.id ||
      object(body).status !== 'CANCELLED'
    )
      throw new BadRequestException('This inquiry cannot be changed.');
    return this.store.update('bookings', id, { status: 'CANCELLED' });
  }
  @Get('plans') async plans(@Req() request: AuthRequest) {
    return (await this.store.all('plans'))
      .filter((row) => row.userId === request.user.id)
      .reverse();
  }
  @Post('plans') async savePlan(
    @Body() value: unknown,
    @Req() request: AuthRequest,
  ) {
    const body = object(value);
    const plan = object(body.planJson);
    const input = validateInput(body.inputJson);
    const destination = await this.store.find('destinations', input.destinationSlug);
    const pois = (await this.store.all('pois')).filter(row => row.destinationId === destination.id);
    const experiences = (await this.store.all('experiences')).filter(row => row.destinationId === destination.id);
    const title = text(plan.title, 'Title', 2, 160);
    if (
      !Array.isArray(plan.days) ||
      plan.days.length !== input.days
    )
      throw new BadRequestException('The plan must match the requested number of days.');
    for (const [index, dayValue] of plan.days.entries()) {
      const day = object(dayValue);
      if (number(day.day, 'Day', 1, 14) !== index + 1) throw new BadRequestException('Itinerary days must be sequential.');
      text(day.theme, 'Day theme', 1, 300);
      if (
        !Array.isArray(day.items) ||
        day.items.length < 1 ||
        day.items.length > 12
      )
        throw new BadRequestException('Each day needs itinerary items.');
      for (const itemValue of day.items) {
        const item = object(itemValue);
        text(item.title, 'Activity', 1, 300);
        text(item.time, 'Time', 5, 5);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(item.time))) throw new BadRequestException('Use a valid activity time.');
        if (!['poi','experience','meal','transit'].includes(String(item.type))) throw new BadRequestException('Choose a valid activity type.');
        if (typeof item.notes !== 'string' || item.notes.length > 2000) throw new BadRequestException('Activity notes must be under 2,000 characters.');
        number(item.lat, 'Latitude', -90, 90, false);
        number(item.lng, 'Longitude', -180, 180, false);
        if (item.type === 'poi') {
          const poi = pois.find(row => row.id === item.sourceId);
          if (!poi || poi.name !== item.title || Math.abs(Number(poi.lat) - Number(item.lat)) > .005 || Math.abs(Number(poi.lng) - Number(item.lng)) > .005) throw new BadRequestException('Choose a verified destination place for this activity.');
        }
        if (item.type === 'experience' && !experiences.some(row => row.id === item.sourceId && row.title === item.title)) throw new BadRequestException('Choose a verified destination experience.');
      }
    }
    const budget = object(plan.estimatedBudget);
    number(budget.min, 'Budget', 0, 10000000, false);
    number(budget.max, 'Budget', Number(budget.min), 10000000, false);
    const total = input.days * input.travelers * input.budget;
    plan.estimatedBudget = { currency: 'USD', min: Math.round(total * .8), max: Math.round(total * 1.2) };
    plan.tips = strings(plan.tips, 'Travel tips', 1000);
    if (!['ai','curated'].includes(String(plan.mode))) throw new BadRequestException('This plan needs a valid generation mode.');
    plan.sources = [{ id: destination.id, title: destination.name, text: destination.embedText }, ...pois.map(row => ({ id: row.id, title: row.name, text: row.description })), ...experiences.map(row => ({ id: row.id, title: row.title, text: row.summary }))];
    return this.store.create('plans', {
      userId: request.user.id,
      title,
      inputJson: input,
      planJson: plan,
      createdAt: new Date().toISOString(),
    });
  }
  @Patch('plans/:id') async updatePlan(
    @Param('id') id: string,
    @Body() value: unknown,
    @Req() request: AuthRequest,
  ) {
    const row = await this.store.find('plans', id);
    if (row.userId !== request.user.id)
      throw new BadRequestException('This plan is not yours.');
    return this.store.update('plans', id, {
      title: text(object(value).title, 'Title', 2, 160),
    });
  }
  @Delete('plans/:id') async deletePlan(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    const row = await this.store.find('plans', id);
    if (row.userId !== request.user.id)
      throw new BadRequestException('This plan is not yours.');
    return this.store.remove('plans', id);
  }
}

const fields: Record<
  string,
  { texts: string[]; numbers: string[]; arrays?: string[]; json?: string[] }
> = {
  destinations: {
    texts: [
      'slug',
      'name',
      'country',
      'region',
      'tagline',
      'description',
      'heroImage',
      'embedText',
      'color',
      'reading',
      'bestSeason',
      'timezone',
    ],
    numbers: ['lat', 'lng', 'startingPrice'],
    arrays: ['tags', 'bestMonths'],
  },
  pois: {
    texts: ['destinationId', 'name', 'kind', 'description'],
    numbers: ['lat', 'lng'],
  },
  experiences: {
    texts: [
      'destinationId',
      'slug',
      'title',
      'summary',
      'difficulty',
      'imageUrl',
    ],
    numbers: ['durationHours', 'priceFrom'],
  },
  packages: {
    texts: ['destinationId', 'slug', 'title', 'heroImage', 'label'],
    numbers: ['days', 'priceFrom'],
    json: ['itineraryJson'],
  },
  journal: {
    texts: [
      'slug',
      'title',
      'excerpt',
      'category',
      'body',
      'coverImage',
      'publishedAt',
    ],
    numbers: ['readMinutes'],
  },
};

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly store: StoreService) {}
  @Get(':collection') list(@Param('collection') name: string) {
    return this.store.all(this.collection(name));
  }
  private collection(name: string): Collection {
    if (![...publicCollections, 'bookings'].includes(name as Collection))
      throw new BadRequestException('Unknown collection.');
    return name as Collection;
  }
  private async validate(name: string, value: unknown, partial: boolean) {
    const body = object(value);
    const schema = fields[name];
    if (!schema) {
      if (!['INQUIRY', 'CONFIRMED', 'CANCELLED'].includes(String(body.status)))
        throw new BadRequestException('Choose a valid booking status.');
      return { status: body.status } as Partial<Row>;
    }
    const result: Partial<Row> = {};
    for (const field of schema.texts)
      if (!partial || body[field] !== undefined)
        result[field] = text(
          body[field],
          field,
          1,
          field === 'body' || field === 'embedText' || field === 'description'
            ? 20000
            : 1000,
        );
    for (const field of schema.numbers)
      if (!partial || body[field] !== undefined)
        result[field] = number(
          body[field],
          field,
          field === 'lat'
            ? -90
            : field === 'lng'
              ? -180
              : field === 'days' || field === 'readMinutes'
                ? 1
                : 0,
          field === 'lat'
            ? 90
            : field === 'lng'
              ? 180
              : field === 'days'
                ? 14
                : 100000,
          field === 'days' || field === 'readMinutes',
        );
    for (const field of schema.arrays || [])
      if (!partial || body[field] !== undefined) {
        if (field === 'bestMonths') {
          if (
            !Array.isArray(body[field]) ||
            (body[field] as unknown[]).length > 12
          )
            throw new BadRequestException('bestMonths must be a list.');
          result[field] = (body[field] as unknown[]).map((item) =>
            number(item, 'Month', 1, 12),
          );
        } else result[field] = strings(body[field], field);
      }
    for (const field of schema.json || [])
      if (!partial || body[field] !== undefined) {
        if (!Array.isArray(body[field]) || !(body[field] as unknown[]).length || (body[field] as unknown[]).length > 14)
          throw new BadRequestException(`${field} must be a nonempty list.`);
        result[field] = (body[field] as unknown[]).map((value, index) => {
          const day = object(value);
          if (number(day.day, 'Day', 1, 14) !== index + 1) throw new BadRequestException('Journey days must be sequential.');
          return { day: index + 1, theme: text(day.theme, 'Day theme', 1, 300), description: text(day.description, 'Day description', 1, 4000) };
        });
        if (body.days !== undefined && (result[field] as unknown[]).length !== body.days) throw new BadRequestException('The itinerary must match the journey length.');
      }
    if (result.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(result.slug)))
      throw new BadRequestException('Use a lowercase, hyphen-separated slug.');
    for (const field of ['heroImage', 'imageUrl', 'coverImage'])
      if (
        result[field] &&
        !/^\/images\/[a-zA-Z0-9._-]+$/.test(String(result[field]))
      )
        throw new BadRequestException('Choose a local /images/ image path.');
    if (result.destinationId)
      await this.store.find('destinations', String(result.destinationId));
    if (
      result.publishedAt &&
      Number.isNaN(Date.parse(String(result.publishedAt)))
    )
      throw new BadRequestException('Invalid publication date.');
    return result;
  }
  @Post(':collection') async create(
    @Param('collection') name: string,
    @Body() body: unknown,
  ) {
    if (this.collection(name) === 'bookings')
      throw new BadRequestException('Bookings are created by travelers.');
    return this.store.create(
      name as Collection,
      await this.validate(name, body, false),
    );
  }
  @Patch(':collection/:id') async update(
    @Param('collection') name: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.store.update(
      this.collection(name),
      id,
      await this.validate(name, body, true),
    );
  }
  @Delete(':collection/:id') remove(
    @Param('collection') name: string,
    @Param('id') id: string,
  ) {
    if (this.collection(name) === 'bookings')
      throw new BadRequestException(
        'Change an inquiry’s status instead of deleting it.',
      );
    return this.store.remove(name as Collection, id);
  }
}
