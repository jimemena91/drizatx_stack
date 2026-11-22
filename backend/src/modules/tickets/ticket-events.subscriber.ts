import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

import { Ticket } from '../../entities/ticket.entity';
import { TicketEventsService } from './ticket-events.service';

/**
 * Deja un evento en el historial cada vez que un ticket se emite o cambia de
 * estado con `save()`. Así queda cubierto cualquier camino (operador, cola,
 * inicio automático) sin tocar la lógica de cada uno.
 *
 * Los UPDATE masivos (QueryBuilder) no traen el estado anterior y no se
 * registran desde acá: los registra quien los hace.
 *
 * Todo error se absorbe en el servicio: el historial no puede romper un ticket.
 */
@Injectable()
export class TicketEventsSubscriber implements EntitySubscriberInterface<Ticket> {
  constructor(
    dataSource: DataSource,
    private readonly events: TicketEventsService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Ticket;
  }

  async afterInsert(event: InsertEvent<Ticket>): Promise<void> {
    await this.events.onTicketInserted(event.manager, event.entity);
  }

  async afterUpdate(event: UpdateEvent<Ticket>): Promise<void> {
    await this.events.onTicketUpdated(
      event.manager,
      event.entity as Partial<Ticket> | undefined,
      event.databaseEntity as Ticket | undefined,
    );
  }
}
