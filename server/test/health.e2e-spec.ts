import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  it('AC-1: GET /health retorna 200 com { status: "ok" } (inclui checagem real do Postgres)', async () => {
    // Arrange (sem headers)

    // Act
    const res = await request(app.getHttpServer()).get('/health');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('AC-2: GET /health sem header apikey retorna 200 (não 401/403)', async () => {
    // Arrange — explicitamente sem apikey nem Authorization

    // Act
    const res = await request(app.getHttpServer())
      .get('/health')
      .unset('apikey')
      .unset('Authorization');

    // Assert
    expect(res.status).toBe(200);
  });
});
