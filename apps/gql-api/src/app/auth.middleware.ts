// auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import * as cookie from 'cookie';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: Function) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['access_token'];
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, { algorithms: ['RS256'] }) as any;
        req.auth = {
          role: payload.role ?? 'app_user',
          userId: payload.sub,
          email: payload.email,
          scopes: payload.scopes ?? [],
        };
      } catch {
        // optionally attach anonymous or block; do not throw here unless you want hard fail
      }
    }
    next();
  }
}
