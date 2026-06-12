import { Injectable, MessageEvent, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subject } from 'rxjs';
import { Repository } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { RealtimeService } from '../realtime/realtime.service';

type QueueEventType =
  | 'queue.updated'
  | 'ticket.called'
  | 'ticket.updated'
  | 'ticket.enqueued';

type QueueEventPayload = {
  type: QueueEventType;
  ticketId?: number | null;
  operatorId?: number | null;
  serviceId?: number | null;
  at: string;
};

@Injectable()
export class QueueEventsService {
  private readonly eventsSubject = new Subject<MessageEvent>();

  constructor(
    @Optional()
    private readonly realtime?: RealtimeService,

    @Optional()
    @InjectRepository(Ticket)
    private readonly ticketRepo?: Repository<Ticket>,
  ) {}

  events(): Observable<MessageEvent> {
    return this.eventsSubject.asObservable();
  }

  emit(type: QueueEventType, payload: Partial<QueueEventPayload> = {}) {
    const data: QueueEventPayload = {
      ...payload,
      type,
      at: new Date().toISOString(),
    };

    this.eventsSubject.next({
      type,
      data,
    });

    void this.emitRealtime(type, data);
  }

  emitTicketCalled(payload: {
    ticketId?: number | null;
    operatorId?: number | null;
    serviceId?: number | null;
  }) {
    this.emit('ticket.called', payload);
    this.emit('queue.updated', payload);
  }

  emitQueueUpdated(payload: Partial<QueueEventPayload> = {}) {
    this.emit('queue.updated', payload);
  }

  private async emitRealtime(type: QueueEventType, payload: QueueEventPayload) {
    if (!this.realtime) return;

    const clientKey = 'staging';

    if (type === 'ticket.called' && payload.ticketId) {
      const ticket = await this.loadTicketForDisplay(payload.ticketId);

      this.realtime.emitTicketCalled(clientKey, {
        ticketId: payload.ticketId,
        number: ticket?.number ?? String(payload.ticketId),
        serviceName: ticket?.service?.name ?? null,
        counterName: ticket?.operator?.position ?? ticket?.operator?.name ?? null,
        operatorId: payload.operatorId ?? ticket?.operatorId ?? null,
        calledAt: payload.at,
      });
      return;
    }

    if (type === 'queue.updated') {
      this.realtime.emitQueueUpdated(clientKey, {});
    }
  }

  private async loadTicketForDisplay(ticketId: number) {
    if (!this.ticketRepo) return null;

    return this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: {
        service: true,
        operator: true,
      },
    });
  }
}
