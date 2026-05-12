import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: '/pipeline', cors: { origin: '*' } })
export class PipelineGateway {
  @WebSocketServer()
  server: Server;

  emitPipelineCreated(payload: any): void {
    this.server.emit('pipeline.created', payload);
  }

  emitPipelineUpdated(payload: any): void {
    this.server.emit('pipeline.updated', payload);
  }
}
