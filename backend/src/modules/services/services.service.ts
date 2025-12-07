import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, SelectQueryBuilder } from 'typeorm';
import { Service } from '../../entities/service.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import { Status } from '../../common/enums/status.enum';

type ServiceOperatorAssignment = {
  id: number;
  name: string;
  username: string;
  active: boolean;
  weight: number;
};

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(OperatorService)
    private readonly operatorServiceRepo: Repository<OperatorService>,
  ) {}

  private maxAttentionTimeColumnSupported: boolean | null = null;

  // ⚠️ Ya NO dependemos de services.next_ticket_number para numerar.
  // Lo dejamos para compatibilidad en listados, pero la reserva real se hace en service_counters.
  private nextTicketNumberColumnSupported: boolean | null = null;

  private legacyNextNumberWarningShown = false;

  private iconColumnSupported: boolean | null = null;

  private isMissingIconColumnError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const stack: any[] = [error];

    const matchesMessage = (raw: unknown): boolean => {
      if (typeof raw !== 'string' || raw.length === 0) return false;
      const lowered = raw.toLowerCase();
      return (
        lowered.includes('service.icon') ||
        lowered.includes('`icon`') ||
        lowered.includes('column "icon"') ||
        lowered.includes('unknown column')
      );
    };

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;

      const code = typeof (current as any).code === 'string' ? (current as any).code.toUpperCase() : '';
      const errno = typeof (current as any).errno === 'number' ? (current as any).errno : null;
      const message = (current as any).message;

      if (
        matchesMessage(message) &&
        (code === 'ER_BAD_FIELD_ERROR' || code === '42703' || code === 'SQLITE_ERROR' || errno === 1054)
      ) {
        return true;
      }

      if (matchesMessage(message)) return true;

      if ((current as any).driverError && typeof (current as any).driverError === 'object') {
        stack.push((current as any).driverError);
      }
      if ((current as any).parent && typeof (current as any).parent === 'object') {
        stack.push((current as any).parent);
      }
      if ((current as any).original && typeof (current as any).original === 'object') {
        stack.push((current as any).original);
      }
      if ((current as any).cause && typeof (current as any).cause === 'object') {
        stack.push((current as any).cause);
      }
    }

    return false;
  }

  private async runWithIconColumnSupport<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    if (this.iconColumnSupported === false) {
      return fallback();
    }

    try {
      const result = await operation();
      this.iconColumnSupported = true;
      return result;
    } catch (error) {
      if (!this.isMissingIconColumnError(error)) throw error;
      this.iconColumnSupported = false;
      return fallback();
    }
  }

  private sanitizePriority(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;

    const rounded = Math.round(numeric);
    if (!Number.isFinite(rounded)) return null;

    return Math.min(6, Math.max(1, rounded));
  }

  private async updateTicketPrioritiesForService(serviceId: number, priority: number): Promise<void> {
    const normalizedPriority = this.sanitizePriority(priority);
    if (normalizedPriority === null) return;

    const statuses = [Status.WAITING, Status.CALLED, Status.IN_PROGRESS];
    const placeholders = statuses.map(() => '?').join(', ');

    await this.serviceRepo.manager.query(
      `UPDATE tickets SET priority_level = ? WHERE service_id = ? AND status IN (${placeholders})`,
      [normalizedPriority, serviceId, ...statuses],
    );
  }

  private normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }
    return false;
  }

  private isOperatorServiceActive(link?: Pick<OperatorService, 'active'> | null): boolean {
    return this.normalizeBoolean(link?.active);
  }

  private async fetchActiveOperatorAssignments(serviceIds: number[]) {
    if (!serviceIds.length) {
      return new Map<number, ServiceOperatorAssignment[]>();
    }

    const rows = await this.operatorServiceRepo
      .createQueryBuilder('link')
      .leftJoinAndSelect('link.operator', 'operator')
      .where('link.serviceId IN (:...ids)', { ids: serviceIds })
      .getMany();

    const assignments = new Map<number, ServiceOperatorAssignment[]>();

    for (const row of rows) {
      if (!this.isOperatorServiceActive(row)) {
        continue;
      }

      const operator = row.operator;
      if (!operator) {
        continue;
      }

      const normalized: ServiceOperatorAssignment = {
        id: operator.id,
        name: operator.name,
        username: operator.username,
        active: this.normalizeBoolean(operator.active),
        weight: Number(row.weight ?? 1),
      };

      const current = assignments.get(row.serviceId) ?? [];
      if (!current.some((existing) => existing.id === normalized.id)) {
        current.push(normalized);
      }
      assignments.set(row.serviceId, current);
    }

    for (const [, operators] of assignments) {
      operators.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }

    return assignments;
  }

  private async attachOperatorsToServices<T extends { id: number }>(services: T[]) {
    if (!services.length) {
      return [] as Array<T & { operatorIds: number[]; operators: ServiceOperatorAssignment[] }>;
    }

    const assignments = await this.fetchActiveOperatorAssignments(services.map((svc) => svc.id));
    return services.map((service) => {
      const operators = assignments.get(service.id) ?? [];
      return {
        ...service,
        operatorIds: operators.map((operator) => operator.id),
        operators,
      };
    });
  }

  private createRawServiceQuery(
    repo: Repository<Service> = this.serviceRepo,
    includeIcon = true,
  ): SelectQueryBuilder<Service> {
    const qb = repo
      .createQueryBuilder('service')
      .select('service.id', 'id')
      .addSelect('service.name', 'name')
      .addSelect('service.prefix', 'prefix')
      .addSelect('service.next_ticket_number', 'nextTicketNumber')
      .addSelect('service.active', 'active')
      .addSelect('service.priority_level', 'priority')
      .addSelect('service.estimated_time', 'estimatedTime')
      .addSelect('service.created_at', 'createdAt')
      .addSelect('service.updated_at', 'updatedAt')
      .addSelect('service.system_locked', 'systemLocked');

    if (includeIcon) {
      qb.addSelect('service.icon', 'icon');
    }

    return qb;
  }

  private isMissingMaxAttentionTimeColumnError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const stack: any[] = [error];

    const isMatchingMessage = (rawMessage: unknown): boolean => {
      if (typeof rawMessage !== 'string' || rawMessage.length === 0) return false;

      const message = rawMessage.toLowerCase();
      const normalizedMessage = message.replace(/[_\s-]/g, '');

      const mentionsMissingColumn =
        message.includes('unknown column') ||
        message.includes('does not exist') ||
        message.includes('missing column') ||
        message.includes('no such column');

      const mentionsField =
        message.includes('max_attention_time') || normalizedMessage.includes('maxattentiontime');

      return mentionsMissingColumn && mentionsField;
    };

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;

      const code = typeof (current as any).code === 'string' ? (current as any).code.toUpperCase() : '';
      const errno = typeof (current as any).errno === 'number' ? (current as any).errno : null;

      if (code === 'ER_BAD_FIELD_ERROR' || code === '42703' || code === 'SQLITE_ERROR') {
        if (!(current as any).message || isMatchingMessage((current as any).message)) {
          return true;
        }
      }

      if (errno === 1054 && (!(current as any).message || isMatchingMessage((current as any).message))) {
        return true;
      }

      if (isMatchingMessage((current as any).message)) return true;

      if ((current as any).driverError && typeof (current as any).driverError === 'object') {
        stack.push((current as any).driverError);
      }
      if ((current as any).parent && typeof (current as any).parent === 'object') {
        stack.push((current as any).parent);
      }
      if ((current as any).original && typeof (current as any).original === 'object') {
        stack.push((current as any).original);
      }
      if ((current as any).cause && typeof (current as any).cause === 'object') {
        stack.push((current as any).cause);
      }
    }
    return false;
  }

  private async runWithMaxAttentionSupport<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    if (this.maxAttentionTimeColumnSupported === false) {
      return fallback();
    }
    try {
      const result = await operation();
      this.maxAttentionTimeColumnSupported = true;
      return result;
    } catch (error) {
      if (!this.isMissingMaxAttentionTimeColumnError(error)) throw error;
      this.maxAttentionTimeColumnSupported = false;
      return fallback();
    }
  }
  private isMissingNextTicketNumberColumnError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const stack: any[] = [error];

    const matchesMessage = (raw: unknown): boolean => {
      if (typeof raw !== 'string' || raw.length === 0) return false;
      const lowered = raw.toLowerCase();
      const normalized = lowered.replace(/[_\s-]/g, '');
      return (
        lowered.includes('next_ticket_number') ||
        normalized.includes('nextticketnumber') ||
        lowered.includes('next ticket number')
      );
    };

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;

      const code = typeof (current as any).code === 'string' ? (current as any).code.toUpperCase() : '';
      const errno = typeof (current as any).errno === 'number' ? (current as any).errno : null;
      const message = (current as any).message;

      if (
        matchesMessage(message) &&
        (code === 'ER_BAD_FIELD_ERROR' || code === '42703' || code === 'SQLITE_ERROR' || errno === 1054)
      ) {
        return true;
      }
      if (matchesMessage(message)) return true;

      if ((current as any).driverError && typeof (current as any).driverError === 'object') {
        stack.push((current as any).driverError);
      }
      if ((current as any).parent && typeof (current as any).parent === 'object') {
        stack.push((current as any).parent);
      }
      if ((current as any).original && typeof (current as any).original === 'object') {
        stack.push((current as any).original);
      }
      if ((current as any).cause && typeof (current as any).cause === 'object') {
        stack.push((current as any).cause);
      }
    }
    return false;
  }

  private parseSequentialTicketNumber(ticketNumber: unknown, prefix: string): number {
    if (typeof ticketNumber !== 'string' || ticketNumber.length === 0) return 0;

    let numericPart = ticketNumber;
    if (prefix && ticketNumber.startsWith(prefix)) {
      numericPart = ticketNumber.slice(prefix.length);
    } else {
      const match = ticketNumber.match(/(\d+)$/);
      numericPart = match ? match[1] ?? '' : '';
    }

    const parsed = Number.parseInt(numericPart, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = (value.getMonth() + 1).toString().padStart(2, '0');
    const day = value.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeDateInput(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return this.formatDate(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) return isoMatch[1];

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return this.formatDate(parsed);
      }
      return null;
    }

    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return this.formatDate(parsed);
    }

    return null;
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    if (!error || typeof error !== 'object') return false;

    const normalizedTable = tableName.toLowerCase();

    const stack: any[] = [error];

    const isMatchingMessage = (rawMessage: unknown): boolean => {
      if (typeof rawMessage !== 'string' || rawMessage.length === 0) return false;

      const message = rawMessage.toLowerCase();
      return (
        message.includes(normalizedTable) &&
        (message.includes('does not exist') ||
          message.includes('unknown table') ||
          message.includes('no such table') ||
          message.includes('no such column') ||
          message.includes('missing') ||
          message.includes('unknown column'))
      );
    };

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;

      const code = typeof (current as any).code === 'string' ? (current as any).code.toUpperCase() : '';
      const errno = typeof (current as any).errno === 'number' ? (current as any).errno : null;

      if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_TABLE_ERROR' || code === 'SQLITE_ERROR') {
        if (!(current as any).message || isMatchingMessage((current as any).message)) {
          return true;
        }
      }

      if (errno === 1051 && (!(current as any).message || isMatchingMessage((current as any).message))) {
        return true;
      }

      if (isMatchingMessage((current as any).message)) return true;

      if ((current as any).driverError && typeof (current as any).driverError === 'object') {
        stack.push((current as any).driverError);
      }
      if ((current as any).parent && typeof (current as any).parent === 'object') {
        stack.push((current as any).parent);
      }
      if ((current as any).original && typeof (current as any).original === 'object') {
        stack.push((current as any).original);
      }
      if ((current as any).cause && typeof (current as any).cause === 'object') {
        stack.push((current as any).cause);
      }
    }

    return false;
  }

  private isUniqueViolationError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const stack: any[] = [error];

    const isMatchingMessage = (rawMessage: unknown): boolean => {
      if (typeof rawMessage !== 'string' || rawMessage.length === 0) return false;
      const message = rawMessage.toLowerCase();
      return message.includes('duplicate') || message.includes('unique constraint');
    };

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;

      const code = typeof (current as any).code === 'string' ? (current as any).code.toUpperCase() : '';
      const errno = typeof (current as any).errno === 'number' ? (current as any).errno : null;

      if (
        code === 'ER_DUP_ENTRY' ||
        code === 'SQLITE_CONSTRAINT' ||
        code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
        code === '23505'
      ) {
        return true;
      }

      if (errno === 1062 && (!(current as any).message || isMatchingMessage((current as any).message))) {
        return true;
      }

      if (isMatchingMessage((current as any).message)) return true;

      if ((current as any).driverError && typeof (current as any).driverError === 'object') {
        stack.push((current as any).driverError);
      }
      if ((current as any).parent && typeof (current as any).parent === 'object') {
        stack.push((current as any).parent);
      }
      if ((current as any).original && typeof (current as any).original === 'object') {
        stack.push((current as any).original);
      }
      if ((current as any).cause && typeof (current as any).cause === 'object') {
        stack.push((current as any).cause);
      }
    }

    return false;
  }

  private async persistDailyTotal(
    manager: EntityManager,
    serviceId: number,
    counterDate: string,
    totalIssued: number,
  ): Promise<void> {
    if (totalIssued <= 0) return;

    try {
      await manager.query(
        'INSERT INTO service_counter_history (service_id, counter_date, total_issued) VALUES (?, ?, ?)',
        [serviceId, counterDate, totalIssued],
      );
    } catch (error) {
      if (this.isMissingTableError(error, 'service_counter_history')) return;
      if (!this.isUniqueViolationError(error)) throw error;

      await manager.query(
        `UPDATE service_counter_history
         SET total_issued = CASE WHEN total_issued < ? THEN ? ELSE total_issued END
         WHERE service_id = ? AND counter_date = ?`,
        [totalIssued, totalIssued, serviceId, counterDate],
      );
    }
  }

  private async resolveCurrentDate(manager: EntityManager): Promise<string> {
    const type = String(manager.connection.options.type ?? '').toLowerCase();
    const query =
      type === 'sqlite' || type === 'better-sqlite3'
        ? "SELECT DATE('now') AS currentDate"
        : 'SELECT CURRENT_DATE() AS currentDate';

    const [row] = await manager.query(query);
    const normalized = this.normalizeDateInput(row?.currentDate ?? row?.currentdate ?? row?.CURRENTDATE);
    return normalized ?? this.formatDate(new Date());
  }

  private async reserveNextTicketNumberLegacy(
    manager: EntityManager,
    serviceId: number,
  ): Promise<{ service: Service; nextNumber: number }> {
    // 🔁 Solo usado si alguien insiste en services.next_ticket_number. Conservado por compatibilidad.
    const repo = manager.getRepository(Service);
    const lockClause = this.supportsPessimisticWrite(manager) ? ' FOR UPDATE' : '';

    const rows = await manager.query(
      `SELECT id, name, prefix, active, priority_level AS priorityLevel, estimated_time AS estimatedTime, created_at AS createdAt, updated_at AS UpdatedAt
       FROM services
       WHERE id = ?
       LIMIT 1${lockClause}`,
      [serviceId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Servicio no encontrado');

    const service = this.mapRawService(rows[0], repo);

    const ticketLockClause = this.supportsPessimisticWrite(manager) ? ' FOR UPDATE' : '';
    const [lastTicket] = await manager.query(
      `SELECT number
       FROM tickets
       WHERE service_id = ?
       ORDER BY id DESC
       LIMIT 1${ticketLockClause}`,
      [serviceId],
    );

    const lastSequential = this.parseSequentialTicketNumber(lastTicket?.number, service.prefix ?? '');
    const nextNumber = lastSequential + 1;

    service.nextTicketNumber = nextNumber + 1;

    await manager.getRepository(Service).update({ id: serviceId }, { nextTicketNumber: nextNumber + 1 });

    if (!this.legacyNextNumberWarningShown) {
      this.legacyNextNumberWarningShown = true;
      console.warn(
        '[ServicesService] Columna services.next_ticket_number ausente. Usando cálculo desde tickets (LEGACY).',
      );
    }

    return { service, nextNumber };
  }

  private mapRawService(row: any, repo: Repository<Service> = this.serviceRepo): Service {
    const maxAttentionRaw =
      row.maxAttentionTime !== undefined ? row.maxAttentionTime : row.max_attention_time;

    const maxAttentionTime =
      maxAttentionRaw === null || maxAttentionRaw === undefined
        ? null
        : Number(maxAttentionRaw);

    const createdAt = row.createdAt ?? row.created_at;
    const updatedAt = row.updatedAt ?? row.updated_at;

    const prioritySource =
      row.priorityLevel ?? row.priority ?? row.priority_level ?? row.prioritylevel;
    const priorityLevel = Number.isFinite(Number(prioritySource))
      ? Number(prioritySource)
      : 3;

    return repo.create({
      id: Number(row.id),
      name: row.name,
      icon: typeof row.icon === 'string' && row.icon.length > 0 ? row.icon.toLowerCase() : null,
      prefix: row.prefix,
      nextTicketNumber: Number(row.nextTicketNumber ?? row.next_ticket_number ?? 1),
      active: typeof row.active === 'boolean' ? row.active : Number(row.active ?? 0) === 1,
      priorityLevel,
      estimatedTime: Number(row.estimatedTime ?? row.estimated_time ?? 10),
      maxAttentionTime,
      createdAt: createdAt ? new Date(createdAt) : createdAt,
      updatedAt: updatedAt ? new Date(updatedAt) : updatedAt,
      systemLocked: Number(row.systemLocked ?? row.system_locked ?? 0) === 1,
    });
  }

  private async findManyWithoutMaxAttention(options: {
    where?: string;
    parameters?: Record<string, any>;
    orderBy?: { [column: string]: 'ASC' | 'DESC' };
    limit?: number;
  } = {}): Promise<Service[]> {
    const execute = async (includeIcon: boolean) => {
      const qb = this.createRawServiceQuery(this.serviceRepo, includeIcon);

      if (options.where) qb.where(options.where, options.parameters);

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([column, direction], index) => {
          if (index === 0) qb.orderBy(column, direction);
          else qb.addOrderBy(column, direction);
        });
      } else {
        qb.orderBy('service.priority_level', 'DESC').addOrderBy('service.name', 'ASC');
      }

      if (typeof options.limit === 'number') qb.limit(options.limit);

      const rows = await qb.getRawMany();
      return rows.map((row: any) => this.mapRawService(row));
    };

    if (this.iconColumnSupported === false) {
      return execute(false);
    }

    try {
      const services = await execute(true);
      this.iconColumnSupported = true;
      return services;
    } catch (error) {
      if (!this.isMissingIconColumnError(error)) throw error;
      this.iconColumnSupported = false;
      return execute(false);
    }
  }

  private async findOneWithoutMaxAttention(options: {
    where: string;
    parameters?: Record<string, any>;
    orderBy?: { [column: string]: 'ASC' | 'DESC' };
  }): Promise<Service | null> {
    const execute = async (includeIcon: boolean) => {
      const qb = this.createRawServiceQuery(this.serviceRepo, includeIcon).where(
        options.where,
        options.parameters,
      );

      if (options.orderBy) {
        Object.entries(options.orderBy).forEach(([column, direction], index) => {
          if (index === 0) qb.orderBy(column, direction);
          else qb.addOrderBy(column, direction);
        });
      }

      qb.limit(1);
      const row = await qb.getRawOne();
      return row ? this.mapRawService(row) : null;
    };

    if (this.iconColumnSupported === false) {
      return execute(false);
    }

    try {
      const service = await execute(true);
      this.iconColumnSupported = true;
      return service;
    } catch (error) {
      if (!this.isMissingIconColumnError(error)) throw error;
      this.iconColumnSupported = false;
      return execute(false);
    }
  }

  async findAll(): Promise<Array<Service & { operatorIds: number[]; operators: ServiceOperatorAssignment[] }>> {
    const services = await this.runWithMaxAttentionSupport(
      () =>
        this.runWithIconColumnSupport(
          () =>
            this.serviceRepo.find({
              order: { priorityLevel: 'DESC', name: 'ASC' },
            }),
          () => this.findManyWithoutMaxAttention(),
        ),
      () => this.findManyWithoutMaxAttention(),
    );

    return this.attachOperatorsToServices(services);
  }

  async findActive(): Promise<Array<Service & { operatorIds: number[]; operators: ServiceOperatorAssignment[] }>> {
    const services = await this.runWithMaxAttentionSupport(
      () =>
        this.runWithIconColumnSupport(
          () =>
            this.serviceRepo.find({
              where: { active: true },
              order: { priorityLevel: 'DESC', name: 'ASC' },
            }),
          () =>
            this.findManyWithoutMaxAttention({
              where: 'service.active = :active',
              parameters: { active: true },
            }),
        ),
      () =>
        this.findManyWithoutMaxAttention({
          where: 'service.active = :active',
          parameters: { active: true },
        }),
    );

    return this.attachOperatorsToServices(services);
  }

  async findOne(id: number): Promise<Service> {
    const fallbackLookup = async () => {
      const found = await this.findOneWithoutMaxAttention({
        where: 'service.id = :id',
        parameters: { id },
      });
      if (!found) throw new NotFoundException('Servicio no encontrado');
      return found;
    };

    const item = await this.runWithMaxAttentionSupport(
      () =>
        this.runWithIconColumnSupport(
          async () => {
            const found = await this.serviceRepo.findOne({ where: { id } });
            if (!found) throw new NotFoundException('Servicio no encontrado');
            return found;
          },
          fallbackLookup,
        ),
      fallbackLookup,
    );

    const [withOperators] = await this.attachOperatorsToServices([item]);
    return withOperators;
  }

  // Normalización y defaults seguros
  async create(data: Partial<Service>): Promise<Service> {
    const priority = this.sanitizePriority(data.priority) ?? 3;

    const estimatedTime = Number.isFinite(Number(data.estimatedTime))
      ? Math.max(1, Number(data.estimatedTime))
      : 10;

    let maxAttentionTime: number | null = null;
    if (data.maxAttentionTime !== undefined && data.maxAttentionTime !== null) {
      const parsed = Number(data.maxAttentionTime);
      if (Number.isFinite(parsed) && parsed > 0) {
        maxAttentionTime = Math.round(parsed);
      }
    }

    const active = typeof data.active === 'boolean' ? data.active : true;

    const rawIcon = typeof (data as any).icon === 'string' ? (data as any).icon.trim() : '';
    const icon = rawIcon.length > 0 ? rawIcon.toLowerCase() : null;

    const entity = this.serviceRepo.create({
      name: String(data.name ?? '').trim(),
      prefix: String(data.prefix ?? '').trim().toUpperCase(),
      active,
      priority,
      estimatedTime,
      maxAttentionTime,
      icon,
      nextTicketNumber: 1, // solo por compatibilidad visual; no se usa para reservar
      systemLocked: false,
    });

    const insertWithOptions = async (
      includeMaxAttention: boolean,
      includeIcon: boolean,
    ): Promise<Service> => {
      const values: Record<string, any> = {
        name: entity.name,
        prefix: entity.prefix,
        nextTicketNumber: entity.nextTicketNumber,
        active: entity.active,
        priorityLevel: entity.priority,
        estimatedTime: entity.estimatedTime,
        systemLocked: entity.systemLocked,
      };

      if (includeMaxAttention && maxAttentionTime !== null) {
        values.maxAttentionTime = maxAttentionTime;
      }

      if (includeIcon) {
        values.icon = icon ?? null;
      }

      const insertResult = await this.serviceRepo
        .createQueryBuilder()
        .insert()
        .into(Service)
        .values(values)
        .execute();

      let insertedId = insertResult.identifiers?.[0]?.id ?? insertResult.raw?.insertId;

      if (insertedId === undefined || insertedId === null) {
        const lookup = await this.createRawServiceQuery(this.serviceRepo, includeIcon)
          .where('service.prefix = :prefix', { prefix: entity.prefix })
          .orderBy('service.id', 'DESC')
          .limit(1)
          .getRawOne();
        insertedId = lookup?.id;
      }

      const numericId = insertedId !== undefined && insertedId !== null ? Number(insertedId) : NaN;

      if (!Number.isFinite(numericId)) {
        const fallback = await this.findOneWithoutMaxAttention({
          where: 'service.prefix = :prefix',
          parameters: { prefix: entity.prefix },
          orderBy: { 'service.id': 'DESC' },
        });
        if (!fallback) {
          throw new NotFoundException('Servicio creado pero no se pudo recuperar');
        }
        return fallback;
      }

      return this.findOne(numericId);
    };

    const attemptInsert = (includeMaxAttention: boolean) =>
      this.runWithIconColumnSupport(
        () => insertWithOptions(includeMaxAttention, true),
        () => insertWithOptions(includeMaxAttention, false),
      );

    return this.runWithMaxAttentionSupport(
      () => attemptInsert(true),
      () => attemptInsert(false),
    );
  }

  async update(id: number, data: Partial<Service>): Promise<Service> {
    const current = await this.serviceRepo.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Servicio no encontrado');

    if (current.systemLocked) {
      if (typeof data.name === 'string') {
        throw new BadRequestException('Este servicio prioritario está protegido y no permite cambiar el nombre.');
      }
      if (data.priority !== undefined && data.priority !== null) {
        throw new BadRequestException('Este servicio prioritario está protegido y no permite cambiar la prioridad.');
      }
    }

    const patch: Partial<Service> = {};
    if (typeof data.name === 'string') patch.name = data.name.trim();
    if (typeof data.prefix === 'string') patch.prefix = data.prefix.trim().toUpperCase();
    if (typeof data.active === 'boolean') patch.active = data.active;

    const normalizedPriority = this.sanitizePriority(data.priority);
    if (normalizedPriority !== null) patch.priorityLevel = normalizedPriority;

    if (data.estimatedTime !== undefined) {
      const t = Number(data.estimatedTime);
      if (Number.isFinite(t)) patch.estimatedTime = Math.max(1, t);
    }

    if (data.maxAttentionTime !== undefined) {
      if (data.maxAttentionTime === null) {
        (patch as any).maxAttentionTime = null;
      } else {
        const parsed = Number(data.maxAttentionTime);
        if (Number.isFinite(parsed) && parsed > 0) {
          patch.maxAttentionTime = Math.round(parsed);
        } else {
          (patch as any).maxAttentionTime = null;
        }
      }
    }

    if ((data as any).icon !== undefined) {
      const rawIcon = (data as any).icon;
      if (rawIcon === null) {
        (patch as any).icon = null;
      } else if (typeof rawIcon === 'string') {
        const trimmed = rawIcon.trim();
        (patch as any).icon = trimmed.length > 0 ? trimmed.toLowerCase() : null;
      }
    }

    if ((data as any).systemLocked !== undefined) {
      patch.systemLocked = current.systemLocked;
    }

    return this.runWithMaxAttentionSupport(
      async () => {
        await this.runWithIconColumnSupport(
          async () => {
            await this.serviceRepo.update({ id }, patch);
            return true;
          },
          async () => {
            const { icon: _ignoredIcon, ...patchWithoutIcon } = patch as any;
            if (Object.keys(patchWithoutIcon).length > 0) {
              await this.serviceRepo
                .createQueryBuilder()
                .update(Service)
                .set(patchWithoutIcon)
                .where('id = :id', { id })
                .execute();
            }
            return true;
          },
        );

        if (normalizedPriority !== null) {
          await this.updateTicketPrioritiesForService(id, normalizedPriority);
        }
        return this.findOne(id);
      },
      async () =>
        this.runWithIconColumnSupport(
          async () => {
            const { maxAttentionTime: _ignored, ...patchWithoutMax } = patch as any;
            if (Object.keys(patchWithoutMax).length > 0) {
              await this.serviceRepo
                .createQueryBuilder()
                .update(Service)
                .set(patchWithoutMax)
                .where('id = :id', { id })
                .execute();
            }
            if (normalizedPriority !== null) {
              await this.updateTicketPrioritiesForService(id, normalizedPriority);
            }
            return this.findOne(id);
          },
          async () => {
            const { maxAttentionTime: _ignoredMax, icon: _ignoredIcon, ...patchWithoutBoth } = patch as any;
            if (Object.keys(patchWithoutBoth).length > 0) {
              await this.serviceRepo
                .createQueryBuilder()
                .update(Service)
                .set(patchWithoutBoth)
                .where('id = :id', { id })
                .execute();
            }
            if (normalizedPriority !== null) {
              await this.updateTicketPrioritiesForService(id, normalizedPriority);
            }
            return this.findOne(id);
          },
        ),
    );
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // asegura 404 si no existe
    await this.serviceRepo.delete(id);
  }

  /**
   * 💥 Nueva implementación oficial de reserva de correlativo:
   * Usa la tabla `service_counters` con bloqueo de fila (SELECT ... FOR UPDATE)
   * para evitar colisiones en concurrencia.
   */
  async reserveNextTicketNumber(
    manager: EntityManager,
    serviceId: number,
  ): Promise<{ service: Service; nextNumber: number; issuedDate: string }> {
    // 1) Cargar servicio (dentro de la misma transacción)
    const service = await manager.getRepository(Service).findOne({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const today = await this.resolveCurrentDate(manager);

    const lockClause = this.supportsPessimisticWrite(manager) ? ' FOR UPDATE' : '';

    let row: any = null;
    try {
      const rows = await manager.query(
        `SELECT last_seq, counter_date FROM service_counters WHERE service_id = ?${lockClause}`,
        [serviceId],
      );
      row = rows?.[0] ?? null;
    } catch (error) {
      if (this.isMissingTableError(error, 'service_counters')) {
        const legacy = await this.reserveNextTicketNumberLegacy(manager, serviceId);
        return { ...legacy, issuedDate: today };
      }
      throw error;
    }

    let current = 0;
    let counterDate = today;
    if (!row) {
      await manager.query(
        'INSERT INTO service_counters (service_id, counter_date, last_seq) VALUES (?, ?, 0)',
        [serviceId, today],
      );
    } else {
      current = Number(row.last_seq) || 0;
      counterDate = this.normalizeDateInput(row.counter_date) ?? today;
    }

    if (counterDate !== today) {
      await this.persistDailyTotal(manager, serviceId, counterDate, current);
      current = 0;
      await manager.query(
        'UPDATE service_counters SET counter_date = ?, last_seq = 0 WHERE service_id = ?',
        [today, serviceId],
      );
    }

    const next = current + 1;

    await manager.query(
      'UPDATE service_counters SET last_seq = ?, counter_date = ? WHERE service_id = ?',
      [next, today, serviceId],
    );

    await manager.getRepository(Service).update({ id: serviceId }, { nextTicketNumber: next + 1 });
    service.nextTicketNumber = next + 1;

    return { service, nextNumber: next, issuedDate: today };
  }

  /**
   * Prefijo seguro para componer el `number`:
   * - Usa `service.prefix` si tiene valor.
   * - Si no, genera desde el nombre (2 letras) o "S<id>" como último recurso.
   */
  makeSafePrefix(service: Service): string {
    const raw = (service.prefix ?? '').trim();
    if (raw.length > 0) return raw;
    const name = (service.name ?? '').trim();
    if (name.length > 0) {
      const letters = name.replace(/\s+/g, '').toUpperCase();
      return letters.slice(0, 2); // p.ej. "CE" de "CERAMICA"
    }
    return `S${service.id}`;
  }

  private supportsPessimisticWrite(manager: EntityManager): boolean {
    const type = (manager.connection.options.type as string) || '';
    return ['mysql', 'mariadb', 'aurora-mysql', 'postgres'].includes(type);
  }

  private async runWithManagerMaxAttentionSupport<T>(
    _manager: EntityManager,
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    if (this.maxAttentionTimeColumnSupported === false) return fallback();

    try {
      const result = await operation();
      this.maxAttentionTimeColumnSupported = true;
      return result;
    } catch (error) {
      if (!this.isMissingMaxAttentionTimeColumnError(error)) throw error;
      this.maxAttentionTimeColumnSupported = false;
      return fallback();
    }
  }

}
