import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Wanderline API (e2e)', () => {
  let app: INestApplication<App>;
  let directory: string;
  let token: string;
  let adminToken: string;
  const address = 'traveler@example.com';

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'wanderline-test-'));
    process.env.DATA_DIRECTORY = directory;
    process.env.STORAGE_MODE = 'file';
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:9';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_PASSWORD = 'test-admin-password-123';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('serves the seeded catalog', async () => {
    const result = await request(app.getHttpServer())
      .get('/catalog')
      .expect(200);
    expect(result.body.destinations).toHaveLength(6);
    expect(result.body.pois).toHaveLength(18);
  });
  it('registers, authenticates and protects private records', async () => {
    const signup = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test Traveler',
        email: address,
        password: 'test-password-123',
      })
      .expect(201);
    token = signup.body.token;
    expect(signup.body.user.passwordHash).toBeUndefined();
    await request(app.getHttpServer()).get('/bookings').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: address, password: 'wrong' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Other', email: address, password: 'test-password-123' })
      .expect(409);
    await request(app.getHttpServer())
      .get('/admin/bookings')
      .auth(token, { type: 'bearer' })
      .expect(403);
    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'test-admin-password-123' })
      .expect(201);
    adminToken = admin.body.token;
  });
  it('stores inquiries, computes prices on the server and enforces ownership', async () => {
    const date = new Date(Date.now() + 86400000 * 10)
      .toISOString()
      .slice(0, 10);
    await request(app.getHttpServer())
      .post('/bookings')
      .auth(token, { type: 'bearer' })
      .send({
        packageId: 'bali-t1',
        startDate: '2020-01-01',
        guests: 2,
        email: address,
      })
      .expect(400);
    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .auth(token, { type: 'bearer' })
      .send({
        packageId: 'bali-t1',
        startDate: date,
        guests: 2,
        email: address,
        totalEstimate: 1,
      })
      .expect(201);
    expect(booking.body.totalEstimate).toBe(1780);
    const list = await request(app.getHttpServer())
      .get('/bookings')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toHaveLength(1);
    const other = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Other Traveler',
        email: 'other@example.com',
        password: 'test-password-123',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/bookings/${booking.body.id}`)
      .auth(other.body.token, { type: 'bearer' })
      .send({ status: 'CANCELLED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/admin/bookings/${booking.body.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'CONFIRMED' })
      .expect(200);
    const cancel = await request(app.getHttpServer())
      .patch(`/bookings/${booking.body.id}`)
      .auth(token, { type: 'bearer' })
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect(cancel.body.status).toBe('CANCELLED');
  });
  it('allows admin content changes and rejects unknown or unsafe fields', async () => {
    const result = await request(app.getHttpServer())
      .patch('/admin/destinations/bali')
      .auth(adminToken, { type: 'bearer' })
      .send({ tagline: 'A thoughtful escape.', role: 'ADMIN' })
      .expect(200);
    expect(result.body.tagline).toBe('A thoughtful escape.');
    expect(result.body.role).toBeUndefined();
    await request(app.getHttpServer())
      .patch('/admin/destinations/bali')
      .auth(adminToken, { type: 'bearer' })
      .send({ heroImage: 'javascript:alert(1)' })
      .expect(400);
  });
  it('generates valid plans, saves verified places and normalizes submitted estimates', async () => {
    const input = {
      destinationSlug: 'bali',
      days: 5,
      travelers: 2,
      budget: 150,
      pace: 'BALANCED',
      vibes: ['Nature'],
      interests: ['Local food'],
    };
    const generated = await request(app.getHttpServer())
      .post('/planner/generate')
      .send(input)
      .expect(201);
    expect(generated.body.days).toHaveLength(5);
    expect(generated.body.sources.length).toBeGreaterThan(0);
    const plan = {
      ...generated.body,
      estimatedBudget: { currency: 'USD', min: 1, max: 2 },
    };
    const saved = await request(app.getHttpServer())
      .post('/plans')
      .auth(token, { type: 'bearer' })
      .send({ inputJson: input, planJson: plan })
      .expect(201);
    expect(saved.body.planJson.estimatedBudget.min).toBe(1200);
    const date = new Date(Date.now() + 86400000 * 10)
      .toISOString()
      .slice(0, 10);
    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .auth(token, { type: 'bearer' })
      .send({
        planId: saved.body.id,
        guests: 3,
        startDate: date,
        email: address,
      })
      .expect(201);
    expect(booking.body.totalEstimate).toBe(1800);
    const badPlan = structuredClone(generated.body);
    badPlan.days[0].items[0].lat = 80;
    await request(app.getHttpServer())
      .post('/plans')
      .auth(token, { type: 'bearer' })
      .send({ inputJson: input, planJson: badPlan })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/plans/${saved.body.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
  });
  afterAll(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
});
