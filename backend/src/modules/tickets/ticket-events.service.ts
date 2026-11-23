import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { AuditLog } from '../../entities/audit-log.entity';
import { Ticket } from '../../entities/ticket.entity';
import { TicketEvent, type TicketEventType } from '../../entities/ticket-event.entity';
import { Status } from '../../common/enums/status.enum';
import { BusinessDateService } from '../business-date/business-date.service';
import {
  eventTypeForTransition,
  recordTicketEvent,
  validDate,
} from './ticket-events.recorder';

// ---------------------------------------------------------------------------
// Tipos de la respuesta (los espeja el frontend en lib/api-client.ts)
// ---------------------------------------------------------------------------

export type TicketRouteEvent = {
  id: number | null;
  type: TicketEventType;
  occurredAt: string;
  operatorId: number | null;
  operatorName: string | null;
  operatorPosition: string | null;
  source: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  /** Segundos hasta el evento siguiente (o hasta ahora si el ticket sigue abierto). */
  secondsUntilNext: number | null;
  /** Llamado que ocurre después de haber estado ausente: alguien lo retomó. */
  afterAbsent: boolean;
};

/** Una vuelta como ausente: quién lo marcó, cuánto duró y quién lo retomó. */
export type TicketRouteAbsence = {
  markedAt: string;
  markedByName: string | null;
  markedByPosition: string | null;
  /** Segundos como ausente (hasta volver a la fila o hasta ser llamado). */
  absentSeconds: number | null;
  /** Segundos esperando de nuevo en la fila, tras reingresar y hasta ser llamado. */
  backInQueueSeconds: number | null;
  takenAt: string | null;
  takenByName: string | null;
  takenByPosition: string | null;
};

export type TicketRouteSummary = {
  /** Cuánto esperó desde que sacó el número hasta que lo empezaron a atender. */
  waitUntilAttentionSeconds: number | null;
  /** Desde que sacó el número hasta el primer llamado. */
  waitBeforeFirstCallSeconds: number | null;
  /** Tiempo total en fila (esperando a ser llamado, incluidos los reingresos). */
  waitingSeconds: number;
  /** Tiempo total como ausente. */
  absentSeconds: number;
  /** Tiempo total desde que lo llamaron hasta que se presentó (o fue marcado ausente). */
  calledSeconds: number;
  /** Tiempo en atención. */
  attentionSeconds: number;
  /** Desde la emisión hasta el último evento (o hasta ahora si sigue abierto). */
  totalSeconds: number;
  callCount: number;
  absentCount: number;
  absences: TicketRouteAbsence[];
};

export type TicketRoute = {
  ticket: {
    id: number;
    number: string;
    serviceId: number;
    serviceName: string | null;
    status: string;
    issuedForDate: string;
  };
  events: TicketRouteEvent[];
  summary: TicketRouteSummary;
  /** El ticket sigue abierto: los últimos tiempos corren hasta ahora. */
  ongoing: boolean;
  /**
   * El ticket es anterior al historial de eventos: la ruta se reconstruyó con lo
   * que quedó en el propio ticket y en la auditoría, y puede estar incompleta.
   */
  reconstructed: boolean;
};

/** Fila del listado de turnos del día (estado actual, sin recorrido). */
export type TicketRouteListItem = {
  id: number;
  number: string;
  serviceName: string | null;
  status: string;
  createdAt: string;
  /** Operador asignado hoy (el que lo tiene o lo atendió); puede ser null si sigue en fila. */
  operatorName: string | null;
  operatorPosition: string | null;
  /** Veces que fue marcado ausente. */
  absentCount: number;
};

const TERMINAL: ReadonlySet<TicketEventType> = new Set<TicketEventType>([
  'COMPLETED',
  'CANCELLED',
  'DAILY_CLOSED',
]);

const secondsBetween = (from: Date, to: Date): number =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));

const toDateOnly = (value: unknown): string => {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
};

type RawEvent = Omit<TicketRouteEvent, 'secondsUntilNext' | 'afterAbsent'> & { at: Date };

/**
 * Calcula duraciones y resumen a partir de la lista ordenada de eventos.
 * Función pura: es la que se prueba con casos concretos.
 */
