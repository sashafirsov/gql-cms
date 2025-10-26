import { Module, NestMiddleware, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { postgraphile } from 'postgraphile';

@Module({
    imports: [],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(
                postgraphile(process.env.DATABASE_URL, 'gql_cms', {
                    // expose GraphiQL in dev only
                    graphiql: process.env.NODE_ENV !== 'production',
                    enhanceGraphiql: process.env.NODE_ENV !== 'production',
                    // very important: inject per-request pg session vars
                    pgSettings: async (req) => {
                        // result of your auth layer:
                        // e.g. req.auth = { role: 'app_user', userId: '68d4...', scopes: ['doc:read'] }
                        const auth = req.auth ?? { role: 'anonymous' };

                        return {
                            role: auth.role, // Postgres role to SET LOCAL ROLE to
                            'jwt.claims.user_id': auth.userId ?? null,
                            'jwt.claims.email': auth.email ?? null,
                            'jwt.claims.scopes': (auth.scopes ?? []).join(','),
                        };
                    },
                    // optional: default DB role for anonymous
                    pgDefaultRole: 'anonymous',
                })
            )
            .forRoutes('/graphql');
    }
}
