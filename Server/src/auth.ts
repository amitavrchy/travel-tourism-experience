import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, OnApplicationBootstrap, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import type { Request } from 'express';
import { StoreService, type Row } from './store.service.js';
import { email, text } from './validation.js';

export type Account = Row & { name: string; email: string; passwordHash: string; role: 'TRAVELER' | 'ADMIN' };
export type AuthRequest = Request & { user: { id: string; name: string; email: string; role: 'TRAVELER' | 'ADMIN' } };

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  constructor(private readonly store: StoreService, private readonly jwt: JwtService) {}
  async onApplicationBootstrap() {
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const address = email(process.env.ADMIN_EMAIL);
      text(process.env.ADMIN_PASSWORD, 'Admin password', 12, 72);
      if (!(await this.store.all('users')).some(user => user.email === address)) {
        await this.store.create('users', { name: 'Wanderline Admin', email: address, passwordHash: await hash(process.env.ADMIN_PASSWORD, 12), role: 'ADMIN' });
      }
    }
  }
  publicUser(user: Account) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
  async register(body: Record<string, unknown>) {
    const address = email(body.email);
    const name = text(body.name, 'Name', 2, 80);
    const password = text(body.password, 'Password', 8, 72);
    if ((await this.store.all('users')).some(user => user.email === address)) throw new ConflictException('An account with this email already exists.');
    const user = await this.store.create('users', { name, email: address, passwordHash: await hash(password, 12), role: 'TRAVELER' }) as Account;
    return this.session(user);
  }
  async login(body: Record<string, unknown>) {
    const address = email(body.email);
    const password = text(body.password, 'Password', 1, 72);
    const user = (await this.store.all<Account>('users')).find(item => item.email === address);
    if (!user || !await compare(password, user.passwordHash)) throw new UnauthorizedException('Email or password is incorrect.');
    return this.session(user);
  }
  private session(user: Account) { return { user: this.publicUser(user), token: this.jwt.sign({ sub: user.id }, { expiresIn: '7d' }) }; }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly store: StoreService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      const user = await this.store.find<Account>('users', payload.sub);
      request.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      return true;
    } catch { throw new UnauthorizedException('Your session has expired. Please sign in again.'); }
  }
}

@Injectable()
export class AdminGuard extends AuthGuard {
  override async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    if (context.switchToHttp().getRequest<AuthRequest>().user.role !== 'ADMIN') throw new ForbiddenException('Administrator access is required.');
    return true;
  }
}
