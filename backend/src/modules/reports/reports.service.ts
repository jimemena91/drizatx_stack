import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportSnapshot } from '../../entities/report-snapshot.entity';
import { CreateSnapshotDto, ListSnapshotsQueryDto } from './dto/create-snapshot.dto';
import { Operator } from '../../entities/operator.entity';

type ResolvedCols = {
  table: string;
  created?: string;
  attended?: string; // inicio de atención (si no existe, caeremos a created)
  closed?: string;
  status?: string;
  number?: string;
  operatorId?: string;
  serviceId?: string;
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(ReportSnapshot) private readonly snapshotsRepo: Repository<ReportSnapshot>,
    @InjectRepository(Operator) private readonly operatorsRepo: Repository<Operator>,
  ) {}

  // ---------- Utils ----------
  private ensureValidRange(q: ReportsQueryDto) {
    if (q.from && q.to) {
      const from = new Date(q.from).getTime();
      const to = new Date(q.to).getTime();
      if (isNaN(from) || isNaN(to)) throw new BadRequestException('Parámetros from/to no son fechas ISO válidas.');
      if (from >= to) throw new BadRequestException('"from" debe ser menor que "to".');
    }
  }

  private toSnake(s: string) {
    return s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).replace(/^_/, '');
  }

  /** Descubre nombres REALES en BD para la tabla tickets y mapea sinónimos. */
  private async resolveTicketColumns(): Promise<ResolvedCols> {
    const meta = this.ticketsRepo.metadata;
    const table = (meta.tablePath ?? meta.tableName) as string;
    const rows: Array<{ Field: string }> = await this.ticketsRepo.query(`SHOW COLUMNS FROM \`${table}\``);
    const dbCols = new Set(rows.map((r) => r.Field));

    const pick = (...cands: string[]) => {
      // 1) por metadata.propertyName
      for (const c of cands) {
        const col = meta.findColumnWithPropertyName(c);
        if (col && dbCols.has(col.databaseName)) return col.databaseName;
      }
      // 2) exacto en BD
      for (const c of cands) if (dbCols.has(c)) return c;
      // 3) snake(candidato)
      for (const c of cands) {
        const snake = this.toSnake(c);
        if (dbCols.has(snake)) return snake;
      }
      return undefined;
    };

    const created   = pick('createdAt','created_at','created','fecha_creacion','createdTime');
    // “inicio de atención”: probamos varios sinónimos; si no está, luego caeremos a created
    const attended  = pick(
      'attendedAt','attended_at',
      'servedAt','served_at',
      'calledAt','called_at',
      'startedAt','started_at',
      'startServiceAt','start_service_at',
      'attentionStartAt','attention_started_at'
    );
    const closed    = pick('closedAt','closed_at','finishedAt','finished_at','endedAt','ended_at','resolvedAt','resolved_at');
    const status    = pick('status','state','ticket_status');
    const number    = pick('number','ticketNumber','ticket_number','turn_number','turno');
    const operatorId= pick('operatorId','operator_id','agentId','agent_id','userId','user_id');
    const serviceId = pick('serviceId','service_id','queueId','queue_id');

    return { table, created, attended, closed, status, number, operatorId, serviceId };
  }

  /** Filtros NO temporales usando nombres reales. */
  private applyFilters(qb: SelectQueryBuilder<Ticket>, q: ReportsQueryDto, cols: ResolvedCols) {
    if (q.serviceId && cols.serviceId) qb.andWhere(`t.${cols.serviceId} = :serviceId`, { serviceId: q.serviceId });
    if (q.operatorId && cols.operatorId) qb.andWhere(`t.${cols.operatorId} = :operatorId`, { operatorId: q.operatorId });
    if (q.ticketNumberFrom && cols.number) qb.andWhere(`t.${cols.number} >= :tnf`, { tnf: q.ticketNumberFrom });
    if (q.ticketNumberTo && cols.number) qb.andWhere(`t.${cols.number} <= :tnt`, { tnt: q.ticketNumberTo });
    return qb;
  }

  // ---------- TZ helper ----------
  private getTzOffsetSeconds(tz?: string): number {
    const fallback = -3 * 3600;
    const zone = tz && tz.trim() ? tz : 'America/Argentina/Mendoza';
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' });
      const parts = fmt.formatToParts(new Date());
      const off = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-3';
      const m = off.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
      if (!m) return fallback;
      const h = parseInt(m[1], 10);
      const mm = m[2] ? parseInt(m[2], 10) : 0;
      return h * 3600 + Math.sign(h) * mm * 60;
    } catch {
      return fallback;
    }
  }

  // =========================================================
  // SUMMARY (en vivo)
  // =========================================================
  async summary(q: ReportsQueryDto) {
    this.ensureValidRange(q);
    const cols = await this.resolveTicketColumns();

    if (!cols.created) throw new BadRequestException('No encontré columna de creación en tickets (createdAt/created_at).');

    // Si no hay “inicio de atención”, seguimos respondiendo: contadores OK, tiempos con null.
    const hasAttended = !!cols.attended;

    try {
      const created = `t.${cols.created}`;
      const attended = hasAttended ? `t.${cols.attended}` : created;
      const closed = cols.closed ? `t.${cols.closed}` : null;
      const status = cols.status ? `t.${cols.status}` : `t.status`;

      const qb = this.ticketsRepo.createQueryBuilder('t')
        .select([
          'COUNT(*) as total',
          `SUM(CASE WHEN ${status} = 'COMPLETED' THEN 1 ELSE 0 END) as attended`,
          `SUM(CASE WHEN ${status} = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled`,
          `SUM(CASE WHEN ${status} = 'ABANDONED' THEN 1 ELSE 0 END) as abandoned`,
          hasAttended
            ? `AVG(TIMESTAMPDIFF(SECOND, ${created}, ${attended})) as tme_sec`
            : `NULL as tme_sec`,
          closed && hasAttended
            ? `AVG(TIMESTAMPDIFF(SECOND, ${attended}, ${closed})) as tma_sec`
            : `NULL as tma_sec`,
          closed
            ? `AVG(TIMESTAMPDIFF(SECOND, ${created}, ${closed})) as lead_sec`
            : `NULL as lead_sec`,
        ]);

      // Rango: si hay attended, por attended; si no, por created
      if (q.from) qb.andWhere(`${hasAttended ? attended : created} >= :from`, { from: q.from });
      if (q.to)   qb.andWhere(`${hasAttended ? attended : created} <= :to`,   { to: q.to });

      this.applyFilters(qb, q, cols);

      const raw = await qb.getRawOne<{
        total: string; attended: string; cancelled: string; abandoned: string;
        tme_sec: string | null; tma_sec: string | null; lead_sec: string | null;
      }>();

      // Pico por bucket (UNIX_TIMESTAMP + offset)
      const offsetSec = this.getTzOffsetSeconds(q.tz);
      const bucketSeconds = q.granularity === 'hour' ? 3600 : 86400;

      const peakQb = this.ticketsRepo.createQueryBuilder('t')
        .select(`
          FROM_UNIXTIME(
            FLOOR((UNIX_TIMESTAMP(${hasAttended ? attended : created}) + :offset) / :bucket) * :bucket - :offset
          ) as bucket
        `)
        .addSelect('COUNT(*) as c')
        .where(`${status} = 'COMPLETED'`)
        .setParameters({ offset: offsetSec, bucket: bucketSeconds });

      // si hay attended usamos NOT NULL; si no, no sirve aplicar ese filtro
      if (hasAttended) peakQb.andWhere(`${attended} IS NOT NULL`);

      if (q.from) peakQb.andWhere(`${hasAttended ? attended : created} >= :from`, { from: q.from });
      if (q.to)   peakQb.andWhere(`${hasAttended ? attended : created} <= :to`,   { to: q.to });

      this.applyFilters(peakQb, q, cols);

      const peak = await peakQb.groupBy('bucket').orderBy('c', 'DESC').limit(1)
        .getRawOne<{ bucket?: string; c?: string }>();

      const operatorMetrics = await this.buildOperatorMetrics(q, cols);

      return {
        totals: {
          total: Number(raw?.total ?? 0),
          attended: Number(raw?.attended ?? 0),
          cancelled: Number(raw?.cancelled ?? 0),
          abandoned: Number(raw?.abandoned ?? 0),
        },
        kpis: {
          tmeSec: raw?.tme_sec != null ? Math.round(Number(raw.tme_sec)) : null,
          tmaSec: raw?.tma_sec != null ? Math.round(Number(raw.tma_sec)) : null,
          leadSec: raw?.lead_sec != null ? Math.round(Number(raw.lead_sec)) : null,
          slaPct: null,
          totalInQueue: null,
          peakBucket: peak?.bucket ?? null,
        },
        operators: operatorMetrics,
      };
    } catch (err) {
      this.logger.error('summary failed', err);
      throw err;
    }
  }

  private async buildOperatorMetrics(q: ReportsQueryDto, cols: ResolvedCols) {
    if (!cols.operatorId) return [];

    const created = `t.${cols.created}`;
    const status = cols.status ? `t.${cols.status}` : `t.status`;
    const operatorId = `t.${cols.operatorId}`;
    const serviceId = cols.serviceId ? `t.${cols.serviceId}` : null;
    const hasAttended = !!cols.attended;
    const attended = hasAttended ? `t.${cols.attended}` : null;
    const hasClosed = !!cols.closed;
    const closed = hasClosed ? `t.${cols.closed}` : null;
    const timeRef = hasAttended ? `COALESCE(${attended}, ${created})` : created;

    const qb = this.ticketsRepo.createQueryBuilder('t')
      .select(`${operatorId} as operatorId`)
      .where(`${operatorId} IS NOT NULL`);

    if (q.from) qb.andWhere(`${hasAttended ? attended! : created} >= :from`, { from: q.from });
    if (q.to) qb.andWhere(`${hasAttended ? attended! : created} <= :to`, { to: q.to });

    this.applyFilters(qb, q, cols);

    qb.addSelect('COUNT(*)', 'totalTickets')
      .addSelect(`SUM(CASE WHEN ${status} = 'COMPLETED' THEN 1 ELSE 0 END)`, 'completedTickets')
      .addSelect(`SUM(CASE WHEN ${status} = 'CANCELLED' THEN 1 ELSE 0 END)`, 'cancelledTickets')
      .addSelect(`SUM(CASE WHEN ${status} = 'ABANDONED' THEN 1 ELSE 0 END)`, 'abandonedTickets')
      .addSelect(`MIN(${timeRef})`, 'firstActivityAt')
      .addSelect(`MAX(${timeRef})`, 'lastActivityAt')
      .addSelect(`TIMESTAMPDIFF(SECOND, MIN(${timeRef}), MAX(${timeRef}))`, 'activeSpanSec');

    if (serviceId) {
      qb.addSelect(`COUNT(DISTINCT ${serviceId})`, 'serviceCount');
    } else {
      qb.addSelect('0', 'serviceCount');
    }

    if (hasAttended) {
      qb.addSelect(
        `AVG(CASE WHEN ${attended} IS NOT NULL THEN TIMESTAMPDIFF(SECOND, ${created}, ${attended}) END)`,
        'avgWaitSec',
      ).addSelect(
        `SUM(CASE WHEN ${attended} IS NOT NULL THEN TIMESTAMPDIFF(SECOND, ${created}, ${attended}) ELSE 0 END)`,
        'totalWaitSec',
      );
    } else {
      qb.addSelect('NULL', 'avgWaitSec').addSelect('NULL', 'totalWaitSec');
    }

    if (hasAttended && hasClosed) {
      qb.addSelect(
        `AVG(CASE WHEN ${attended} IS NOT NULL AND ${closed} IS NOT NULL THEN TIMESTAMPDIFF(SECOND, ${attended}, ${closed}) END)`,
        'avgHandleSec',
      ).addSelect(
        `SUM(CASE WHEN ${attended} IS NOT NULL AND ${closed} IS NOT NULL THEN TIMESTAMPDIFF(SECOND, ${attended}, ${closed}) ELSE 0 END)`,
        'totalHandleSec',
      );
    } else {
      qb.addSelect('NULL', 'avgHandleSec').addSelect('NULL', 'totalHandleSec');
    }

    if (hasClosed) {
      qb.addSelect(
        `AVG(CASE WHEN ${closed} IS NOT NULL THEN TIMESTAMPDIFF(SECOND, ${created}, ${closed}) END)`,
        'avgLeadSec',
      );
    } else {
      qb.addSelect('NULL', 'avgLeadSec');
    }

    const rows = await qb.groupBy(operatorId).getRawMany<{
      operatorId: number;
      totalTickets: string;
      completedTickets: string;
      cancelledTickets: string;
      abandonedTickets: string;
      serviceCount: string;
      avgWaitSec: string | null;
      totalWaitSec: string | null;
      avgHandleSec: string | null;
      totalHandleSec: string | null;
      avgLeadSec: string | null;
      firstActivityAt: string | null;
      lastActivityAt: string | null;
      activeSpanSec: string | null;
    }>();

    if (!rows.length) return [];

    const ids = rows.map((r) => Number(r.operatorId)).filter((id) => Number.isFinite(id));
    const operators = ids.length
      ? await this.operatorsRepo
          .createQueryBuilder('o')
          .leftJoinAndSelect('o.operatorRoles', 'or')
          .leftJoinAndSelect('or.role', 'role')
          .whereInIds(ids)
          .getMany()
      : [];

    const opMap = new Map<number, Operator>();
    operators.forEach((op) => opMap.set(op.id, op));

    return rows
      .map((row) => {
        const op = opMap.get(Number(row.operatorId));
        const total = Number(row.totalTickets ?? 0);
        const completed = Number(row.completedTickets ?? 0);
        const cancelled = Number(row.cancelledTickets ?? 0);
        const abandoned = Number(row.abandonedTickets ?? 0);
        const serviceCount = Number(row.serviceCount ?? 0);
        const avgWaitSec = row.avgWaitSec != null ? Math.round(Number(row.avgWaitSec)) : null;
        const avgHandleSec = row.avgHandleSec != null ? Math.round(Number(row.avgHandleSec)) : null;
        const avgLeadSec = row.avgLeadSec != null ? Math.round(Number(row.avgLeadSec)) : null;
        const totalWaitSec = row.totalWaitSec != null ? Math.round(Number(row.totalWaitSec)) : null;
        const totalHandleSec = row.totalHandleSec != null ? Math.round(Number(row.totalHandleSec)) : null;
        const spanSec = row.activeSpanSec != null ? Math.max(Number(row.activeSpanSec), 0) : null;
        let throughputPerHour: number | null = null;
        if (spanSec && spanSec > 0) {
          throughputPerHour = Number((completed / (spanSec / 3600)).toFixed(2));
        }
        const occupancyPct = spanSec && spanSec > 0 && totalHandleSec != null
          ? Number(((totalHandleSec / spanSec) * 100).toFixed(1))
          : null;
        const attendanceRatePct = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : null;

        const firstActivity = row.firstActivityAt ? new Date(row.firstActivityAt) : null;
        const lastActivity = row.lastActivityAt ? new Date(row.lastActivityAt) : null;

        return {
          operatorId: Number(row.operatorId),
          name: op?.name ?? `Operador ${row.operatorId}`,
          position: op?.position ?? null,
          role: op?.role ?? null,
          active: op?.active ?? false,
          totalTickets: total,
          completedTickets: completed,
          cancelledTickets: cancelled,
          abandonedTickets: abandoned,
          serviceCount,
          avgWaitSec,
          avgHandleSec,
          avgLeadSec,
          totalWaitSec,
          totalHandleSec,
          throughputPerHour,
          occupancyPct,
          attendanceRatePct,
          firstActivityAt: firstActivity ? firstActivity.toISOString() : null,
          lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
        };
      })
      .sort((a, b) => b.completedTickets - a.completedTickets);
  }

  // =========================================================
  // THROUGHPUT (en vivo)
  // =========================================================
  async throughput(q: ReportsQueryDto) {
    this.ensureValidRange(q);
    const cols = await this.resolveTicketColumns();

    if (!cols.created) throw new BadRequestException('No encontré columna de creación en tickets (createdAt/created_at).');

    const hasAttended = !!cols.attended;
    const created = `t.${cols.created}`;
    const attendedOrCreated = hasAttended ? `t.${cols.attended}` : created;
    const status = cols.status ? `t.${cols.status}` : `t.status`;

    try {
      const offsetSec = this.getTzOffsetSeconds(q.tz);
      const bucketSeconds = q.granularity === 'hour' ? 3600 : 86400;

      const qb = this.ticketsRepo.createQueryBuilder('t')
        .select(`
          FROM_UNIXTIME(
            FLOOR((UNIX_TIMESTAMP(${attendedOrCreated}) + :offset) / :bucket) * :bucket - :offset
          ) as bucket
        `)
        .addSelect('COUNT(*) as attended') // “atendidos” si hay attended; si no, “creados” por bucket
        .where(`${status} = 'COMPLETED'`)
        .setParameters({ offset: offsetSec, bucket: bucketSeconds });

      if (hasAttended) qb.andWhere(`${attendedOrCreated} IS NOT NULL`);

      if (q.from) qb.andWhere(`${attendedOrCreated} >= :from`, { from: q.from });
      if (q.to)   qb.andWhere(`${attendedOrCreated} <= :to`,   { to: q.to });

      this.applyFilters(qb, q, cols);

      // avgWaitSec: sólo si existe attended
      if (hasAttended) {
        qb.addSelect(`AVG(TIMESTAMPDIFF(SECOND, ${created}, ${attendedOrCreated})) as avgWaitSec`);
      } else {
        qb.addSelect('NULL as avgWaitSec');
      }

      const rows = await qb.groupBy('bucket').orderBy('bucket', 'ASC')
        .getRawMany<{ bucket: string; attended: string; avgWaitSec: string | null }>();

      return rows.map(r => ({
        bucket: r.bucket,
        attended: Number(r.attended ?? 0),
        avgWaitSec: r.avgWaitSec != null ? Math.round(Number(r.avgWaitSec)) : null,
      }));
    } catch (err) {
      this.logger.error('throughput failed', err);
      throw err;
    }
  }

  // ---------- Snapshots ----------
  async createSnapshot(dto: CreateSnapshotDto) {
    const filters: ReportsQueryDto = {
      from: dto.from,
      to: dto.to,
      serviceId: dto.serviceId,
      operatorId: dto.operatorId,
      ticketNumberFrom: dto.ticketNumberFrom,
      ticketNumberTo: dto.ticketNumberTo,
      granularity: dto.granularity ?? 'day',
      tz: 'America/Argentina/Mendoza',
      offset: 0,
      limit: 100,
    };

    let data: any;
    switch (dto.type) {
      case 'summary':    data = await this.summary(filters); break;
      case 'throughput': data = await this.throughput(filters); break;
      default:           data = { message: 'Aún no implementado', filters };
    }

    const snapshot = this.snapshotsRepo.create({
      type: dto.type,
      from: dto.from ? new Date(dto.from) : null,
      to: dto.to ? new Date(dto.to) : null,
      serviceId: dto.serviceId ?? null,
      operatorId: dto.operatorId ?? null,
      granularity: (dto.granularity as any) ?? null,
      createdByUserId: dto.createdByUserId ?? null,
      ticketNumberFrom: dto.ticketNumberFrom ?? null,
      ticketNumberTo: dto.ticketNumberTo ?? null,
      data,
      calcVersion: 'v1',
    });

    return this.snapshotsRepo.save(snapshot);
  }

  async listSnapshots(q: ListSnapshotsQueryDto) {
    const qb = this.snapshotsRepo.createQueryBuilder('s')
      .orderBy('s.createdAt', 'DESC')
      .limit(q.limit ?? 50)
      .offset(q.offset ?? 0);

    if (q.type) qb.andWhere('s.type = :type', { type: q.type });
    if (q.from) qb.andWhere('s.createdAt >= :from', { from: q.from });
    if (q.to) qb.andWhere('s.createdAt <= :to', { to: q.to });
    if (q.serviceId) qb.andWhere('s.serviceId = :serviceId', { serviceId: q.serviceId });
    if (q.operatorId) qb.andWhere('s.operatorId = :operatorId', { operatorId: q.operatorId });

    if (q.ticketNumberFrom) qb.andWhere('s.ticketNumberFrom >= :tnf', { tnf: q.ticketNumberFrom });
    if (q.ticketNumberTo) qb.andWhere('s.ticketNumberTo <= :tnt', { tnt: q.ticketNumberTo });

    const [items, total] = await qb.getManyAndCount();
    return { total, items };
  }

  async getSnapshot(id: number) {
    return this.snapshotsRepo.findOne({ where: { id } });
  }
}
