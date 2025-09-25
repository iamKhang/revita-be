import { Module } from '@nestjs/common';
import { CounterWebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Module({
  providers: [CounterWebSocketGateway, WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}
