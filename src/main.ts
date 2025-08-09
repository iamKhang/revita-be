import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình CORS - Cho phép tất cả origins
  // Thêm tiền tố 'api' cho tất cả endpoints (loại trừ docs và health check)
  app.setGlobalPrefix('api', {
    exclude: ['docs', 'docs/(.*)', 'health', '/']
  });

  app.enableCors({
    origin: true, // Cho phép tất cả origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'Bearer',
      'X-API-Key',
      'X-Request-ID',
      'X-Correlation-ID'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count', 
      'X-Request-ID',
      'X-Correlation-ID'
    ],
    credentials: true, // Cho phép gửi cookies và headers xác thực
    preflightContinue: false,
    optionsSuccessStatus: 204
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
  SwaggerModule.setup('docs', app, document); // Đặt endpoint cho Swagger UI tại /docs (ngoài tiền tố api)

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
