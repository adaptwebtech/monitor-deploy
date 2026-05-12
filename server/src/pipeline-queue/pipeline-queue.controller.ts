import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineQueueService } from './pipeline-queue.service';
import { PipelineQueueQueryDto } from './dto/pipeline-queue-query.dto';
import { UpdatePipelineQueueDto } from './dto/update-pipeline-queue.dto';
import { PipelineQueueResponseDto } from './dto/pipeline-queue-response.dto';

interface AuthedRequest extends Request {
  user: { id: string; email: string; root: boolean };
}

@ApiTags('Pipeline Queue')
@ApiBearerAuth('bearer')
@Controller('pipeline-queue')
@UseGuards(JwtAuthGuard)
export class PipelineQueueController {
  constructor(private readonly pipelineQueueService: PipelineQueueService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar pipelines',
    description: 'Retorna lista paginada de pipelines com filtros opcionais.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pipelines retornada com sucesso.',
  })
  findAll(@Query() query: PipelineQueueQueryDto) {
    return this.pipelineQueueService.findAll(query);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'Meus pipelines',
    description: 'Retorna pipelines associados ao usuário autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Lista de pipelines do usuário.' })
  findMine(@Req() req: AuthedRequest, @Query() query: PipelineQueueQueryDto) {
    return this.pipelineQueueService.findMine(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar pipeline por ID',
    description: 'Retorna um pipeline específico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pipeline encontrado.',
    type: PipelineQueueResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Pipeline não encontrado.' })
  findById(@Param('id') id: string) {
    return this.pipelineQueueService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar pipeline',
    description: 'Atualiza o status ou outros campos de um pipeline.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pipeline atualizado.',
    type: PipelineQueueResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Pipeline não encontrado.' })
  update(@Param('id') id: string, @Body() dto: UpdatePipelineQueueDto) {
    return this.pipelineQueueService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Excluir pipeline (soft delete)',
    description: 'Marca um pipeline como deletado.',
  })
  @ApiResponse({ status: 200, description: 'Pipeline removido.' })
  @ApiResponse({ status: 404, description: 'Pipeline não encontrado.' })
  async softDelete(@Param('id') id: string) {
    await this.pipelineQueueService.softDelete(id);
    return { message: 'Pipeline removido com sucesso' };
  }
}
