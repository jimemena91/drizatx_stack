import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Ticket } from '../../entities/ticket.entity';
import { TicketEvent } from '../../entities/ticket-event.entity';
import { Status } from '../../common/enums/status.enum';
import { buildRouteTimings, storedEventToRaw } from '../tickets/ticket-events.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

export const DEFAULT_WAIT_THRESHOLD_MIN = 30;
const MAX_EVENT_ROWS = 20000;
const MAX_TICKET_ROWS = 20000;
const CHUNK = 500;

export type AbsenceDetail = {
  ticketId: number;
  ticketNumber: string;
  serviceId: number;
  markedAt: string;
  markedByOperatorId: number | null;
  markedByName: string | null;
  markedByPosition: string | null;
  /** Segundos como ausente; null si no hay dato. */
  absentSeconds: number | null;
  takenAt: string | null;
  takenByOperatorId: number | null;
  takenByName: string | null;
  takenByPosition: string | null;
};

export type AbsenceOperatorRow = {
  operatorId: number | null;
  name: string;
  position: string | null;
  /** Veces que este operador marcó un turno como ausente. */
  markedAbsent: number;
  /** Veces que este operador retomó un turno que estaba ausente. */
  retaken: number;
  /** Promedio de lo que duraron los ausentes que marcó (segundos). */
  avgAbsentSeconds: number | null;
  /** Ausentes que marcó y nadie retomó. */
  notRetaken: number;
};

export type LongWaitRow = {
  ticketId: number;
  ticketNumber: string;
  serviceName: string | null;
  status: string;
  createdAt: string;
  waitSeconds: number;
  /** El turno todavía no fue atendido: la espera sigue corriendo. */
  ongoing: boolean;
  absentCount: number;
};

export type AbsenceReport = {
  thresholdMin: number;
  absences: {
    total: number;
    ticketsWithAbsence: number;
    avgAbsentSeconds: number | null;
    maxAbsentSeconds: number | null;
    notRetaken: number;
  };
  byOperator: AbsenceOperatorRow[];
  details: AbsenceDetail[];
  longWaits: {
    /** Turnos emitidos en el período. */
    totalTickets: number;
    overThreshold: number;
    overThresholdPct: number | null;
    avgWaitSeconds: number | null;
    maxWaitSeconds: number | null;
    rows: LongWaitRow[];
  };
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && value) {
    const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const secondsBetween = (from: Date, to: Date): number =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));

const average = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

const OPEN_STATUSES: ReadonlySet<string> = new Set([Status.WAITING, Status.CALLED, Status.ABSENT]);