export function buildRouteTimings(
  raw: RawEvent[],
  now: Date,
): { events: TicketRouteEvent[]; summary: TicketRouteSummary; ongoing: boolean } {
  const events: TicketRouteEvent[] = [];
  const last = raw[raw.length - 1];
  const ongoing = !!last && !TERMINAL.has(last.type);

  const summary: TicketRouteSummary = {
    waitUntilAttentionSeconds: null,
    waitBeforeFirstCallSeconds: null,
    waitingSeconds: 0,
    absentSeconds: 0,
    calledSeconds: 0,
    attentionSeconds: 0,
    totalSeconds: 0,
    callCount: 0,
    absentCount: 0,
    absences: [],
  };

  let seenAbsent = false;
  raw.forEach((event, index) => {
    const nextAt = raw[index + 1]?.at ?? (ongoing ? now : null);
    const seconds = nextAt ? secondsBetween(event.at, nextAt) : null;
    const { at, ...rest } = event;
    const isCall = event.type === 'CALLED' || event.type === 'TAKEN_FROM_ABSENT';
    events.push({
      ...rest,
      occurredAt: at.toISOString(),
      secondsUntilNext: seconds,
      afterAbsent: isCall && seenAbsent,
    });
    if (event.type === 'ABSENT') seenAbsent = true;

    if (seconds === null) return;
    if (event.type === 'CREATED' || event.type === 'REQUEUED') summary.waitingSeconds += seconds;
    else if (event.type === 'ABSENT') summary.absentSeconds += seconds;
    else if (event.type === 'CALLED' || event.type === 'TAKEN_FROM_ABSENT') summary.calledSeconds += seconds;
    else if (event.type === 'STARTED') summary.attentionSeconds += seconds;
  });

  // Cada ausencia: quién la marcó y quién la retomó (el siguiente llamado).
  raw.forEach((event, index) => {
    if (event.type !== 'ABSENT') return;
    const rest = raw.slice(index + 1);
    const nextAbsentIdx = rest.findIndex((e) => e.type === 'ABSENT');
    const window = nextAbsentIdx === -1 ? rest : rest.slice(0, nextAbsentIdx);
    const requeue = window.find((e) => e.type === 'REQUEUED');
    const taken = window.find((e) => e.type === 'CALLED' || e.type === 'TAKEN_FROM_ABSENT');
    const closing = window.find((e) => TERMINAL.has(e.type));
    const endOfAbsent = requeue ?? taken ?? closing;

    summary.absences.push({
      markedAt: event.at.toISOString(),
      markedByName: event.operatorName,
      markedByPosition: event.operatorPosition,
      absentSeconds: endOfAbsent
        ? secondsBetween(event.at, endOfAbsent.at)
        : ongoing
          ? secondsBetween(event.at, now)
          : null,
      backInQueueSeconds:
        requeue && taken
          ? secondsBetween(requeue.at, taken.at)
          : requeue && ongoing
            ? secondsBetween(requeue.at, now)
            : null,
      takenAt: taken ? taken.at.toISOString() : null,
      takenByName: taken?.operatorName ?? null,
      takenByPosition: taken?.operatorPosition ?? null,
    });
  });

  summary.callCount = raw.filter((e) => e.type === 'CALLED' || e.type === 'TAKEN_FROM_ABSENT').length;
  summary.absentCount = raw.filter((e) => e.type === 'ABSENT').length;

  if (raw.length) {
    const first = raw[0].at;
    const end = ongoing ? now : last.at;
    summary.totalSeconds = secondsBetween(first, end);

    const firstCall = raw.find((e) => e.type === 'CALLED' || e.type === 'TAKEN_FROM_ABSENT');
    summary.waitBeforeFirstCallSeconds = secondsBetween(first, firstCall ? firstCall.at : end);

    const attended = raw.find((e) => e.type === 'STARTED') ?? raw.find((e) => e.type === 'COMPLETED');
    summary.waitUntilAttentionSeconds = secondsBetween(first, attended ? attended.at : end);
  }

  return { events, summary, ongoing };
}

@Injectable()
export class TicketEventsService {
  constructor(
    @InjectRepository(TicketEvent)
    private readonly eventRepo: Repository<TicketEvent>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly businessDate: BusinessDateService,
  ) {}

  // -------------------------------------------------------------------------
  // Registro (lo dispara el suscriptor de TypeORM y las rutas con UPDATE masivo)
  // -------------------------------------------------------------------------

  /** Ticket recién emitido. */
  async onTicketInserted(manager: EntityManager, ticket: Ticket | undefined): Promise<void> {
    if (!ticket?.id) return;
    await recordTicketEvent(manager, {
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      serviceId: ticket.serviceId,
      eventType: 'CREATED',
      previousStatus: null,
      newStatus: ticket.status ?? Status.WAITING,
      operatorId: null,
      occurredAt: validDate(ticket.createdAt) ?? new Date(),
    });
  }

