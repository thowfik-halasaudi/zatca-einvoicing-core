/**
 * Main Application Entry Point
 *
 * Bootstraps the NestJS application, sets up global pipes (Validation),
 * Swagger documentation, and CORS configuration.
 */
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  // Global Interceptor and Filter are now registered in AppModule

  // Enable CORS for frontend at http://localhost:3001
  app.enableCors({
    origin: ["http://localhost:3001", "http://localhost:3000"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("ZATCA E-Invoicing Core")
    .setDescription("Microservice for ZATCA Phase-2 Compliance")
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  await app.listen(3000);
}
bootstrap();
