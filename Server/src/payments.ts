import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { AuthGuard, AdminGuard, type AuthRequest } from './auth.js';
import { StoreService, type Row } from './store.service.js';
import { object, text } from './validation.js';

export type PaymentRow = Row & {
  bookingId: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: string;
  paymentIntentId?: string;
  checkoutUrl: string;
  receiptUrl?: string;
  refundId?: string;
  refundedAmountCents: number;
  livemode: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class StripeGateway {
  readonly enabled = !!process.env.STRIPE_SECRET_KEY;
  readonly livemode =
    process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') || false;
  readonly client = new Stripe(
    process.env.STRIPE_SECRET_KEY || 'sk_test_not_configured',
    { maxNetworkRetries: 2, timeout: 20000 },
  );
  config() {
    return {
      enabled: this.enabled,
      testMode: !this.livemode,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    };
  }
  require() {
    if (!this.enabled)
      throw new ServiceUnavailableException(
        'Secure payments are not configured yet. Your inquiry is safely stored.',
      );
    if (this.livemode && !process.env.STRIPE_WEBHOOK_SECRET)
      throw new ServiceUnavailableException(
        'Live payments require verified webhook configuration. Please contact the travel team.',
      );
    return this.client;
  }
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly store: StoreService,
    private readonly gateway: StripeGateway,
  ) {}
  config() {
    return this.gateway.config();
  }
  async attach(
    bookings: Row[],
  ): Promise<(Row & { payment: PaymentRow | null })[]> {
    const payments = await this.store.all<PaymentRow>('payments');
    return bookings.map((booking) => {
      const related = payments
        .filter((p) => p.bookingId === booking.id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const payment =
        related.find((p) =>
          ['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(p.status),
        ) ||
        related[0] ||
        null;
      return { ...booking, payment };
    });
  }
  private async ownedBooking(id: string, userId: string) {
    const booking = await this.store.find('bookings', id);
    if (booking.userId !== userId)
      throw new BadRequestException('Choose one of your own bookings.');
    return booking;
  }
  async checkout(bookingId: string, userId: string) {
    const stripe = this.gateway.require();
    const booking = await this.ownedBooking(bookingId, userId);
    if (
      new Date(String(booking.startDate)).toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10)
    )
      throw new BadRequestException(
        'This departure date has passed. Please create a new inquiry.',
      );
    if (booking.status !== 'CONFIRMED')
      throw new ConflictException(
        'Our team needs to approve your dates and price before payment.',
      );
    const attempts = (await this.store.all<PaymentRow>('payments')).filter(
      (p) => p.bookingId === bookingId,
    );
    if (
      attempts.some((p) =>
        ['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(p.status),
      )
    )
      throw new ConflictException('This booking has already been paid.');
    for (const payment of attempts.filter((p) =>
      ['PENDING', 'PROCESSING'].includes(p.status),
    )) {
      const session = await stripe.checkout.sessions.retrieve(payment.id);
      if (session.payment_status === 'paid') {
        await this.fulfill(session);
        throw new ConflictException(
          'Your payment is already received. Refresh your journeys to see it.',
        );
      }
      if (session.status === 'open' && session.url)
        return {
          url: session.url,
          sessionId: session.id,
          testMode: !session.livemode,
        };
      if (session.status === 'complete')
        throw new ConflictException(
          'Your payment is still processing. Please wait for confirmation.',
        );
      await this.store.transitionPayment(
        payment.id,
        { status: 'EXPIRED', updatedAt: new Date().toISOString() },
        ['PENDING'],
      );
    }
    const amountCents = Math.round(Number(booking.totalEstimate) * 100);
    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents < 50 ||
      amountCents > 99999999
    )
      throw new BadRequestException(
        'The approved booking total cannot be charged. Contact the travel team.',
      );
    const origin = (
      process.env.CLIENT_ORIGIN || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: String(booking.email),
        client_reference_id: booking.id,
        metadata: { bookingId, userId },
        payment_intent_data: { metadata: { bookingId, userId } },
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              product_data: {
                name: String(booking.title),
                description: `${booking.guests} traveler(s) · Departure ${String(booking.startDate).slice(0, 10)} · WL-${booking.id.slice(0, 8).toUpperCase()}`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/payments/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payments/return?cancelled=1&booking=${encodeURIComponent(bookingId)}`,
      },
      {
        idempotencyKey: `wanderline-checkout-${booking.id}-${attempts.length}`,
      },
    );
    if (!session.url)
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout link. Please try again.',
      );
    const now = new Date().toISOString();
    try {
      await this.store.create('payments', {
        id: session.id,
        bookingId,
        userId,
        amountCents,
        currency: 'usd',
        status: 'PENDING',
        checkoutUrl: session.url,
        refundedAmountCents: 0,
        livemode: session.livemode,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      // Simultaneous requests share the Stripe idempotency key and stored session.
      const existing = (await this.store.all('payments')).find(
        (row) => row.id === session.id,
      );
      if (!existing) throw error;
    }
    if ((await this.store.find('bookings', bookingId)).status !== 'CONFIRMED') {
      await stripe.checkout.sessions.expire(session.id);
      await this.store.transitionPayment(
        session.id,
        { status: 'EXPIRED', updatedAt: new Date().toISOString() },
        ['PENDING'],
      );
      throw new ConflictException(
        'This booking changed while checkout was opening. Please refresh your journeys.',
      );
    }
    return {
      url: session.url,
      sessionId: session.id,
      testMode: !session.livemode,
    };
  }
  private async fulfill(session: Stripe.Checkout.Session) {
    const payment = await this.store.find<PaymentRow>('payments', session.id);
    if (
      session.metadata?.bookingId !== payment.bookingId ||
      session.metadata?.userId !== payment.userId ||
      session.client_reference_id !== payment.bookingId ||
      session.amount_total !== payment.amountCents ||
      session.currency !== payment.currency ||
      session.livemode !== payment.livemode
    )
      throw new BadRequestException(
        'Payment details do not match this booking.',
      );
    if (session.payment_status !== 'paid') {
      if (session.status === 'complete')
        return this.store.transitionPayment(
          payment.id,
          { status: 'PROCESSING', updatedAt: new Date().toISOString() },
          ['PENDING'],
        );
      return payment;
    }
    const intentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intentId)
      throw new BadRequestException(
        'Stripe has not provided a completed payment.',
      );
    const intent = await this.gateway
      .require()
      .paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
    if (
      intent.status !== 'succeeded' ||
      intent.amount_received !== payment.amountCents ||
      intent.currency !== payment.currency
    )
      throw new BadRequestException('This payment is not yet fully received.');
    const charge =
      typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    return this.store.transitionPayment(
      payment.id,
      {
        status: 'PAID',
        paymentIntentId: intentId,
        receiptUrl: charge?.receipt_url || undefined,
        updatedAt: new Date().toISOString(),
      },
      ['PENDING', 'PROCESSING', 'EXPIRED', 'FAILED', 'PAID'],
    );
  }
  async reconcile(sessionId: string, userId: string) {
    const payment = await this.store.find<PaymentRow>('payments', sessionId);
    if (payment.userId !== userId)
      throw new BadRequestException('This checkout is not yours.');
    const session = await this.gateway
      .require()
      .checkout.sessions.retrieve(sessionId);
    if (!['REFUNDED', 'REFUND_PENDING'].includes(payment.status)) {
      if (session.status === 'expired')
        await this.store.transitionPayment(
          payment.id,
          { status: 'EXPIRED', updatedAt: new Date().toISOString() },
          ['PENDING'],
        );
      else await this.fulfill(session);
    }
    return {
      payment: await this.store.find('payments', payment.id),
      booking: await this.store.find('bookings', payment.bookingId),
    };
  }
  async setBookingStatus(id: string, status: string) {
    if (!['INQUIRY', 'CONFIRMED', 'CANCELLED'].includes(status))
      throw new BadRequestException('Choose a valid booking status.');
    const booking = await this.store.find('bookings', id);
    const payments = (await this.store.all<PaymentRow>('payments')).filter(
      (p) => p.bookingId === id,
    );
    if (
      status === 'INQUIRY' &&
      payments.some((p) =>
        [
          'PENDING',
          'PROCESSING',
          'PAID',
          'REFUND_PENDING',
          'REFUNDED',
        ].includes(p.status),
      )
    )
      throw new ConflictException(
        'A booking with payment activity cannot be moved back to inquiry.',
      );
    if (
      status === 'CONFIRMED' &&
      payments.some((p) => ['REFUNDED', 'REFUND_PENDING'].includes(p.status))
    )
      throw new ConflictException(
        'A refunded booking cannot be reopened. Start a new inquiry instead.',
      );
    if (status === 'CANCELLED') {
      for (const payment of payments.filter((p) => p.status === 'PENDING')) {
        const stripe = this.gateway.require();
        const session = await stripe.checkout.sessions.retrieve(payment.id);
        if (session.status === 'open') {
          await stripe.checkout.sessions.expire(payment.id);
          await this.store.transitionPayment(
            payment.id,
            { status: 'EXPIRED', updatedAt: new Date().toISOString() },
            ['PENDING'],
          );
        } else if (session.payment_status === 'paid')
          await this.fulfill(session);
      }
    }
    if (booking.status === status) return booking;
    return this.store.update('bookings', id, { status });
  }
  async cancel(id: string, userId: string) {
    await this.ownedBooking(id, userId);
    return this.setBookingStatus(id, 'CANCELLED');
  }
  async refund(id: string) {
    const payment = await this.store.find<PaymentRow>('payments', id);
    if (payment.status === 'REFUNDED') return payment;
    if (
      !['PAID', 'REFUND_PENDING'].includes(payment.status) ||
      !payment.paymentIntentId
    )
      throw new ConflictException('Only a completed payment can be refunded.');
    const refund = await this.gateway.require().refunds.create(
      {
        payment_intent: payment.paymentIntentId,
        metadata: { bookingId: payment.bookingId, paymentId: payment.id },
      },
      { idempotencyKey: `wanderline-refund-${payment.id}` },
    );
    if (refund.status === 'failed' || refund.status === 'canceled')
      throw new BadRequestException(
        'Stripe could not complete the refund. The payment remains received; contact Stripe support before retrying.',
      );
    await this.store.transitionPayment(
      payment.id,
      {
        refundId: refund.id,
        status: refund.status === 'succeeded' ? 'REFUNDED' : 'REFUND_PENDING',
        refundedAmountCents:
          refund.status === 'succeeded'
            ? Math.min(
                payment.amountCents,
                payment.refundedAmountCents + refund.amount,
              )
            : payment.refundedAmountCents,
        updatedAt: new Date().toISOString(),
      },
      ['PAID', 'REFUND_PENDING'],
    );
    await this.store.update('bookings', payment.bookingId, {
      status: 'CANCELLED',
    });
    return this.store.find('payments', payment.id);
  }
  async webhook(raw: Buffer | undefined, signature: string | undefined) {
    if (!raw || !signature)
      throw new BadRequestException('A raw signed Stripe payload is required.');
    if (!process.env.STRIPE_WEBHOOK_SECRET)
      throw new ServiceUnavailableException(
        'Stripe webhook signing is not configured.',
      );
    let event: Stripe.Event;
    try {
      event = this.gateway.client.webhooks.constructEvent(
        raw,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe signature.');
    }
    if (
      [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
      ].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const known = (await this.store.all('payments')).some(
        (p) => p.id === session.id,
      );
      if (known)
        await this.fulfill(
          await this.gateway.require().checkout.sessions.retrieve(session.id),
        );
    } else if (
      [
        'checkout.session.expired',
        'checkout.session.async_payment_failed',
      ].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if ((await this.store.all('payments')).some((p) => p.id === session.id))
        await this.store.transitionPayment(
          session.id,
          {
            status: event.type.endsWith('expired') ? 'EXPIRED' : 'FAILED',
            updatedAt: new Date().toISOString(),
          },
          ['PENDING', 'PROCESSING'],
        );
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      const payment = (await this.store.all<PaymentRow>('payments')).find(
        (p) => p.paymentIntentId === intentId,
      );
      if (payment && charge.currency === payment.currency) {
        const complete = charge.amount_refunded >= payment.amountCents;
        await this.store.transitionPayment(
          payment.id,
          {
            status: complete ? 'REFUNDED' : payment.status,
            refundedAmountCents: charge.amount_refunded,
            updatedAt: new Date().toISOString(),
          },
          ['PAID', 'REFUND_PENDING', 'REFUNDED'],
        );
        if (complete)
          await this.store.update('bookings', payment.bookingId, {
            status: 'CANCELLED',
          });
      }
    } else if (
      event.type === 'refund.updated' ||
      event.type === 'refund.failed'
    ) {
      const refund = event.data.object as Stripe.Refund;
      const payment = (await this.store.all<PaymentRow>('payments')).find(
        (p) => p.refundId === refund.id,
      );
      if (payment)
        await this.store.transitionPayment(
          payment.id,
          {
            status:
              refund.status === 'succeeded'
                ? 'REFUNDED'
                : ['failed', 'canceled'].includes(refund.status || '')
                  ? 'PAID'
                  : 'REFUND_PENDING',
            refundedAmountCents:
              refund.status === 'succeeded'
                ? Math.min(
                    payment.amountCents,
                    payment.refundedAmountCents + refund.amount,
                  )
                : payment.refundedAmountCents,
            updatedAt: new Date().toISOString(),
          },
          ['PAID', 'REFUND_PENDING'],
        );
    }
    return { received: true };
  }
  async operations() {
    const bookings = await this.attach(
      (await this.store.all('bookings')).reverse(),
    );
    const payments = (await this.store.all<PaymentRow>('payments')).reverse();
    const travelers = (await this.store.all('users')).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      bookings: bookings.filter((b) => b.userId === row.id).length,
    }));
    return { bookings, payments, travelers, config: this.config() };
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentService) {}
  @Get('config') @UseGuards(AuthGuard) config() {
    return this.payments.config();
  }
  @Post('checkout') @UseGuards(AuthGuard) checkout(
    @Body() body: unknown,
    @Req() request: AuthRequest,
  ) {
    return this.payments.checkout(
      text(object(body).bookingId, 'Booking ID'),
      request.user.id,
    );
  }
  @Get('sessions/:id') @UseGuards(AuthGuard) reconcile(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    return this.payments.reconcile(id, request.user.id);
  }
  @Post('webhook') @HttpCode(200) webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.payments.webhook(request.rawBody, signature);
  }
}

@Controller('admin/operations')
@UseGuards(AdminGuard)
export class PaymentAdminController {
  constructor(private readonly payments: PaymentService) {}
  @Get() operations() {
    return this.payments.operations();
  }
  @Post('payments/:id/refund') refund(@Param('id') id: string) {
    return this.payments.refund(id);
  }
}
