import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  });
  const attempts = new Map<string, { count: number; until: number }>();
  const cleanup = setInterval(() => {
    for (const [key, value] of attempts)
      if (value.until < Date.now()) attempts.delete(key);
  }, 60000);
  cleanup.unref();
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (
      req.method === 'POST' &&
      (req.path.startsWith('/auth') || req.path.startsWith('/planner'))
    ) {
      const key = `${req.ip}:${req.path}`;
      const bucket = attempts.get(key);
      if (bucket && bucket.until > Date.now()) {
        if (++bucket.count > 30)
          return res.status(429).json({
            message: 'Please wait a few minutes before trying again.',
          });
      } else attempts.set(key, { count: 1, until: Date.now() + 600000 });
    }
    next();
  });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000, process.env.HOST || '127.0.0.1');
}
await bootstrap();
