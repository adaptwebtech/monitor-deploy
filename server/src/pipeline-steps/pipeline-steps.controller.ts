import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineStepsService } from './pipeline-steps.service';
import { PipelineStepResponseDto } from './dto/pipeline-step-response.dto';

@ApiTags('Pipeline Steps')
@ApiBearerAuth('bearer')
@Controller('pipeline-steps')
@UseGuards(JwtAuthGuard)
export class PipelineStepsController {
  constructor(private readonly pipelineStepsService: PipelineStepsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar etapas do pipeline',
    description:
      'Retorna as etapas de um pipeline. Quando page e limit são omitidos, retorna todos os registros.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de etapas retornada com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'pipelineQueueId é obrigatório.' })
  findAll(
    @Query('pipelineQueueId') pipelineQueueId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!pipelineQueueId) {
      throw new BadRequestException('pipelineQueueId é obrigatório');
    }
    return this.pipelineStepsService.findAllByQueue(pipelineQueueId, {
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar etapa por ID',
    description: 'Retorna uma etapa específica do pipeline.',
  })
  @ApiResponse({
    status: 200,
    description: 'Etapa encontrada.',
    type: PipelineStepResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Etapa não encontrada.' })
  findById(@Param('id') id: string) {
    return this.pipelineStepsService.findById(id);
  }
}
