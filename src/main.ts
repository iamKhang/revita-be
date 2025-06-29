import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Cấu hình validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Chỉ cho phép các property được định nghĩa trong DTO
      forbidNonWhitelisted: true, // Throw error nếu có property không được định nghĩa
      transform: true, // Tự động transform data types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Revita API Documentation')
    .setDescription('API documentation for the Medical Appointment Booking and Patient Information Management System, enabling seamless integration across healthcare application components.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for references
    )
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Đặt endpoint cho Swagger UI tại /api

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