  /**
   * Ticket guardado con `save()`: si cambió de estado, deja el evento. Si el
   * cambio no trae el estado anterior (UPDATE masivo) no se puede comparar y
   * lo registra quien hizo el UPDATE.
   */
  async onTicketUpdated(
    manager: EntityManager,
    entity: Partial<Ticket> | undefined,
    previous: Ticket | undefined,
  ): Promise<void> {
    if (!entity || !previous) return;
    const next = entity.status;
    const prev = previous.status;
    if (!next || next === prev) return;

    const type = eventTypeForTransition(prev, next);
    const pick = (value: unknown): Date | null => validDate(value);

    let operatorId: number | null;
    let occurredAt: Date | null;
    switch (type) {
      case 'ABSENT':
        // Al marcar ausente se libera el operador: el que lo tenía es quien lo marcó.
        operatorId = previous.operatorId ?? null;
        occurredAt = pick(entity.absentAt);
        break;
      case 'REQUEUED':
        operatorId = null;
        occurredAt = pick(entity.requeuedAt);
        break;
      case 'CALLED':
      case 'TAKEN_FROM_ABSENT':
        operatorId = entity.operatorId ?? previous.operatorId ?? null;
        occurredAt = pick(entity.calledAt);
        break;
      case 'STARTED':
        operatorId = entity.operatorId ?? previous.operatorId ?? null;
        occurredAt = pick(entity.startedAt);
        break;
      case 'COMPLETED':
        operatorId = entity.operatorId ?? previous.operatorId ?? null;
        occurredAt = pick(entity.completedAt);
        break;
      default:
        operatorId = entity.operatorId ?? previous.operatorId ?? null;
        occurredAt = null;
    }

    await recordTicketEvent(manager, {
      ticketId: entity.id ?? previous.id,
      ticketNumber: entity.number ?? previous.number,
      serviceId: entity.serviceId ?? previous.serviceId,
      eventType: type,
      previousStatus: prev ?? null,
      newStatus: next,
      operatorId,
      occurredAt: occurredAt ?? new Date(),
      source: type === 'STARTED' ? (entity.attentionStartSource ?? 'MANUAL') : null,
    });
  }

  /** Llamado hecho con UPDATE masivo (siguiente en la fila): no pasa por `save()`. */
  async recordQueueCall(ticket: Ticket, operatorId: number, calledAt: Date): Promise<void> {
    await recordTicketEvent(this.eventRepo.manager, {
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      serviceId: ticket.serviceId,
      eventType: 'CALLED',
      previousStatus: Status.WAITING,
      newStatus: Status.CALLED,
      operatorId,
      occurredAt: calledAt,
    });
  }

  // -------------------------------------------------------------------------
  // Consulta
  // -------------------------------------------------------------------------

