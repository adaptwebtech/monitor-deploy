import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipApiKey } from '../auth/decorators/skip-api-key.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @SkipApiKey()
  @ApiOperation({ summary: 'Healthcheck', description: 'Verifica se o serviço está operacional.' })
  @ApiResponse({ status: 200, description: 'Serviço operacional.' })
  check() {
    return { status: 'ok' };
  }
}
