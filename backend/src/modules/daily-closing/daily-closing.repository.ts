import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, LessThan } from 'typeorm';

import { Status } from '../../common/enums/status.enum';
import { Ticket } from '../../entities/ticket.entity';
import { recordTicketEvents } from '../tickets/ticket-events.recorder';

export type DailyClosingCounts = {
  ticketsClosed: number;
  waitingClosed: number;
  calledClosed: number;
  inProgressClosed: number;
};

@Injectable()
export class DailyClosingRepository {
  constructor(private readonly dataSource: DataSource) {}

  async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  async findExistingClosureLog(manager: EntityManager, closureDate: string) {
    const rows = await manager.query(
      'SELECT id, status, tickets_closed FROM daily_closure_logs WHERE closure_date = ? LIMIT 1',
      [closureDate],
    );

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async countOpenTicketsBeforeDate(
    manager: EntityManager,
    closureDate: string,
  ): Promise<DailyClosingCounts> {
    const ticketRepo = manager.getRepository(Ticket);

    const tickets = await ticketRepo.find({
      where: {
        status: In([Status.WAITING, Status.CALLED, Status.IN_PROGRESS]),
        issuedForDate: LessThan(closureDate as any),
      } as any,
      select: ['id', 'status'],
    });

    return {
      ticketsClosed: tickets.length,
      waitingClosed: tickets.filter((ticket) => ticket.status === Status.WAITING).length,
      calledClosed: tickets.filter((ticket) => ticket.status === Status.CALLED).length,
      inProgressClosed: tickets.filter((ticket) => ticket.status === Status.IN_PROGRESS).length,
    };
  }

  async closeOpenTicketsBeforeDate(
    manager: EntityManager,
    closureDate: string,
    executedBy: string,
  ): Promise<void> {
    // El UPDATE masivo no pasa por el suscriptor del historial: se anotan antes
    // los tickets que se van a cerrar (con su operador) y se registra después.
    const toClose = await manager
      .getRepository(Ticket)
      .find({
        where: {
          status: In([Status.WAITING, Status.CALLED, Status.IN_PROGRESS]),
          issuedForDate: LessThan(closureDate as any),
        } as any,
        select: ['id', 'number', 'serviceId', 'status', 'operatorId'],
      })
      .catch(() => [] as Ticket[]);

    await manager
      .getRepository(Ticket)
      .createQueryBuilder()
      .update(Ticket)
      .set({
        status: Status.DAILY_CLOSED,
        operatorId: null,
        closedAt: () => 'CURRENT_TIMESTAMP',
        closedReason: 'DAILY_CLOSING',
        closedBy: executedBy,
      } as any)
      .where('status IN (:...statuses)', {
        statuses: [Status.WAITING, Status.CALLED, Status.IN_PROGRESS],
      })
      .andWhere('issued_for_date < :closureDate', { closureDate })
      .execute();

    const closedAt = new Date();
    await recordTicketEvents(
      manager,
      toClose.map((ticket) => ({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        serviceId: ticket.serviceId,
        eventType: 'DAILY_CLOSED' as const,
        previousStatus: ticket.status,
        newStatus: Status.DAILY_CLOSED,
        operatorId: ticket.operatorId ?? null,
        occurredAt: closedAt,
        source: 'SYSTEM',
      })),
    );
  }

  async createClosureLog(
    manager: EntityManager,
    closureDate: string,
    counts: DailyClosingCounts,
    executedBy: string,
  ): Promise<void> {
    await manager.query(
      `
        INSERT INTO daily_closure_logs (
          closure_date,
          status,
          tickets_closed,
          waiting_closed,
          called_closed,
          in_progress_closed,
          executed_at,
          executed_by,
          notes
        )
        VALUES (?, 'COMPLETED', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `,
      [
        closureDate,
        counts.ticketsClosed,
        counts.waitingClosed,
        counts.calledClosed,
        counts.inProgressClosed,
        executedBy,
        'Cierre diario ejecutado correctamente',
      ],
    );
  }
}
