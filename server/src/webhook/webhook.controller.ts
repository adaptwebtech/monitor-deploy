import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { SkipApiKey } from '../auth/decorators/skip-api-key.decorator';
import { WebhookService } from './webhook.service';
import { WebhookEventDto } from './dto/webhook-event.dto';

@ApiTags('Webhook')
@Controller('webhook')
@SkipApiKey()
@UseGuards(ApiKeyGuard)
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Receber evento de webhook',
    description:
      'Endpoint para receber eventos do Argo CI/CD. Requer header apikey válido. Processa de forma assíncrona (fire and forget).',
  })
  @ApiResponse({ status: 201, description: 'Evento recebido com sucesso.' })
  @ApiResponse({ status: 401, description: 'API key inválida ou ausente.' })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos no corpo da requisição.',
  })
  handleWebhook(@Body() dto: WebhookEventDto) {
    console.dir({ webhook: dto }, { depth: null });
    setImmediate(() => {
      void this.webhookService
        .handleEvent(dto)
        .catch((err) => this.logger.error(err));
    });
    return { message: 'Received' };
  }
}
