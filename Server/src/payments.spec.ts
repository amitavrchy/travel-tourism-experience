import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Stripe from 'stripe';
import { PaymentService, type StripeGateway } from './payments.js';
import { StoreService } from './store.service.js';

describe('Verified Stripe payment lifecycle', () => {
  let directory: string;
  let store: StoreService;
  let service: PaymentService;
  let session: Record<string, unknown>;
  const client = {
    checkout: {
      sessions: { create: vi.fn(), retrieve: vi.fn(), expire: vi.fn() },
    },
    paymentIntents: { retrieve: vi.fn() },
    refunds: { create: vi.fn() },
    webhooks: new Stripe('sk_test_unit_only').webhooks,
  };
  const gateway = {
    client,
    enabled: true,
    require: () => client,
    config: () => ({ enabled: true, testMode: true, webhookConfigured: true }),
  };
  const signed = async (type: string, object: unknown) => {
    const payload = JSON.stringify({
      id: 'evt_unit',
      object: 'event',
      type,
      data: { object },
    });
    const signature = client.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_unit_only',
    });
    return service.webhook(Buffer.from(payload), signature);
  };
  const checkout = async () => {
    await store.update('bookings', 'booking-unit', { status: 'CONFIRMED' });
    return service.checkout('booking-unit', 'traveler-unit');
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    directory = await mkdtemp(join(tmpdir(), 'wanderline-payments-'));
    process.env.DATA_DIRECTORY = directory;
    process.env.STORAGE_MODE = 'file';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_only';
    store = new StoreService();
    await store.onModuleInit();
    await store.create('bookings', {
      id: 'booking-unit',
      userId: 'traveler-unit',
      title: 'A thoughtful trip',
      email: 'test@example.com',
      guests: 2,
      startDate: '2027-05-01T00:00:00.000Z',
      totalEstimate: 1780,
      status: 'INQUIRY',
    });
    session = {
      id: 'cs_test_unit',
      url: 'https://checkout.stripe.com/c/pay/cs_test_unit',
      status: 'open',
      payment_status: 'unpaid',
      payment_intent: 'pi_unit',
      metadata: { bookingId: 'booking-unit', userId: 'traveler-unit' },
      client_reference_id: 'booking-unit',
      amount_total: 178000,
      currency: 'usd',
      livemode: false,
    };
    client.checkout.sessions.create.mockImplementation(async () =>
      structuredClone(session),
    );
    client.checkout.sessions.retrieve.mockImplementation(async () =>
      structuredClone(session),
    );
    client.checkout.sessions.expire.mockImplementation(async () => {
      session.status = 'expired';
      return session;
    });
    client.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_unit',
      status: 'succeeded',
      amount_received: 178000,
      currency: 'usd',
      latest_charge: {
        receipt_url: 'https://pay.stripe.com/receipts/test-receipt',
      },
    });
    client.refunds.create.mockResolvedValue({
      id: 're_unit',
      status: 'succeeded',
      amount: 178000,
    });
    service = new PaymentService(store, gateway as unknown as StripeGateway);
  });
  afterEach(async () => {
    await store.onModuleDestroy();
    await rm(directory, { recursive: true, force: true });
    delete process.env.DATA_DIRECTORY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
  it('requires team approval and ownership; repeated clicks reuse one checkout', async () => {
    await expect(
      service.checkout('booking-unit', 'traveler-unit'),
    ).rejects.toThrow('approve');
    await expect(
      service.checkout('booking-unit', 'someone-else'),
    ).rejects.toThrow('own bookings');
    await checkout();
    await service.checkout('booking-unit', 'traveler-unit');
    expect(client.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(
      client.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data
        .unit_amount,
    ).toBe(178000);
    expect(
      client.checkout.sessions.create.mock.calls[0][1].idempotencyKey,
    ).toBe('wanderline-checkout-booking-unit-0');
    expect(await store.all('payments')).toHaveLength(1);
  });
  it('does not trust a return URL or unpaid checkout; verifies Stripe and the received amount', async () => {
    await checkout();
    session.status = 'complete';
    expect(
      (await service.reconcile('cs_test_unit', 'traveler-unit')).payment.status,
    ).toBe('PROCESSING');
    session.payment_status = 'paid';
    client.paymentIntents.retrieve.mockResolvedValueOnce({
      status: 'succeeded',
      amount_received: 1,
      currency: 'usd',
    });
    await expect(
      service.reconcile('cs_test_unit', 'traveler-unit'),
    ).rejects.toThrow('fully received');
    expect((await store.find('payments', 'cs_test_unit')).status).toBe(
      'PROCESSING',
    );
    const verified = await service.reconcile('cs_test_unit', 'traveler-unit');
    expect(verified.payment.status).toBe('PAID');
    expect(verified.payment.receiptUrl).toContain('receipts');
    await expect(
      service.reconcile('cs_test_unit', 'someone-else'),
    ).rejects.toThrow('not yours');
  });
  it('rejects altered totals, currency, ownership metadata and invalid webhook signatures', async () => {
    await checkout();
    session.status = 'complete';
    session.payment_status = 'paid';
    session.amount_total = 50;
    await expect(
      service.reconcile('cs_test_unit', 'traveler-unit'),
    ).rejects.toThrow('do not match');
    session.amount_total = 178000;
    session.currency = 'eur';
    await expect(
      service.reconcile('cs_test_unit', 'traveler-unit'),
    ).rejects.toThrow('do not match');
    await expect(
      service.webhook(Buffer.from('{}'), 'forged-signature'),
    ).rejects.toThrow('Invalid Stripe signature');
    expect((await store.find('payments', 'cs_test_unit')).status).toBe(
      'PENDING',
    );
  });
  it('accepts signed events and prevents duplicate or out-of-order events from reversing payment', async () => {
    await checkout();
    session.status = 'complete';
    session.payment_status = 'paid';
    await signed('checkout.session.completed', session);
    await signed('checkout.session.completed', session);
    await signed('checkout.session.async_payment_failed', session);
    await signed('checkout.session.expired', session);
    expect((await store.find('payments', 'cs_test_unit')).status).toBe('PAID');
    await expect(
      service.checkout('booking-unit', 'traveler-unit'),
    ).rejects.toThrow('already been paid');
  });
  it('expires open checkout links before a traveler cancels', async () => {
    await checkout();
    await service.cancel('booking-unit', 'traveler-unit');
    expect(client.checkout.sessions.expire).toHaveBeenCalledWith(
      'cs_test_unit',
    );
    expect((await store.find('bookings', 'booking-unit')).status).toBe(
      'CANCELLED',
    );
    expect((await store.find('payments', 'cs_test_unit')).status).toBe(
      'EXPIRED',
    );
  });
  it('records late paid cancellations for refund review and refunds exactly once', async () => {
    await checkout();
    session.status = 'complete';
    session.payment_status = 'paid';
    await service.cancel('booking-unit', 'traveler-unit');
    expect((await service.operations()).bookings[0].payment?.status).toBe(
      'PAID',
    );
    await service.refund('cs_test_unit');
    await service.refund('cs_test_unit');
    expect(client.refunds.create).toHaveBeenCalledTimes(1);
    expect(client.refunds.create.mock.calls[0][1].idempotencyKey).toBe(
      'wanderline-refund-cs_test_unit',
    );
    expect((await store.find('payments', 'cs_test_unit')).status).toBe(
      'REFUNDED',
    );
    await signed('checkout.session.completed', session);
    expect((await store.find('payments', 'cs_test_unit')).status).toBe(
      'REFUNDED',
    );
  });
  it('includes an earlier partial refund when refunding the remaining balance', async () => {
    await checkout();
    session.status = 'complete';
    session.payment_status = 'paid';
    await service.reconcile('cs_test_unit', 'traveler-unit');
    await store.update('payments', 'cs_test_unit', {
      refundedAmountCents: 10000,
    });
    client.refunds.create.mockResolvedValueOnce({
      id: 're_remaining',
      status: 'succeeded',
      amount: 168000,
    });
    const refunded = await service.refund('cs_test_unit');
    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.refundedAmountCents).toBe(178000);
  });
  it('expires a session if the booking is cancelled while Stripe creates checkout', async () => {
    client.checkout.sessions.create.mockImplementationOnce(async () => {
      await store.update('bookings', 'booking-unit', { status: 'CANCELLED' });
      return structuredClone(session);
    });
    await expect(checkout()).rejects.toThrow('changed while checkout');
    expect(client.checkout.sessions.expire).toHaveBeenCalledWith(
      'cs_test_unit',
    );
    expect((await store.find('payments', 'cs_test_unit')).status).toBe(
      'EXPIRED',
    );
  });
});
