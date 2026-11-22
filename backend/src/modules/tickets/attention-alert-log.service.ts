import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';

import { AttentionAlertLog } from '../../entities/attention-alert-log.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Status } from '../../common/enums/status.enum';
import { BusinessDateService } from '../business-date/business-date.service';

export type AttentionAlertLogDto = {
  id: number;
  ticketId: number;
  ticketNumber: string;
  serviceId: number;
  serviceName: string;
  operatorId: number | null;
  operatorName: string | null;
  maxAttentionMinutes: number;
  elapsedSeconds: number;
  exceededSeconds: number;
  businessDate: string;
  exceededAt: string;
  resolvedAt: string | null;
  finalStatus: string | null;
  /** true mientras el ticket sigue en atención. */
  ongoing: boolean;
};

export type AttentionAlertSummary = {
  businessDate: string;
  todayCount: number;
};

export type AttentionAlertDay = {
  businessDate: string;
  count: number;
  alerts: AttentionAlertLogDto[];
};

export type AttentionAlertHistory = AttentionAlertSummary & {
  days: AttentionAlertDay[];
};

export type RecordCycleResult = {
  inserted: number;
  updated: number;
  finalized: number;
};

type Evaluation = {
  limitSeconds: number;
  maxMinutes: number;
  elapsedSeconds: number;
  exceededSeconds: number;
  exceededAt: Date;
};

const DEFAULT_HISTORY_DAYS = 30;
const MAX_HISTORY_DAYS = 90;
const MAX_HISTORY_ROWS = 2000;

const asDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

@Injectable()
export class AttentionAlertLogService {
  private readonly logger = new Logger(AttentionAlertLogService.name);

  constructor(
    @InjectRepository(AttentionAlertLog)
    private readonly logRepo: Repository<AttentionAlertLog>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly businessDate: BusinessDateService,
  ) {}

  // ============================================================
  // Registro (lo ejecuta el scheduler)
  // ============================================================

  /**
   * Un ciclo de registro. Es idempotente: hay una sola fila por ticket.
   *
   *  1. Tickets en atención que ya superaron el límite -> se registran/actualizan.
   *  2. Alertas abiertas cuyo ticket terminó (o cerró el día) -> se cierran con
   *     su duración final.
   *  3. Tickets completados recientemente que excedieron y nunca se vieron
   *     (por ejemplo si el backend estuvo caído) -> se registran ya resueltos.
   */
  async recordCycle(
    now: Date = new Date(),
    completedLookbackMs: number = 15 * 60 * 1000,
  ): Promise<RecordCycleResult> {
    const result: RecordCycleResult = { inserted: 0, updated: 0, finalized: 0 };

    await this.recordInProgress(now, result);
    await this.finalizeOpen(now, result);
    await this.recordRecentlyCompleted(now, completedLookbackMs, result);

    return result;
  }

  private evaluate(ticket: Ticket, now: Date): Evaluation | null {
    const maxMinutes = ticket.service?.maxAttentionTime ?? null;
    if (!maxMinutes || maxMinutes <= 0) return null;

    const limitSeconds = maxMinutes * 60;
    const start = asDate(ticket.startedAt) ?? asDate(ticket.calledAt);
    const completedAt = asDate(ticket.completedAt);

    let elapsedSeconds: number | null = null;

    if (ticket.status === Status.COMPLETED) {
      if (typeof ticket.attentionDuration === 'number') {
        elapsedSeconds = ticket.attentionDuration;
      } else if (start && completedAt) {
        elapsedSeconds = Math.max(
          0,
          Math.round((completedAt.getTime() - start.getTime()) / 1000),
        );
      }
    } else if (ticket.status === Status.IN_PROGRESS && start) {
      elapsedSeconds = Math.max(
        0,
        Math.round((now.getTime() - start.getTime()) / 1000),
      );
    }

    if (elapsedSeconds === null || elapsedSeconds <= limitSeconds) return null;

    // Momento en que cruzó el límite. Sin inicio se reconstruye hacia atrás.
    const exceededAt = start
      ? new Date(start.getTime() + limitSeconds * 1000)
      : completedAt
        ? new Date(completedAt.getTime() - (elapsedSeconds - limitSeconds) * 1000)
        : now;

    return {
      limitSeconds,
      maxMinutes,
      elapsedSeconds,
      exceededSeconds: elapsedSeconds - limitSeconds,
      exceededAt,
    };
  }

