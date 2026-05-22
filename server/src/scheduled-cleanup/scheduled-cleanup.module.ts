import { Module } from '@nestjs/common';
import { ScheduledCleanupService } from './scheduled-cleanup.service';

@Module({
  imports: [],
  providers: [ScheduledCleanupService],
})
export class ScheduledCleanupModule {}
