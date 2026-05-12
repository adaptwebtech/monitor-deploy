import { Module } from '@nestjs/common';
import { PipelineGateway } from './pipeline.gateway';

@Module({
  providers: [PipelineGateway],
  exports: [PipelineGateway],
})
export class GatewayModule {}
