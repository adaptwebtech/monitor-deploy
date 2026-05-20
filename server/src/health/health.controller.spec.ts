import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('AC-1: check() retorna { status: "ok" }', () => {
    // Arrange (sem deps)

    // Act
    const result = controller.check();

    // Assert
    expect(result).toEqual({ status: 'ok' });
  });
});
