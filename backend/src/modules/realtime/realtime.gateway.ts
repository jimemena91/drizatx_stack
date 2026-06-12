import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/display',
  cors: {
    origin: true,
    credentials: false,
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(@ConnectedSocket() client: Socket) {
    const clientKey = String(client.handshake.query.clientKey || 'default');
    const screen = String(client.handshake.query.screen || 'main');

    client.join(`client:${clientKey}`);
    client.join(`display:${clientKey}:${screen}`);

    this.logger.log(
      `Display socket connected id=${client.id} clientKey=${clientKey} screen=${screen}`,
    );

    client.emit('display.connected', {
      clientId: client.id,
      clientKey,
      screen,
      connectedAt: new Date().toISOString(),
    });
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Display socket disconnected id=${client.id}`);
  }

  @SubscribeMessage('display.ping')
  handlePing(@MessageBody() payload: unknown, @ConnectedSocket() client: Socket) {
    return {
      event: 'display.pong',
      data: {
        clientId: client.id,
        received: payload ?? null,
        serverTime: new Date().toISOString(),
      },
    };
  }
}
