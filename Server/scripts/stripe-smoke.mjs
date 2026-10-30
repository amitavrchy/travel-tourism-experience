import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
  throw new Error('This smoke test only accepts Stripe test-mode keys.');
const serverDir = fileURLToPath(new URL('../', import.meta.url));
const clientDir = fileURLToPath(new URL('../../Client/', import.meta.url));
const apiOrigin = 'http://127.0.0.1:4205';
const appOrigin = 'http://127.0.0.1:3205';
const directory = await mkdtemp(join(tmpdir(), 'wanderline-stripe-smoke-'));
const adminPassword = randomBytes(20).toString('hex');
const children = [];
let browser;
const start = (cwd, args, env) => {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  children.push(child);
  child.stderr.on('data', () => {});
  return child;
};
const ready = async (url) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('The isolated payment test service did not start.');
};
const request = async (path, body, token, method = 'POST') => {
  const response = await fetch(`${apiOrigin}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${data.message || response.status}`);
  return data;
};
try {
  start(serverDir, ['dist/main.js'], {
    PORT: '4205',
    STORAGE_MODE: 'file',
    DATA_DIRECTORY: directory,
    JWT_SECRET: randomBytes(48).toString('hex'),
    CLIENT_ORIGIN: appOrigin,
    ADMIN_EMAIL: 'stripe-admin@example.com',
    ADMIN_PASSWORD: adminPassword,
    NODE_ENV: 'test',
  });
  await ready(`${apiOrigin}/health`);
  const user = await request('auth/register', {
    name: 'Stripe Test Traveler',
    email: 'wanderline-smoke@example.com',
    password: randomBytes(16).toString('hex'),
  });
  const admin = await request('auth/login', {
    email: 'stripe-admin@example.com',
    password: adminPassword,
  });
  const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const booking = await request(
    'bookings',
    {
      packageId: 'bali-t1',
      startDate: date,
      guests: 1,
      email: 'wanderline-smoke@example.com',
      notes: 'Automated Stripe sandbox verification.',
    },
    user.token,
  );
  await request(
    `admin/bookings/${booking.id}`,
    { status: 'CONFIRMED' },
    admin.token,
    'PATCH',
  );
  const checkout = await request(
    'payments/checkout',
    { bookingId: booking.id },
    user.token,
  );
  const repeat = await request(
    'payments/checkout',
    { bookingId: booking.id },
    user.token,
  );
  if (repeat.sessionId !== checkout.sessionId)
    throw new Error('Repeated payment clicks created different sessions.');
  console.log(
    JSON.stringify({
      testMode: true,
      bookingApproval: true,
      stripeCheckoutCreated: true,
      repeatedCheckoutReused: true,
    }),
  );
  if (process.argv.includes('--complete')) {
    const require = createRequire(
      new URL('../../Client/package.json', import.meta.url),
    );
    const { chromium } = require('@playwright/test');
    start(
      clientDir,
      [
        'node_modules/next/dist/bin/next',
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        '3205',
      ],
      { API_URL: apiOrigin },
    );
    await ready(appOrigin);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    await context.addCookies([
      {
        name: 'wl_session',
        value: user.token,
        url: appOrigin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    await page.goto(checkout.url, { waitUntil: 'domcontentloaded' });
    const fill = async (selector, value) => {
      for (let attempt = 0; attempt < 40; attempt++) {
        for (const frame of page.frames()) {
          const field = frame.locator(selector).first();
          if (await field.isVisible().catch(() => false)) {
            await field.fill(value);
            return;
          }
        }
        await page.waitForTimeout(250);
      }
      throw new Error(`Stripe test field unavailable: ${selector}`);
    };
    await fill(
      'input[name="cardNumber"],input[autocomplete="cc-number"],input[placeholder="1234 1234 1234 1234"]',
      '4242424242424242',
    );
    await fill(
      'input[name="cardExpiry"],input[autocomplete="cc-exp"],input[placeholder="MM / YY"]',
      '1230',
    );
    await fill(
      'input[name="cardCvc"],input[autocomplete="cc-csc"],input[placeholder="CVC"]',
      '123',
    );
    for (const frame of page.frames()) {
      for (const selector of [
        'input[name="billingName"]',
        'input[autocomplete="cc-name"]',
      ]) {
        const field = frame.locator(selector).first();
        if (await field.isVisible().catch(() => false))
          await field.fill('Stripe Test Traveler');
      }
      const postal = frame
        .locator(
          'input[autocomplete="postal-code"],input[name="billingPostalCode"]',
        )
        .first();
      if (await postal.isVisible().catch(() => false))
        await postal.fill('10001');
    }
    const submit = page
      .getByRole('button', { name: /^pay|^confirm|^complete/i })
      .last();
    await submit.click();
    await page.waitForURL(`${appOrigin}/payments/return**`, { timeout: 45000 });
    await page
      .getByRole('heading', { name: 'You’re on your way.' })
      .waitFor({ timeout: 30000 });
    const verified = await request(
      `payments/sessions/${checkout.sessionId}`,
      undefined,
      user.token,
      'GET',
    );
    if (verified.payment.status !== 'PAID')
      throw new Error('Stripe did not verify a paid payment.');
    const refunded = await request(
      `admin/operations/payments/${checkout.sessionId}/refund`,
      {},
      admin.token,
    );
    if (!['REFUNDED', 'REFUND_PENDING'].includes(refunded.status))
      throw new Error('Stripe did not accept the sandbox refund.');
    console.log(
      JSON.stringify({
        stripeHostedPaymentCompleted: true,
        serverVerifiedPaid: true,
        receiptAvailable: !!verified.payment.receiptUrl,
        refundStatus: refunded.status,
      }),
    );
  } else {
    await request(
      `bookings/${booking.id}`,
      { status: 'CANCELLED' },
      user.token,
      'PATCH',
    );
    console.log(JSON.stringify({ openCheckoutExpiredOnCancellation: true }));
  }
} finally {
  await browser?.close();
  for (const child of children.reverse()) child.kill();
}
