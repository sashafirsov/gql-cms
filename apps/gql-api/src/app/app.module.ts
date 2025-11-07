import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller.ts';
import { AppService } from './app.service.ts';
import { AuthMiddleware } from './auth.middleware.ts';
import { NorthwindAuthModule } from './northwind-auth/auth.module.ts';
import { GqlCmsAuthModule } from './gql-cms-auth/auth.module.ts';

import { postgraphile } from 'postgraphile';

@Module({
    imports: [NorthwindAuthModule, GqlCmsAuthModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        // Apply auth middleware to all routes
        consumer
            .apply(AuthMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });

        // Apply PostGraphile middleware to /graphql
        consumer
            .apply(
                postgraphile(process.env.DATABASE_URL, 'gql_cms', {
                    // expose GraphiQL in dev only
                    graphiql: process.env.NODE_ENV !== 'production',
                    enhanceGraphiql: process.env.NODE_ENV !== 'production',
                    // Retry on connection failures (useful during container startup)
                    retryOnInitFail: true,
                    // very important: inject per-request pg session vars
                    pgSettings: async (req) => {
                        // result of your auth layer:
                        // e.g. req.auth = { role: 'app_user', userId: '68d4...', scopes: ['doc:read'] }
                        // @ts-expect-error added by auth layer
                        const auth = req.auth ?? { role: 'anonymous' };

                        return {
                            role: auth.role, // Application role name (not PostgreSQL role switch)
                            'app.principal_id': auth.userId ?? null, // For acl.current_principal() (Northwind)
                            'gql_cms.user_id': auth.userId ?? null,  // For gql_cms.current_user_id() (gql_cms)
                            'jwt.claims.user_id': auth.userId ?? null,
                            'jwt.claims.email': auth.email ?? null,
                            'jwt.claims.scopes': (auth.scopes ?? []).join(','),
                        };
                    },
                })
            )
            .forRoutes('/graphql');
    }
}
