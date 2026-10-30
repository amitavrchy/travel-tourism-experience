import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { StoreService } from './store.service.js';
import { AuthGuard, AdminGuard, AuthService } from './auth.js';
import {
  AuthController,
  AccountController,
  CatalogController,
  AdminController,
} from './controllers.js';
import { PlannerController } from './planner.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (
          process.env.NODE_ENV === 'production' &&
          (!secret || secret.length < 32 || secret.startsWith('replace-'))
        )
          throw new Error('Set a strong JWT_SECRET for production.');
        return {
          secret:
            secret && !secret.startsWith('replace-')
              ? secret
              : randomBytes(48).toString('hex'),
        };
      },
    }),
  ],
  controllers: [
    AuthController,
    AccountController,
    AdminController,
    PlannerController,
    CatalogController,
  ],
  providers: [StoreService, AuthService, AuthGuard, AdminGuard],
})
export class AppModule {}