  private buildRow(
    ticket: Ticket,
    evaluation: Evaluation,
    resolved: { resolvedAt: Date; finalStatus: string } | null,
  ): Partial<AttentionAlertLog> {
    return {
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      serviceId: ticket.serviceId,
      serviceName: ticket.service?.name ?? '',
      operatorId: ticket.operatorId ?? null,
      operatorName: ticket.operator?.name ?? null,
      maxAttentionMinutes: evaluation.maxMinutes,
      elapsedSeconds: evaluation.elapsedSeconds,
      exceededSeconds: evaluation.exceededSeconds,
      businessDate: this.businessDate.getBusinessDate(evaluation.exceededAt),
      exceededAt: evaluation.exceededAt,
      resolvedAt: resolved?.resolvedAt ?? null,
      finalStatus: resolved?.finalStatus ?? null,
    };
  }

  private async insertMissing(rows: Partial<AttentionAlertLog>[]): Promise<void> {
    if (rows.length === 0) return;
    // orIgnore: si dos ciclos se pisan, el índice único por ticket evita duplicados.
    await this.logRepo
      .createQueryBuilder()
      .insert()
      .into(AttentionAlertLog)
      .values(rows)
      .orIgnore()
      .execute();
  }

  private async recordInProgress(now: Date, result: RecordCycleResult): Promise<void> {
    const tickets = await this.ticketRepo.find({
      where: { status: Status.IN_PROGRESS } as any,
      relations: ['service', 'operator'],
    });

    const exceeded: Array<{ ticket: Ticket; evaluation: Evaluation }> = [];
    for (const ticket of tickets) {
      const evaluation = this.evaluate(ticket, now);
      if (evaluation) exceeded.push({ ticket, evaluation });
    }
    if (exceeded.length === 0) return;

    const existing = await this.logRepo.find({
      where: { ticketId: In(exceeded.map((e) => e.ticket.id)) },
    });
    const byTicket = new Map(existing.map((log) => [log.ticketId, log]));

    const toInsert: Partial<AttentionAlertLog>[] = [];

    for (const { ticket, evaluation } of exceeded) {
      const log = byTicket.get(ticket.id);

      if (!log) {
        toInsert.push(this.buildRow(ticket, evaluation, null));
        continue;
      }

      // Ya registrada y todavía abierta: se refresca el tiempo transcurrido.
      if (log.resolvedAt === null) {
        await this.logRepo.update(
          { id: log.id },
          {
            elapsedSeconds: Math.max(log.elapsedSeconds, evaluation.elapsedSeconds),
            exceededSeconds: Math.max(log.exceededSeconds, evaluation.exceededSeconds),
            operatorId: ticket.operatorId ?? log.operatorId,
            operatorName: ticket.operator?.name ?? log.operatorName,
          },
        );
        result.updated += 1;
      }
    }

    await this.insertMissing(toInsert);
    result.inserted += toInsert.length;
  }

