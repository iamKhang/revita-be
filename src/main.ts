import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('API documentation for the Medical Appointment Booking and Patient Information Management System, enabling seamless integration across healthcare application components.')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Đặt endpoint cho Swagger UI tại /api

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
