import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/httpException.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { Configuration } from './config/configuration';

async function bootstrap() {
  // rawBody: true keeps the exact request bytes available on req.rawBody —
  // needed to verify Meta's X-Hub-Signature-256 HMAC on the WhatsApp
  // webhook, which must be computed over the raw body, not the re-
  // serialized parsed JSON. See WhatsappWebhookController.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService =
    app.get<ConfigService<Configuration, true>>(ConfigService);
  const { port, clientUrl } = configService.get('app', { infer: true });

  app.setGlobalPrefix('api/v1');

  app.enableCors({ origin: clientUrl });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Collectify API')
    .setDescription('WhatsApp-based overdue payment reminder system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(port);
}
void bootstrap();
