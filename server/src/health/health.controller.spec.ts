import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const healthService = { checkDatabase: jest.fn() } as unknown as HealthService;

  beforeEach(() => {
    controller = new HealthController(healthService);
    jest.clearAllMocks();
  });

  it('AC-1: check() retorna { status: "ok" } quando Postgres responde', async () => {
    (healthService.checkDatabase as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.check();

    expect(result).toEqual({ status: 'ok' });
  });

  it('AC-2: check() lança HttpException 503 quando Postgres falha', async () => {
    (healthService.checkDatabase as jest.Mock).mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toThrow(
      new HttpException({ status: 'error' }, HttpStatus.SERVICE_UNAVAILABLE),
    );
  });
});
