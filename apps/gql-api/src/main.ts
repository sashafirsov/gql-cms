/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module.ts';
import { AuthMiddleware } from './app/auth.middleware.ts';
import { postgraphile } from 'postgraphile';
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parser for authentication
  app.use(cookieParser());

  // Apply auth middleware before PostGraphile
  app.use((req: any, res: any, next: any) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['access_token'];
    console.log('[Auth Middleware] Cookie:', req.headers.cookie ? 'present' : 'missing');
    console.log('[Auth Middleware] Access token:', token ? 'present' : 'missing');
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, { algorithms: ['RS256'] }) as any;
        req.auth = {
          role: payload.role ?? 'app_user',
          userId: payload.sub,
          email: payload.email,
          scopes: payload.scopes ?? [],
        };
        console.log('[Auth Middleware] req.auth set:', JSON.stringify(req.auth));
      } catch (err) {
        console.log('[Auth Middleware] JWT verification failed:', err.message);
        // Invalid token, continue as anonymous
      }
    }
    next();
  });

  // Apply PostGraphile middleware
  app.use(
    postgraphile(process.env.DATABASE_URL, 'gql_cms', {
      // expose GraphiQL in dev only
      graphiql: process.env.NODE_ENV !== 'production',
      enhanceGraphiql: process.env.NODE_ENV !== 'production',
      // Retry on connection failures (useful during container startup)
      retryOnInitFail: true,
      // very important: inject per-request pg session vars
      pgSettings: async (req: any) => {
        // result of your auth layer:
        // e.g. req.auth = { role: 'app_user', userId: '68d4...', scopes: ['doc:read'] }
        const auth = req.auth ?? { role: 'anonymous' };
        console.log('[pgSettings] req.auth:', JSON.stringify(req.auth));

        const settings = {
          // Don't switch roles - use session variables for access control instead
          'app.principal_id': auth.userId ?? null, // For acl.current_principal() (Northwind)
          'gql_cms.user_id': auth.userId ?? null,  // For gql_cms.current_user_id() (gql_cms)
          'jwt.claims.user_id': auth.userId ?? null,
          'jwt.claims.email': auth.email ?? null,
          'jwt.claims.scopes': (auth.scopes ?? []).join(','),
        };
        console.log('[pgSettings] Returning settings:', JSON.stringify(settings));
        return settings;
      },
    })
  );

  // Only apply prefix to /status endpoint, not all routes
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}`);
  Logger.log(`📊 Status endpoint: http://localhost:${port}/status`);
  Logger.log(`🔐 Auth endpoints: http://localhost:${port}/northwind/auth/*`);
  Logger.log(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
}

bootstrap();
