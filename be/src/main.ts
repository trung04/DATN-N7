import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from './app.module';
import { configureHttpApplication } from './common/http/configure-http-application';
import { configureOpenApi } from './common/openapi/configure-openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    rawBody: true,
  });
  configureHttpApplication(app);
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string>('FRONTEND_ORIGIN'),
    credentials: true,
  });
  configureOpenApi(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
