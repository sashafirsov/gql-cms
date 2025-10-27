/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parser for authentication
  app.use(cookieParser());

  // Only apply prefix to /status endpoint, not all routes
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}`);
  Logger.log(`📊 Status endpoint: http://localhost:${port}/status`);
  Logger.log(`🔐 Auth endpoints: http://localhost:${port}/northwind/auth/*`);
  Logger.log(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
}

bootstrap();