  private async finalizeOpen(now: Date, result: RecordCycleResult): Promise<void> {
    const open = await this.logRepo.find({ where: { resolvedAt: IsNull() } });
    if (open.length === 0) return;

    const tickets = await this.ticketRepo.find({
      where: { id: In(open.map((log) => log.ticketId)) },
      relations: ['operator'],
    });
    const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));

    for (const log of open) {
      const ticket = byId.get(log.ticketId);

      // Sigue en atención: lo maneja recordInProgress.
      if (ticket && ticket.status === Status.IN_PROGRESS) continue;

      const limitSeconds = log.maxAttentionMinutes * 60;
      let resolvedAt: Date = now;
      let finalStatus = 'DELETED';
      let elapsedSeconds = log.elapsedSeconds;

      if (ticket) {
        finalStatus = ticket.status;
        const start = asDate(ticket.startedAt) ?? asDate(ticket.calledAt);
        const end =
          ticket.status === Status.COMPLETED
            ? asDate(ticket.completedAt)
            : asDate(ticket.closedAt) ?? asDate(ticket.completedAt);

        if (end) resolvedAt = end;

        let measured: number | null = null;
        if (ticket.status === Status.COMPLETED && typeof ticket.attentionDuration === 'number') {
          measured = ticket.attentionDuration;
        } else if (start && end) {
          measured = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
        }

        // Nunca se achica por debajo de lo que ya se había observado.
        if (measured !== null) elapsedSeconds = Math.max(elapsedSeconds, measured);
      }

      await this.logRepo.update(
        { id: log.id },
        {
          resolvedAt,
          finalStatus,
          elapsedSeconds,
          exceededSeconds: Math.max(0, elapsedSeconds - limitSeconds),
          operatorName: ticket?.operator?.name ?? log.operatorName,
        },
      );
      result.finalized += 1;
    }
  }

  private async recordRecentlyCompleted(
    now: Date,
    lookbackMs: number,
    result: RecordCycleResult,
  ): Promise<void> {
    const since = new Date(now.getTime() - lookbackMs);

    const tickets = await this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.service', 's')
      .leftJoinAndSelect('t.operator', 'o')
      .where('t.status = :status', { status: Status.COMPLETED })
      .andWhere('t.completedAt >= :since', { since })
      .andWhere('s.maxAttentionTime > 0')
      .getMany();

    const exceeded: Array<{ ticket: Ticket; evaluation: Evaluation }> = [];
    for (const ticket of tickets) {
      const evaluation = this.evaluate(ticket, now);
      if (evaluation) exceeded.push({ ticket, evaluation });
    }
    if (exceeded.length === 0) return;

    const existing = await this.logRepo.find({
      where: { ticketId: In(exceeded.map((e) => e.ticket.id)) },
      select: { ticketId: true },
    });
    const known = new Set(existing.map((log) => log.ticketId));

    const toInsert = exceeded
      .filter(({ ticket }) => !known.has(ticket.id))
      .map(({ ticket, evaluation }) =>
        this.buildRow(ticket, evaluation, {
          resolvedAt: asDate(ticket.completedAt) ?? now,
          finalStatus: Status.COMPLETED,
        }),
      );

    await this.insertMissing(toInsert);
    result.inserted += toInsert.length;
  }

  // ============================================================
  // Lectura (endpoints)
  // ============================================================

  /** Contador liviano para el ícono: alertas del día comercial actual. */
  async getSummary(now: Date = new Date()): Promise<AttentionAlertSummary> {
    const businessDate = this.businessDate.getBusinessDate(now);
    const todayCount = await this.logRepo.count({ where: { businessDate } });
    return { businessDate, todayCount };
  }

  /** Historial agrupado por día comercial, del más reciente al más viejo. */
  async getHistory(
    requestedDays: number = DEFAULT_HISTORY_DAYS,
    now: Date = new Date(),
  ): Promise<AttentionAlertHistory> {
    const days = Math.min(
      MAX_HISTORY_DAYS,
      Math.max(1, Math.trunc(Number.isFinite(requestedDays) ? requestedDays : DEFAULT_HISTORY_DAYS)),
    );

    const today = this.businessDate.getBusinessDate(now);
    const fromDate = this.shiftDate(today, -(days - 1));

    const rows = await this.logRepo.find({
      where: { businessDate: MoreThanOrEqual(fromDate) },
      order: { exceededAt: 'DESC' },
      take: MAX_HISTORY_ROWS,
    });

    const grouped = new Map<string, AttentionAlertLogDto[]>();
    for (const row of rows) {
      const dto = this.toDto(row);
      const bucket = grouped.get(dto.businessDate);
      if (bucket) bucket.push(dto);
      else grouped.set(dto.businessDate, [dto]);
    }

    const orderedDays = [...grouped.keys()].sort((a, b) => (a < b ? 1 : -1));

    return {
      businessDate: today,
      todayCount: grouped.get(today)?.length ?? 0,
      days: orderedDays.map((businessDate) => ({
        businessDate,
        count: grouped.get(businessDate)!.length,
        alerts: grouped.get(businessDate)!,
      })),
    };
  }

  private shiftDate(businessDate: string, deltaDays: number): string {
    const [year, month, day] = businessDate.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
    return shifted.toISOString().slice(0, 10);
  }

  private toDto(row: AttentionAlertLog): AttentionAlertLogDto {
    const businessDate =
      typeof row.businessDate === 'string'
        ? String(row.businessDate).slice(0, 10)
        : new Date(row.businessDate as unknown as Date).toISOString().slice(0, 10);

    const exceededAt = asDate(row.exceededAt) ?? new Date();
    const resolvedAt = asDate(row.resolvedAt);

    return {
      id: row.id,
      ticketId: row.ticketId,
      ticketNumber: row.ticketNumber,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      operatorId: row.operatorId ?? null,
      operatorName: row.operatorName ?? null,
      maxAttentionMinutes: row.maxAttentionMinutes,
      elapsedSeconds: row.elapsedSeconds,
      exceededSeconds: row.exceededSeconds,
      businessDate,
      exceededAt: exceededAt.toISOString(),
      resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
      finalStatus: row.finalStatus ?? null,
      ongoing: resolvedAt === null,
    };
  }
}