  /**
   * Turnos de una fecha comercial (por defecto, hoy) con su estado actual, del más
   * reciente al más antiguo. Es el listado que se muestra debajo del buscador.
   */
  async listDay(date?: string, now: Date = new Date()): Promise<TicketRouteListItem[]> {
    const businessDate = (date ?? '').trim() || this.businessDate.getBusinessDate(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      throw new BadRequestException('La fecha debe tener el formato AAAA-MM-DD.');
    }

    const tickets = await this.ticketRepo.find({
      where: { issuedForDate: businessDate as any },
      relations: { service: true, operator: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 1000,
    });
    if (tickets.length === 0) return [];

    const absentByTicket = new Map<number, number>();
    try {
      const rows = await this.eventRepo
        .createQueryBuilder('e')
        .select('e.ticketId', 'ticketId')
        .addSelect('COUNT(*)', 'total')
        .where('e.ticketId IN (:...ids)', { ids: tickets.map((t) => t.id) })
        .andWhere('e.eventType = :type', { type: 'ABSENT' })
        .groupBy('e.ticketId')
        .getRawMany<{ ticketId: number | string; total: number | string }>();
      for (const row of rows) absentByTicket.set(Number(row.ticketId), Number(row.total));
    } catch {
      // El conteo de ausentes es un extra: si falla, el listado sigue funcionando.
    }

    return tickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      serviceName: ticket.service?.name ?? null,
      status: ticket.status,
      createdAt: (validDate(ticket.createdAt) ?? new Date(0)).toISOString(),
      operatorName: ticket.operator?.name ?? null,
      operatorPosition: ticket.operator?.position ?? null,
      absentCount: absentByTicket.get(ticket.id) ?? 0,
    }));
  }

  /**
   * Ruta de un ticket por número y fecha comercial (por defecto, hoy). Puede
   * haber más de un ticket con el mismo número si hay servicios distintos.
   */
  async getRoutes(number: string, date?: string, now: Date = new Date()): Promise<TicketRoute[]> {
    const trimmed = (number ?? '').trim();
    if (!trimmed) throw new BadRequestException('Indicá el número de ticket.');

    const businessDate = (date ?? '').trim() || this.businessDate.getBusinessDate(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      throw new BadRequestException('La fecha debe tener el formato AAAA-MM-DD.');
    }

    const tickets = await this.ticketRepo.find({
      where: { number: trimmed, issuedForDate: businessDate as any },
      relations: { service: true, operator: true },
      order: { id: 'ASC' },
      take: 10,
    });

    const routes: TicketRoute[] = [];
    for (const ticket of tickets) {
      routes.push(await this.buildRoute(ticket, now));
    }
    return routes;
  }

  private async buildRoute(ticket: Ticket, now: Date): Promise<TicketRoute> {
    const stored = await this.eventRepo.find({
      where: { ticketId: ticket.id },
      order: { occurredAt: 'ASC', id: 'ASC' },
      take: 500,
    });

    const reconstructed = stored.length === 0;
    const raw: RawEvent[] = reconstructed
      ? await this.reconstruct(ticket)
      : stored.map((e) => ({
          id: e.id,
          type: e.eventType,
          at: e.occurredAt instanceof Date ? e.occurredAt : new Date(e.occurredAt),
          occurredAt: '',
          operatorId: e.operatorId ?? null,
          operatorName: e.operatorName ?? null,
          operatorPosition: e.operatorPosition ?? null,
          source: e.source ?? null,
          previousStatus: e.previousStatus ?? null,
          newStatus: e.newStatus ?? null,
        }));

    const { events, summary, ongoing } = buildRouteTimings(raw, now);

    return {
      ticket: {
        id: ticket.id,
        number: ticket.number,
        serviceId: ticket.serviceId,
        serviceName: ticket.service?.name ?? null,
        status: ticket.status,
        issuedForDate: toDateOnly(ticket.issuedForDate),
      },
      events,
      summary,
      ongoing,
      reconstructed,
    };
  }

  /**
   * Ruta de tickets anteriores al historial: se arma con las marcas que quedan en
   * el propio ticket (sólo la última vuelta) y con los "marcado ausente" de la
   * auditoría, que sí guardan quién lo marcó. Puede faltar información.
   */
  private async reconstruct(ticket: Ticket): Promise<RawEvent[]> {
    const out: RawEvent[] = [];
    const push = (
      type: TicketEventType,
      at: unknown,
      extra: Partial<RawEvent> = {},
    ): void => {
      const date = validDate(at instanceof Date ? at : at ? new Date(at as any) : null);
      if (!date) return;
      out.push({
        id: null,
        type,
        at: date,
        occurredAt: '',
        operatorId: null,
        operatorName: null,
        operatorPosition: null,
        source: null,
        previousStatus: null,
        newStatus: null,
        ...extra,
      });
    };

    const operator = ticket.operator ?? null;
    const operatorExtra = operator
      ? { operatorId: operator.id, operatorName: operator.name, operatorPosition: operator.position ?? null }
      : {};

    push('CREATED', ticket.createdAt, { newStatus: Status.WAITING });

    // "Marcado ausente" de la auditoría: guarda quién lo marcó y cuándo.
    let auditedAbsences = 0;
    try {
      const audits = await this.auditRepo.find({
        where: { eventType: 'TICKET_MARK_ABSENT', target: `Ticket ${ticket.number}` },
        order: { createdAt: 'ASC' },
        take: 200,
      });
      for (const audit of audits) {
        const meta = (audit.metadata ?? {}) as Record<string, any>;
        if (Number(meta.ticketId) !== ticket.id) continue;
        auditedAbsences += 1;
        push('ABSENT', meta.absentAt ?? audit.createdAt, {
          operatorId: audit.actorId ?? null,
          operatorName: audit.actorName ?? null,
          newStatus: Status.ABSENT,
        });
      }
    } catch {
      // Sin auditoría disponible: se sigue con lo que hay en el ticket.
    }

    if (ticket.calledAt) push('CALLED', ticket.calledAt, { ...operatorExtra, newStatus: Status.CALLED });
    if (ticket.startedAt) {
      push('STARTED', ticket.startedAt, {
        ...operatorExtra,
        source: ticket.attentionStartSource ?? null,
        newStatus: Status.IN_PROGRESS,
      });
    }
    if (!auditedAbsences && ticket.absentAt) push('ABSENT', ticket.absentAt, { newStatus: Status.ABSENT });
    if (ticket.requeuedAt) push('REQUEUED', ticket.requeuedAt, { newStatus: Status.WAITING });
    if (ticket.completedAt) push('COMPLETED', ticket.completedAt, { ...operatorExtra, newStatus: Status.COMPLETED });
    if (ticket.status === Status.DAILY_CLOSED && ticket.closedAt) {
      push('DAILY_CLOSED', ticket.closedAt, { newStatus: Status.DAILY_CLOSED, source: 'SYSTEM' });
    }

    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
}
