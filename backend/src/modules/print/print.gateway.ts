import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrintBridgeService } from './print-bridge.service';
import { PrintService } from './print.service';

interface BridgeHelloMessage {
  bridgeId: string;
}

interface BridgeHeartbeatMessage {
  bridgeId: string;
}

interface PrintJobAckMessage {
  bridgeId: string;
  jobId: string;
  status: 'RECEIVED' | 'PRINTED' | 'FAILED';
  error?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class PrintGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PrintGateway.name);

  constructor(
    private readonly printService: PrintService,
    private readonly printBridgeService: PrintBridgeService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Print socket connected: ${client.id}`);
    client.emit('print:connected', {
      ok: true,
      socketId: client.id,
      message: 'Connected to print gateway',
    });
  }

  handleDisconnect(client: Socket) {
    const removed =
      this.printBridgeService.unregisterConnectionBySocketId(client.id);

    this.logger.log(
      `Print socket disconnected: ${client.id} | bridge removed: ${removed}`,
    );
  }

  @SubscribeMessage('print:hello')
  onHello(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BridgeHelloMessage,
  ) {
    const session = this.printBridgeService.registerConnection(
      body.bridgeId,
      client.id,
    );

    client.join(`bridge:${body.bridgeId}`);

    this.logger.log(
      `Bridge registered | bridgeId=${body.bridgeId} | socketId=${client.id}`,
    );

    return {
      event: 'print:hello:ack',
      data: {
        ok: true,
        bridgeId: session.bridgeId,
        socketId: session.socketId,
        connectedAt: session.connectedAt,
        serverStatus: this.printService.getStatus(),
      },
    };
  }

  @SubscribeMessage('print:heartbeat')
  onHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BridgeHeartbeatMessage,
  ) {
    const session = this.printBridgeService.updateHeartbeat(body.bridgeId);

    if (!session) {
      this.logger.warn(
        `Heartbeat rejected | unknown bridgeId=${body.bridgeId} | socketId=${client.id}`,
      );

      return {
        event: 'print:heartbeat:ack',
        data: {
          ok: false,
          reason: 'BRIDGE_NOT_REGISTERED',
        },
      };
    }

    return {
      event: 'print:heartbeat:ack',
      data: {
        ok: true,
        bridgeId: session.bridgeId,
        lastHeartbeatAt: session.lastHeartbeatAt,
      },
    };
  }

  @SubscribeMessage('print:list-bridges')
  onListBridges() {
    return {
      event: 'print:list-bridges:ack',
      data: {
        ok: true,
        bridges: this.printBridgeService.listConnectedBridges(),
      },
    };
  }

  @SubscribeMessage('print:job:ack')
  onPrintJobAck(@MessageBody() body: PrintJobAckMessage) {
    this.logger.log(
      `print:job:ack | bridgeId=${body.bridgeId} | jobId=${body.jobId} | status=${body.status}${body.error ? ` | error=${body.error}` : ''}`,
    );

    return {
      event: 'print:job:ack:server',
      data: {
        ok: true,
      },
    };
  }

  emitPrintJobToBridge(
    bridgeId: string,
    data: {
      jobId: string;
      createdAt: string;
      payload: {
        ticketNumber: string;
        serviceName?: string;
        clientName?: string;
      };
    },
  ) {
    this.server.to(`bridge:${bridgeId}`).emit('print:job', data);
  }
}
