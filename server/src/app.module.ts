import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WebhookModule } from './webhook/webhook.module';
import { PipelineQueueModule } from './pipeline-queue/pipeline-queue.module';
import { PipelineStepsModule } from './pipeline-steps/pipeline-steps.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';
import { WorkflowCleanupModule } from './workflow-cleanup/workflow-cleanup.module';
import { ScheduledCleanupModule } from './scheduled-cleanup/scheduled-cleanup.module';
import { ApiKeyGuard } from './auth/api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    WebhookModule,
    PipelineQueueModule,
    PipelineStepsModule,
    DashboardModule,
    GatewayModule,
    HealthModule,
    WorkflowCleanupModule,
    ScheduledCleanupModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
