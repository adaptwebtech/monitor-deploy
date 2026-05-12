import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreatePipelineStepDto {
  @ApiProperty({
    description: 'UUID do pipeline associado',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsString()
  id_pipeline_queue: string;

  @ApiProperty({ description: 'Tipo do evento', example: 'step' })
  @IsString()
  event: string;

  @ApiProperty({
    description: 'Nome do workflow',
    example: 'whiz-server-ci-cd-dev-j8klp',
  })
  @IsString()
  workflowName: string;

  @ApiProperty({ description: 'Nome da etapa', example: 'build' })
  @IsString()
  stepName: string;
}