@Injectable()
export class ReportsAbsencesService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(TicketEvent) private readonly eventsRepo: Repository<TicketEvent>,
  ) {}

  /**
   * Ausentes por operador, tiempo de ausencia y turnos con espera larga, a partir
   * del historial de eventos. Sólo cubre desde que el historial está activo:
   * los turnos anteriores no tienen eventos y no se cuentan acá.
   */
  async build(q: ReportsQueryDto, listLimit = 50, now: Date = new Date()): Promise<AbsenceReport> {
    const thresholdMin = q.waitThresholdMin && q.waitThresholdMin > 0 ? q.waitThresholdMin : DEFAULT_WAIT_THRESHOLD_MIN;
    const [absencePart, waitPart] = await Promise.all([
      this.buildAbsences(q, now),
      this.buildLongWaits(q, thresholdMin, listLimit, now),
    ]);
    return { thresholdMin, ...absencePart, longWaits: waitPart };
  }

  // ---------------------------------------------------------------------------
  // Ausentes
  // ---------------------------------------------------------------------------
  private async buildAbsences(
    q: ReportsQueryDto,
    now: Date,
  ): Promise<Pick<AbsenceReport, 'absences' | 'byOperator' | 'details'>> {
    const from = q.from ? new Date(q.from) : null;
    const to = q.to ? new Date(q.to) : null;

    const qb = this.eventsRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.ticketId', 'ticketId')
      .where('e.eventType = :type', { type: 'ABSENT' });
    if (from) qb.andWhere('e.occurredAt >= :from', { from });
    if (to) qb.andWhere('e.occurredAt <= :to', { to });
    if (q.serviceId) qb.andWhere('e.serviceId = :serviceId', { serviceId: q.serviceId });
    const idRows = await qb.limit(MAX_TICKET_ROWS).getRawMany<{ ticketId: number | string }>();
    const ticketIds = idRows.map((r) => Number(r.ticketId));

    const details: AbsenceDetail[] = [];
    let eventBudget = MAX_EVENT_ROWS;
    for (let i = 0; i < ticketIds.length && eventBudget > 0; i += CHUNK) {
      const chunk = ticketIds.slice(i, i + CHUNK);
      const events = await this.eventsRepo.find({
        where: { ticketId: In(chunk) },
        order: { ticketId: 'ASC', occurredAt: 'ASC', id: 'ASC' },
        take: eventBudget,
      });
      eventBudget -= events.length;

      const byTicket = new Map<number, TicketEvent[]>();
      for (const event of events) {
        const list = byTicket.get(event.ticketId) ?? [];
        list.push(event);
        byTicket.set(event.ticketId, list);
      }

      for (const [ticketId, list] of byTicket) {
        const { summary } = buildRouteTimings(list.map(storedEventToRaw), now);
        for (const absence of summary.absences) {
          const markedAt = new Date(absence.markedAt);
          if (from && markedAt < from) continue;
          if (to && markedAt > to) continue;
          if (q.operatorId && absence.markedByOperatorId !== q.operatorId) continue;
          details.push({
            ticketId,
            ticketNumber: list[0].ticketNumber,
            serviceId: list[0].serviceId,
            markedAt: absence.markedAt,
            markedByOperatorId: absence.markedByOperatorId,
            markedByName: absence.markedByName,
            markedByPosition: absence.markedByPosition,
            absentSeconds: absence.absentSeconds,
            takenAt: absence.takenAt,
            takenByOperatorId: absence.takenByOperatorId,
            takenByName: absence.takenByName,
            takenByPosition: absence.takenByPosition,
          });
        }
      }
    }

    details.sort((a, b) => a.markedAt.localeCompare(b.markedAt));

    const rows = new Map<string, AbsenceOperatorRow & { durations: number[] }>();
    const rowFor = (id: number | null, name: string | null, position: string | null) => {
      const key = id !== null ? `id:${id}` : `name:${name ?? ''}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          operatorId: id,
          name: name ?? 'Operador no registrado',
          position,
          markedAbsent: 0,
          retaken: 0,
          avgAbsentSeconds: null,
          notRetaken: 0,
          durations: [],
        };
        rows.set(key, row);
      }
      return row;
    };

    for (const d of details) {
      const marker = rowFor(d.markedByOperatorId, d.markedByName, d.markedByPosition);
      marker.markedAbsent += 1;
      if (d.absentSeconds !== null) marker.durations.push(d.absentSeconds);
      if (!d.takenAt) marker.notRetaken += 1;
      if (d.takenAt) {
        const taker = rowFor(d.takenByOperatorId, d.takenByName, d.takenByPosition);
        taker.retaken += 1;
      }
    }

    const byOperator = [...rows.values()]
      .map(({ durations, ...row }) => ({ ...row, avgAbsentSeconds: average(durations) }))
      .sort((a, b) => b.markedAbsent - a.markedAbsent || b.retaken - a.retaken || a.name.localeCompare(b.name));

    const allDurations = details.map((d) => d.absentSeconds).filter((v): v is number => v !== null);
    return {
      absences: {
        total: details.length,
        ticketsWithAbsence: new Set(details.map((d) => d.ticketId)).size,
        avgAbsentSeconds: average(allDurations),
        maxAbsentSeconds: allDurations.length ? Math.max(...allDurations) : null,
        notRetaken: details.filter((d) => !d.takenAt).length,
      },
      byOperator,
      details,
    };
  }

  // ---------------------------------------------------------------------------
  // Esperas largas: desde que sacó el número hasta que empezó la atención
  // ---------------------------------------------------------------------------
  private async buildLongWaits(
    q: ReportsQueryDto,
    thresholdMin: number,
    listLimit: number,
    now: Date,
  ): Promise<AbsenceReport['longWaits']> {
    const qb = this.ticketsRepo
      .createQueryBuilder('t')
      .leftJoin('t.service', 's')
      .leftJoin(TicketEvent, 'e', 'e.ticketId = t.id')
      .select('t.id', 'id')
      .addSelect('t.number', 'number')
      .addSelect('t.status', 'status')
      .addSelect('t.createdAt', 'createdAt')
      .addSelect('t.startedAt', 'startedAt')
      .addSelect('t.completedAt', 'completedAt')
      .addSelect('s.name', 'serviceName')
      .addSelect(`MIN(CASE WHEN e.eventType = 'STARTED' THEN e.occurredAt END)`, 'firstStarted')
      .addSelect(`MIN(CASE WHEN e.eventType = 'COMPLETED' THEN e.occurredAt END)`, 'firstCompleted')
      .addSelect(`SUM(CASE WHEN e.eventType = 'ABSENT' THEN 1 ELSE 0 END)`, 'absentCount')
      .where('t.status <> :cancelled', { cancelled: Status.CANCELLED });
    if (q.from) qb.andWhere('t.createdAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('t.createdAt <= :to', { to: new Date(q.to) });
    if (q.serviceId) qb.andWhere('t.serviceId = :serviceId', { serviceId: q.serviceId });
    qb.groupBy('t.id')
      .addGroupBy('t.number')
      .addGroupBy('t.status')
      .addGroupBy('t.createdAt')
      .addGroupBy('t.startedAt')
      .addGroupBy('t.completedAt')
      .addGroupBy('s.name')
      .limit(MAX_TICKET_ROWS);

    const raw = await qb.getRawMany<Record<string, unknown>>();

    const thresholdSeconds = thresholdMin * 60;
    const waits: LongWaitRow[] = [];
    const allWaits: number[] = [];

    for (const row of raw) {
      const createdAt = toDate(row.createdAt);
      if (!createdAt) continue;
      const attended =
        toDate(row.firstStarted) ??
        toDate(row.firstCompleted) ??
        toDate(row.startedAt) ??
        toDate(row.completedAt);
      const status = String(row.status);

      let waitSeconds: number;
      let ongoing = false;
      if (attended) {
        waitSeconds = secondsBetween(createdAt, attended);
      } else if (OPEN_STATUSES.has(status)) {
        waitSeconds = secondsBetween(createdAt, now);
        ongoing = true;
      } else {
        continue; // cerrado por cierre diario sin atención: no hay espera medible
      }
      allWaits.push(waitSeconds);

      if (waitSeconds > thresholdSeconds) {
        waits.push({
          ticketId: Number(row.id),
          ticketNumber: String(row.number),
          serviceName: row.serviceName ? String(row.serviceName) : null,
          status,
          createdAt: createdAt.toISOString(),
          waitSeconds,
          ongoing,
          absentCount: Number(row.absentCount ?? 0),
        });
      }
    }

    waits.sort((a, b) => b.waitSeconds - a.waitSeconds);
    return {
      totalTickets: allWaits.length,
      overThreshold: waits.length,
      overThresholdPct: allWaits.length ? Math.round((waits.length / allWaits.length) * 1000) / 10 : null,
      avgWaitSeconds: average(allWaits),
      maxWaitSeconds: allWaits.length ? Math.max(...allWaits) : null,
      rows: waits.slice(0, listLimit),
    };
  }
}
