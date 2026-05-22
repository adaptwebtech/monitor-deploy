import { Module } from '@nestjs/common';
import { WorkflowCleanupService } from './workflow-cleanup.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  providers: [WorkflowCleanupService],
})
export class WorkflowCleanupModule {}
