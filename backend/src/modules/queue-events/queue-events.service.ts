import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

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

  events(): Observable<MessageEvent> {
    return this.eventsSubject.asObservable();
  }

  emit(type: QueueEventType, payload: Partial<QueueEventPayload> = {}) {
    this.eventsSubject.next({
      type,
      data: {
        ...payload,
        type,
        at: new Date().toISOString(),
      },
    });
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
}
