import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { ConfiguredIoAdapter } from './common/websocket/configured-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>('http.corsOrigins') ?? [];
  const swaggerEnabled = config.get<boolean>('http.swaggerEnabled') ?? false;

  // ZodValidationPipe đã đăng ký global qua APP_PIPE trong AppModule
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new TransformInterceptor(),
  );
  app.enableShutdownHooks();
  app.use(helmet(swaggerEnabled ? { contentSecurityPolicy: false } : {}));
  app.enableCors({
    origin: corsOrigins,
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, corsOrigins));

  // patchNestJsSwagger() PHẢI gọi trước SwaggerModule.createDocument —
  // đây là chỗ nestjs-zod "vá" @nestjs/swagger để nó hiểu zod schema
  // (tự sinh OpenAPI schema từ createZodDto, không cần viết @ApiProperty thủ công)
  patchNestJsSwagger();

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HospitalManagement API')
      .setDescription(
        'API cho hệ thống tối ưu luồng khám chữa bệnh (patient flow / queue routing)',
      )
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  logger.log(`Server listening on port ${port}`);
  if (swaggerEnabled) {
    logger.warn('Swagger is enabled; disable SWAGGER_ENABLED in production');
  }
}
void bootstrap();
