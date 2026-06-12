import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import {
  DisplayRealtimeEvent,
  OperatorUpdatedPayload,
  QueueUpdatedPayload,
  TicketCalledPayload,
} from './realtime-events';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  emitTicketCalled(clientKey: string, payload: TicketCalledPayload) {
    this.emitToClient({
      type: 'ticket.called',
      eventId: this.createEventId('ticket.called', payload.ticketId),
      clientKey,
      emittedAt: new Date().toISOString(),
      payload,
    });
  }

  emitQueueUpdated(clientKey: string, payload: QueueUpdatedPayload) {
    this.emitToClient({
      type: 'queue.updated',
      eventId: this.createEventId('queue.updated'),
      clientKey,
      emittedAt: new Date().toISOString(),
      payload,
    });
  }

  emitOperatorUpdated(clientKey: string, payload: OperatorUpdatedPayload) {
    this.emitToClient({
      type: 'operator.updated',
      eventId: this.createEventId('operator.updated', payload.operatorId),
      clientKey,
      emittedAt: new Date().toISOString(),
      payload,
    });
  }

  private emitToClient(event: DisplayRealtimeEvent) {
    const room = `client:${event.clientKey}`;

    this.gateway.server.to(room).emit(event.type, event);

    this.logger.log(
      `Emitted ${event.type} eventId=${event.eventId} clientKey=${event.clientKey}`,
    );
  }

  private createEventId(type: string, entityId?: number | string | null) {
    const suffix = entityId == null ? 'global' : String(entityId);
    return `${type}:${suffix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  }
}
