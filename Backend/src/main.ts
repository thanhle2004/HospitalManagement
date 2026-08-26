import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ZodValidationPipe đã đăng ký global qua APP_PIPE trong AppModule
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.enableCors();

  // patchNestJsSwagger() PHẢI gọi trước SwaggerModule.createDocument —
  // đây là chỗ nestjs-zod "vá" @nestjs/swagger để nó hiểu zod schema
  // (tự sinh OpenAPI schema từ createZodDto, không cần viết @ApiProperty thủ công)
  patchNestJsSwagger();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HospitalManagement API')
    .setDescription('API cho hệ thống tối ưu luồng khám chữa bệnh (patient flow / queue routing)')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
  console.log(`📘 Swagger docs tại http://localhost:${port}/docs`);
}
bootstrap();
