export type DisplayEventType =
  | 'ticket.called'
  | 'queue.updated'
  | 'operator.updated';

export type TicketCalledPayload = {
  ticketId: number;
  number: string;
  serviceName?: string | null;
  counterName?: string | null;
  operatorId?: number | null;
  calledAt: string;
};

export type QueueUpdatedPayload = {
  waitingCount?: number;
  nextTickets?: Array<{
    ticketId: number;
    number: string;
    serviceName?: string | null;
  }>;
};

export type OperatorUpdatedPayload = {
  operatorId: number;
  status?: string;
  counterName?: string | null;
};

export type DisplayRealtimeEvent =
  | {
      type: 'ticket.called';
      eventId: string;
      clientKey: string;
      emittedAt: string;
      payload: TicketCalledPayload;
    }
  | {
      type: 'queue.updated';
      eventId: string;
      clientKey: string;
      emittedAt: string;
      payload: QueueUpdatedPayload;
    }
  | {
      type: 'operator.updated';
      eventId: string;
      clientKey: string;
      emittedAt: string;
      payload: OperatorUpdatedPayload;
    };
