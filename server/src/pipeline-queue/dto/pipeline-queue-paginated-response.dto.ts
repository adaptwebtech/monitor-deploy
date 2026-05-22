import { ApiProperty } from '@nestjs/swagger';
import { PipelineQueueResponseDto } from './pipeline-queue-response.dto';

export class PipelineQueuePaginatedResponseDto {
  @ApiProperty({
    description: 'Lista de pipelines da página atual',
    type: [PipelineQueueResponseDto],
  })
  data: PipelineQueueResponseDto[];

  @ApiProperty({
    description: 'Total de registros encontrados',
    example: 342,
  })
  total: number;

  @ApiProperty({
    description: 'Página atual',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Limite de itens por página',
    example: 100,
  })
  limit: number;
}
