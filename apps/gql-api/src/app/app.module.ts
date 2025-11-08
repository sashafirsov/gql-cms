import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller.ts';
import { AppService } from './app.service.ts';
import { AuthMiddleware } from './auth.middleware.ts';
import { NorthwindAuthModule } from './northwind-auth/auth.module.ts';
import { GqlCmsAuthModule } from './gql-cms-auth/auth.module.ts';

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
    }
}
