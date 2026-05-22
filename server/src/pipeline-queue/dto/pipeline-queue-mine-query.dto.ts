import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PipelineQueueQueryDto } from './pipeline-queue-query.dto';

export class PipelineQueueMineQueryDto extends PipelineQueueQueryDto {
  @ApiPropertyOptional({
    description: 'Limite por página — apenas 10 ou 100 são aceitos',
    example: 10,
    enum: [10, 100],
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsIn([10, 100])
  declare limit?: 10 | 100;
}
