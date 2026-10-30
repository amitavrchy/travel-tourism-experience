import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
const app = await NestFactory.createApplicationContext(AppModule);
console.log(
  'Wanderline catalog initialized. Existing editorial changes were preserved.',
);
await app.close();
