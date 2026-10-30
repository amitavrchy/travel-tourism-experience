import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StoreService } from './store.service.js';

describe('Durable local storage', () => {
  it('serializes concurrent writes and preserves deletions after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wanderline-store-'));
    const originalDirectory = process.env.DATA_DIRECTORY;
    const originalMode = process.env.STORAGE_MODE;
    process.env.DATA_DIRECTORY = directory;
    process.env.STORAGE_MODE = 'file';
    try {
      const store = new StoreService();
      await store.onModuleInit();
      await Promise.all([
        store.create('bookings', { title: 'First inquiry' }),
        store.create('bookings', { title: 'Second inquiry' }),
      ]);
      await store.remove('destinations', 'bali');
      await store.update('destinations', 'ella', {
        heroImage: '/images/srilanka.jpg',
      });
      await store.onModuleDestroy();
      const restarted = new StoreService();
      await restarted.onModuleInit();
      expect(await restarted.all('bookings')).toHaveLength(2);
      expect((await restarted.find('destinations', 'ella')).heroImage).toBe(
        '/images/srilanka-ella.jpg',
      );
      expect(
        (await restarted.all('destinations')).some((row) => row.id === 'bali'),
      ).toBe(false);
      expect(
        (await restarted.all('pois')).some(
          (row) => row.destinationId === 'bali',
        ),
      ).toBe(false);
      await restarted.onModuleDestroy();
    } finally {
      if (originalDirectory === undefined) delete process.env.DATA_DIRECTORY;
      else process.env.DATA_DIRECTORY = originalDirectory;
      if (originalMode === undefined) delete process.env.STORAGE_MODE;
      else process.env.STORAGE_MODE = originalMode;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
