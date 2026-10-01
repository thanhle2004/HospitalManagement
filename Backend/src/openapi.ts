import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  patchNestJsSwagger();
  const config = new DocumentBuilder()
    .setTitle('HospitalManagement API')
    .setDescription('API cho hệ thống tối ưu luồng khám chữa bệnh')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  return SwaggerModule.createDocument(app, config);
}
