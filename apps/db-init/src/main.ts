import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { postgraphile } from 'postgraphile';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // PostGraphile middleware
  app.use(
    postgraphile(
      process.env.DATABASE_URL || 'postgres://localhost:5432/postgres',
      'app',
      {
        graphiql: true,
        graphqlRoute: '/graphql',
        graphiqlRoute: '/graphiql',
        enhanceGraphiql: true,
      }
    )
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
