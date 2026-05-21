import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipApiKey } from '../auth/decorators/skip-api-key.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  @Get()
  @SkipApiKey()
  @ApiOperation({ summary: 'Healthcheck', description: 'Verifica se o serviço e o banco de dados estão operacionais.' })
  @ApiResponse({ status: 200, description: 'Serviço operacional.' })
  @ApiResponse({ status: 503, description: 'Banco de dados inacessível.' })
  async check() {
    try {
      await this.healthService.checkDatabase();
      return { status: 'ok' };
    } catch (err) {
      this.logger.error('Health check failed', err);
      throw new HttpException({ status: 'error' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
