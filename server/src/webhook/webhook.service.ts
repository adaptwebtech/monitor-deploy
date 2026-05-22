import { Injectable, Logger } from '@nestjs/common';
import { PipelineQueueService } from '../pipeline-queue/pipeline-queue.service';
import { PipelineStepsService } from '../pipeline-steps/pipeline-steps.service';
import { UsersService } from '../users/users.service';
import { PipelineGateway } from '../gateway/pipeline.gateway';
import { WebhookEventDto } from './dto/webhook-event.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly pipelineQueueService: PipelineQueueService,
    private readonly pipelineStepsService: PipelineStepsService,
    private readonly usersService: UsersService,
    private readonly pipelineGateway: PipelineGateway,
  ) {}

  async handleEvent(dto: WebhookEventDto): Promise<void> {
    try {
      switch (dto.event) {
        case 'queued':
          await this.handleQueued(dto);
          break;
        case 'step':
          await this.handleStep(dto);
          break;
        case 'Succeeded':
          await this.handleSucceeded(dto);
          break;
        case 'Error':
          await this.handleError(dto);
          break;
        default:
          this.logger.warn(`Evento desconhecido: ${dto.event}`);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar webhook: ${err}`);
    }
  }

  private async handleQueued(dto: WebhookEventDto): Promise<void> {
    let queue = await this.pipelineQueueService.create({
      event: dto.event,
      app: dto.app,
      environment: dto.environment,
      commitSha: dto.commitSha,
      commitMessage: dto.commitMessage,
      commitAuthor: dto.commitAuthor,
      commitAuthorAvatar: dto.commitAuthorAvatar,
      commitAuthorId: dto.commitAuthorId ?? null,
      status: 'Queued',
    });

    if (dto.commitAuthorId) {
      const user = await this.usersService.findByGithubId(dto.commitAuthorId);
      if (user) {
        queue = await this.pipelineQueueService.update(queue.id, {
          id_user: user.id,
        });
      }
    }

    this.pipelineGateway.emitPipelineCreated(queue);
  }

  private async handleStep(dto: WebhookEventDto): Promise<void> {
    const queue = await this.pipelineQueueService.findByCommit(
      dto.commitSha,
      dto.app,
      dto.environment,
    );
    if (!queue) {
      this.logger.warn(`Pipeline não encontrado para commit ${dto.commitSha}`);
      return;
    }

    const updatedQueue = await this.pipelineQueueService.update(queue.id, {
      status: 'Running',
    });

    const createdStep = await this.pipelineStepsService.create({
      id_pipeline_queue: queue.id,
      event: dto.event,
      workflowName: dto.workflowName ?? '',
      stepName: dto.stepName ?? '',
    });

    if (!queue.id_user && dto.commitAuthorId) {
      const user = await this.usersService.findByGithubId(dto.commitAuthorId);
      if (user) {
        await this.pipelineQueueService.update(queue.id, { id_user: user.id });
      }
    }

    this.pipelineGateway.emitPipelineUpdated({
      ...updatedQueue,
      currentStep: createdStep.stepName,
    });
  }

  private async handleSucceeded(dto: WebhookEventDto): Promise<void> {
    const queue = await this.pipelineQueueService.findByCommit(
      dto.commitSha,
      dto.app,
      dto.environment,
    );
    if (!queue) {
      this.logger.warn(`Pipeline não encontrado para commit ${dto.commitSha}`);
      return;
    }

    const updated = await this.pipelineQueueService.update(queue.id, {
      status: 'Completed',
    });
    this.pipelineGateway.emitPipelineUpdated(updated);
  }

  private async handleError(dto: WebhookEventDto): Promise<void> {
    const queue = await this.pipelineQueueService.findByCommit(
      dto.commitSha,
      dto.app,
      dto.environment,
    );
    if (!queue) {
      this.logger.warn(`Pipeline não encontrado para commit ${dto.commitSha}`);
      return;
    }

    const updated = await this.pipelineQueueService.update(queue.id, {
      status: 'Failed',
    });
    this.pipelineGateway.emitPipelineUpdated(updated);
  }
}
