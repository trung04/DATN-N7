import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureHttpApplication } from '../src/common/http/configure-http-application';
import { configureOpenApi } from '../src/common/openapi/configure-openapi';
import { AppController } from '../src/modules/app/controllers/app.controller';
import { AppService } from '../src/modules/app/services/app.service';

describe('OpenAPI documentation (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    configureOpenApi(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves the OpenAPI JSON document', async () => {
    await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect(({ body }) => {
        expect(body.openapi).toMatch(/^3\./);
        expect(body.info).toMatchObject({
          title: 'Tourism Booking API',
          version: '1.0',
        });
        expect(body.paths).toHaveProperty('/');
        expect(body.components.securitySchemes).toHaveProperty('bearer');
      });
  });

  it('serves the Swagger UI', async () => {
    await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200)
      .expect('Content-Type', /text\/html/);
  });
});
