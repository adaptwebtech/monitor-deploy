import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { PipelineQueueModule } from '../pipeline-queue/pipeline-queue.module';
import { PipelineStepsModule } from '../pipeline-steps/pipeline-steps.module';
import { GatewayModule } from '../gateway/gateway.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PipelineQueueModule,
    PipelineStepsModule,
    GatewayModule,
    UsersModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
