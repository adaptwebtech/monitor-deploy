import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { KpisQueryDto } from './dto/kpis-query.dto';
import { KpisResponseDto } from './dto/kpis-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({
    summary: 'KPIs do dashboard',
    description:
      'Retorna os indicadores de desempenho do período informado (total, sucesso, falha e taxa de erro).',
  })
  @ApiResponse({
    status: 200,
    description: 'KPIs retornados com sucesso.',
    type: KpisResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'dateStart ou dateEnd ausentes ou inválidos.',
  })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido.' })
  getKpis(@Query() query: KpisQueryDto) {
    return this.dashboardService.getKpis(query);
  }
}
