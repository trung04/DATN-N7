import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Tourism Booking API')
    .setDescription(
      'Backend API for tourism booking, management, and authentication.',
    )
    .setVersion('1.0')
    .addCookieAuth('login_access', {
      type: 'apiKey',
      in: 'cookie',
      description: 'Opaque access-session cookie issued by login.',
    })
    .addTag('Application', 'Application information')
    .addTag('Amenities', 'Amenity management')
    .addTag('Rooms', 'Room management and amenity assignment')
    .addTag('Users', 'User management and password reset')
    .addTag('Hotel Owners', 'Hotel owner profile management')
    .addTag('Places', 'Destination and place management')
    .addTag('Cancellation Policies', 'Hotel cancellation policy management')
    .addTag('Bookings', 'Booking, payment, settlement, and refund management')
    .addTag('Authentication', 'Password and Google login sessions')
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      operationIdFactory: (controllerKey, methodKey) =>
        `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
    });

  SwaggerModule.setup('api/docs', app, documentFactory, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
  });
}
