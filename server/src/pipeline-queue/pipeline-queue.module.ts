import { Module } from '@nestjs/common';
import { PipelineQueueController } from './pipeline-queue.controller';
import { PipelineQueueService } from './pipeline-queue.service';

@Module({
  controllers: [PipelineQueueController],
  providers: [PipelineQueueService],
  exports: [PipelineQueueService],
})
export class PipelineQueueModule {}
