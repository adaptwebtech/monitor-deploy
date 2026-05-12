import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

describe('WebhookController (integration)', () => {
  let app: INestApplication;
  let webhookService: jest.Mocked<WebhookService>;

  const VALID_API_KEY = 'bWludGluaG8=';

  const validQueuedPayload = {
    event: 'queued',
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'abc123sha',
    commitMessage: 'feat: add monitoring',
    commitAuthor: 'Pedro Miranda',
    commitAuthorAvatar: 'https://github.com/pedro.png',
  };

  beforeAll(async () => {
    const webhookServiceMock: Partial<jest.Mocked<WebhookService>> = {
      handleEvent: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: WebhookService, useValue: webhookServiceMock }],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          const key = req.headers['apikey'];
          if (!key || key !== VALID_API_KEY) {
            const { UnauthorizedException } = require('@nestjs/common');
            throw new UnauthorizedException('API key inválida');
          }
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    webhookService = moduleRef.get(WebhookService);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  describe('POST /webhook — authentication', () => {
    it('AC-5: returns 401 when apikey header is missing', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .send(validQueuedPayload);

      // Assert
      expect(res.status).toBe(401);
    });

    it('AC-5: returns 401 when apikey header has wrong value', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', 'wrong-api-key')
        .send(validQueuedPayload);

      // Assert
      expect(res.status).toBe(401);
    });

    it('AC-5: returns 401 synchronously without any DB operation', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .send(validQueuedPayload);

      // Assert
      expect(res.status).toBe(401);
      expect(webhookService.handleEvent).not.toHaveBeenCalled();
    });
  });

  describe('POST /webhook — fire and forget', () => {
    it('AC-1: returns 201 immediately with valid apikey and queued event', async () => {
      // Arrange
      // handleEvent takes time but response should be immediate (fire and forget)
      webhookService.handleEvent.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      // Act
      const start = Date.now();
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', VALID_API_KEY)
        .send(validQueuedPayload);
      const elapsed = Date.now() - start;

      // Assert
      expect(res.status).toBe(201);
      // Fire and forget: response should return well before the 1s async processing
      expect(elapsed).toBeLessThan(900);
    });

    it('returns 201 immediately for step event', async () => {
      // Arrange
      webhookService.handleEvent.mockResolvedValue(undefined);

      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', VALID_API_KEY)
        .send({
          ...validQueuedPayload,
          event: 'step',
          stepName: 'build',
          workflowName: 'whiz-server-ci-cd-dev-j8klp',
        });

      // Assert
      expect(res.status).toBe(201);
    });

    it('returns 201 immediately for Succeeded event', async () => {
      // Arrange
      webhookService.handleEvent.mockResolvedValue(undefined);

      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', VALID_API_KEY)
        .send({
          ...validQueuedPayload,
          event: 'Succeeded',
          workflowName: 'whiz-server-ci-cd-dev-j8klp',
        });

      // Assert
      expect(res.status).toBe(201);
    });

    it('returns 201 immediately for Error event', async () => {
      // Arrange
      webhookService.handleEvent.mockResolvedValue(undefined);

      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', VALID_API_KEY)
        .send({
          ...validQueuedPayload,
          event: 'Error',
          workflowName: 'whiz-server-ci-cd-dev-j8klp',
        });

      // Assert
      expect(res.status).toBe(201);
    });
  });

  describe('POST /webhook — validation', () => {
    it('returns 400 for unknown event type', async () => {
      // Arrange
      webhookService.handleEvent.mockResolvedValue(undefined);

      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', VALID_API_KEY)
        .send({
          ...validQueuedPayload,
          event: 'unknown-event-type',
        });

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 400 when required fields are missing', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', VALID_API_KEY)
        .send({ event: 'queued' });

      // Assert
      expect(res.status).toBe(400);
    });
  });
});
