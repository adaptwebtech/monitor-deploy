import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PipelineStepResponseDto {
  @ApiProperty({
    description: 'UUID da etapa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'UUID do pipeline associado',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @Expose()
  id_pipeline_queue: string;

  @ApiProperty({ description: 'Tipo do evento', example: 'step' })
  @Expose()
  event: string;

  @ApiProperty({
    description: 'Nome do workflow',
    example: 'whiz-server-ci-cd-dev-j8klp',
  })
  @Expose()
  workflowName: string;

  @ApiProperty({ description: 'Nome da etapa', example: 'build' })
  @Expose()
  stepName: string;

  @ApiProperty({ description: 'Etapa deletada?', example: false })
  @Expose()
  del: boolean;

  @ApiProperty({ description: 'Data de criação' })
  @Expose()
  createdAt: Date;
}
