import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Global prefix
    app.setGlobalPrefix('api');

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // CORS - Environment-aware configuration
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'];

    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    console.log('CORS enabled for origins:', allowedOrigins);

    // Swagger documentation (disabled in production for security)
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Specialist API')
        .setDescription('Marketplace de profesionales verificados en Bariloche')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    const port = process.env.PORT || 5000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://0.0.0.0:${port}/api`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Swagger documentation: http://0.0.0.0:${port}/api/docs`);
    }
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

