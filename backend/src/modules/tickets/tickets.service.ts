import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, EntityManager } from 'typeorm';

import { Ticket } from '../../entities/ticket.entity';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { Client } from '../../entities/client.entity';
import { Operator } from '../../entities/operator.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import { ServicesService } from '../../modules/services/services.service';
import { ClientsService } from '../../modules/clients/clients.service';
import { SystemSettingsService } from '../../modules/system-settings/system-settings.service';
import { AuditLog, type AuditLogActorSnapshot } from '../../entities/audit-log.entity';
import { Status } from '../../common/enums/status.enum'; // ⬅️ enum fuente de verdad (incluye ABSENT)

const isTruthyBoolean = (value: unknown): boolean => value === true || value === 1 || value === '1';

export interface AttentionAlert {
  ticketId: number;
  ticketNumber: string;
  status: Status;
  operatorId: number | null;
  operatorName: string | null;
  serviceId: number;
  serviceName: string;
  maxAttentionTime: number;
  elapsedSeconds: number;
  exceededSeconds: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface CreateTicketOptions {
  clientId?: number;
  mobilePhone?: string;
  priority?: number;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(ServiceEntity)
    private readonly serviceRepo: Repository<ServiceEntity>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,

    @InjectRepository(OperatorService)
    private readonly opSvcRepo: Repository<OperatorService>,

    private readonly servicesService: ServicesService,
    private readonly clientsService: ClientsService,
    private readonly systemSettings: SystemSettingsService,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  private readonly logger = new Logger(TicketsService.name);

  private normalizePriorityLevel(input: unknown): number | null {
    if (input === null || input === undefined) {
      return null;
    }

    const numeric = Number(input);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    const rounded = Math.round(numeric);
    const clamped = Math.max(1, Math.min(6, rounded));
    return clamped;
  }

  // ============================================================
  // Lectura base
  // ============================================================

  async findOne(id: number): Promise<Ticket> {
    const t = await this.ticketRepo.findOne({
      where: { id },
      relations: ['service', 'operator', 'client'],
    });
    if (!t) throw new NotFoundException('Ticket no encontrado');
    return t;
  }

  /** Ticket “actual” del operador:
   *  - prioriza IN_PROGRESS
   *  - si no hay, toma CALLED
   */
  async findCurrentByOperator(operatorId: number): Promise<Ticket | null> {
    const inProgress = await this.ticketRepo.findOne({
      where: { operatorId: operatorId as any, status: Status.IN_PROGRESS as any },
      relations: ['service', 'operator', 'client'],
    });
    if (inProgress) return inProgress;

    const called = await this.ticketRepo.findOne({
      where: { operatorId: operatorId as any, status: Status.CALLED as any },
      relations: ['service', 'operator', 'client'],
    });
    return called ?? null;
  }

  async hasActiveTicket(operatorId: number): Promise<boolean> {
    const count = await this.ticketRepo.count({
      where: { operatorId: operatorId as any, status: In([Status.CALLED, Status.IN_PROGRESS]) as any },
    });
    return count > 0;
  }

  async getAlternatePriorityEvery(): Promise<number> {
    try {
      const setting = await this.systemSettings.find('queue.alternate_priority_every');
      if (!setting) return 3;

      const parsed = Number(setting.value);
      if (!Number.isFinite(parsed)) return 3;

      const normalized = Math.round(parsed);
      return normalized >= 1 ? normalized : 1;
    } catch (error) {
      this.logger.debug(
        `Falling back to default alternate_priority_every due to error: ${(error as any)?.message ?? error}`,
      );
      return 3;
    }
  }

  async findNextTicketForGlobalQueue(): Promise<Ticket | null> {
    const buildBaseQuery = () =>
      this.ticketRepo
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.service', 'service')
        .leftJoinAndSelect('ticket.operator', 'operator')
        .leftJoinAndSelect('ticket.client', 'client')
        .where('ticket.status = :status', { status: Status.WAITING });

    const prioritySix = await buildBaseQuery()
      .andWhere('ticket.priority_level = :prioritySix', { prioritySix: 6 })
      .orderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .limit(1)
      .getOne();

    if (prioritySix) {
      return prioritySix;
    }

    const alternateEvery = await this.getAlternatePriorityEvery();

    if (alternateEvery <= 1) {
      return buildBaseQuery()
        .andWhere('ticket.priority_level < :prioritySix', { prioritySix: 6 })
        .orderBy('ticket.priority_level', 'DESC')
        .addOrderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
        .addOrderBy('ticket.id', 'ASC')
        .limit(1)
        .getOne();
    }

    const buildPriorityQuery = () =>
      buildBaseQuery().andWhere('ticket.priority_level < :prioritySix', { prioritySix: 6 });

    const highestPriorityTicket = await buildPriorityQuery()
      .orderBy('ticket.priority_level', 'DESC')
      .addOrderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .limit(1)
      .getOne();

    if (!highestPriorityTicket) {
      return null;
    }

    const windowTickets = await buildPriorityQuery()
      .orderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .limit(alternateEvery)
      .getMany();

    if (windowTickets.length === 0) {
      return null;
    }

    const highestPriorityInWindow = windowTickets.reduce<number>((max, ticket) => {
      const priority = this.normalizePriorityLevel(ticket.priorityLevel);
      if (priority === null) {
        return max;
      }
      return priority > max ? priority : max;
    }, 0);

    const candidateInWindow =
      windowTickets.find((ticket) => {
        const priority = this.normalizePriorityLevel(ticket.priorityLevel);
        return priority !== null && priority === highestPriorityInWindow;
      }) ?? windowTickets[0];

    const highestIsInWindow = windowTickets.some((ticket) => ticket.id === highestPriorityTicket.id);

    if (highestIsInWindow) {
      return candidateInWindow ?? null;
    }

    return highestPriorityTicket;
  }

  /** Igual que findNextTicketForGlobalQueue, pero filtrando por un subconjunto de servicios */
  private async findNextWaitingForServices(serviceIds: number[]): Promise<Ticket | null> {
    if (!serviceIds.length) return null;

    const buildBaseQuery = () =>
      this.ticketRepo
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.service', 'service')
        .leftJoinAndSelect('ticket.operator', 'operator')
        .leftJoinAndSelect('ticket.client', 'client')
        .where('ticket.status = :status', { status: Status.WAITING })
        .andWhere('ticket.service_id IN (:...serviceIds)', { serviceIds });

    // 1) Prioridad 6 siempre primero
    const prioritySix = await buildBaseQuery()
      .andWhere('ticket.priority_level = :prioritySix', { prioritySix: 6 })
      .orderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .limit(1)
      .getOne();

    if (prioritySix) {
      return prioritySix;
    }

    // 2) Alternancia para prioridades 1-5
    const alternateEvery = await this.getAlternatePriorityEvery();

    if (alternateEvery <= 1) {
      return buildBaseQuery()
        .andWhere('ticket.priority_level < :prioritySix', { prioritySix: 6 })
        .orderBy('ticket.priority_level', 'DESC')
        .addOrderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
        .addOrderBy('ticket.id', 'ASC')
        .limit(1)
        .getOne();
    }

    const buildPriorityQuery = () =>
      buildBaseQuery().andWhere('ticket.priority_level < :prioritySix', { prioritySix: 6 });

    // Ticket de mayor prioridad absoluta entre esos servicios
    const highestPriorityTicket = await buildPriorityQuery()
      .orderBy('ticket.priority_level', 'DESC')
      .addOrderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .limit(1)
      .getOne();

    if (!highestPriorityTicket) {
      return null;
    }

    // Ventana de los N primeros por orden de llegada
    const windowTickets = await buildPriorityQuery()
      .orderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .limit(alternateEvery)
      .getMany();

    if (windowTickets.length === 0) {
      return null;
    }

    const highestPriorityInWindow = windowTickets.reduce<number>((max, ticket) => {
      const priority = this.normalizePriorityLevel(ticket.priorityLevel);
      if (priority === null) return max;
      return priority > max ? priority : max;
    }, 0);

    const candidateInWindow =
      windowTickets.find((ticket) => {
        const priority = this.normalizePriorityLevel(ticket.priorityLevel);
        return priority !== null && priority === highestPriorityInWindow;
      }) ?? windowTickets[0];

    const highestIsInWindow = windowTickets.some((ticket) => ticket.id === highestPriorityTicket.id);

    if (highestIsInWindow) {
      return candidateInWindow ?? null;
    }

    return highestPriorityTicket;
  }

  // ============================================================
  // Creación / estimación
  // ============================================================

  async create(serviceId: number, options: CreateTicketOptions = {}): Promise<Ticket> {
    const { clientId, mobilePhone, priority } = options;
    const client = clientId ? await this.clientsService.findOne(clientId) : null;

    return this.dataSource.transaction(async (manager) => {
      try {
        // 1) Reservar correlativo con lock de fila (service_counters)
        const { service, nextNumber, issuedDate } = await this.servicesService.reserveNextTicketNumber(
          manager,
          serviceId,
        );

        // 2) Prefijo robusto (aunque prefix esté null/vacío)
        const prefix = this.servicesService.makeSafePrefix(service);
        const number = `${prefix}${String(nextNumber).padStart(3, '0')}`;

        const issuedForDate = issuedDate ? new Date(`${issuedDate}T00:00:00`) : new Date();

        // 3) Estimación (no afecta integridad)
        const estimatedWaitTime = await this.computeEstimatedWaitTime(manager, service);

        // 4) Normalizar datos opcionales
        const sanitizedMobilePhone =
          typeof mobilePhone === 'string' && mobilePhone.trim().length > 0
            ? mobilePhone.replace(/[^\d+]/g, '').trim()
            : null;

        const normalizedPriorityLevel = this.normalizePriorityLevel(priority);
        const servicePriorityLevel = this.normalizePriorityLevel(service.priorityLevel);
        const legacyServicePriorityLevel = this.normalizePriorityLevel(
          (service as unknown as { priority?: number | null })?.priority,
        );

        const priorityLevel =
          normalizedPriorityLevel ?? servicePriorityLevel ?? legacyServicePriorityLevel ?? 3;

        // 5) Crear y guardar
        const ticketRepo = manager.getRepository(Ticket);
        const entity = ticketRepo.create({
          number, // <- CLAVE: siempre seteado
          serviceId: service.id,
          issuedForDate,
          clientId: client?.id ?? null,
          status: Status.WAITING,
          priorityLevel,
          estimatedWaitTime,
          mobilePhone: sanitizedMobilePhone,
        });

        const saved = await ticketRepo.save(entity);
        // Log de éxito mínimo (puedes retirar luego)
        console.log('[TicketsService.create] OK ->', {
          id: saved.id,
          serviceId: saved.serviceId,
          number: saved.number,
        });
        return saved;
      } catch (e: any) {
        // 🔎 Loguear TODO lo útil del error para leerlo en Railway
        const err: any = e ?? {};
        const driver = err?.driverError ?? err?.parent ?? err?.original ?? {};
        console.error('[TicketsService.create] ERROR', {
          message: err.message,
          code: err.code, // p.ej. 'ER_DUP_ENTRY' o 'ER_BAD_NULL_ERROR'
          errno: err.errno, // p.ej. 1062
          detail: err.detail,
          sqlMessage: err.sqlMessage,
          sqlState: err.sqlState,
          driverMessage: driver.message,
          driverCode: driver.code,
          driverErrno: driver.errno,
        });
        throw e; // deja que Nest lo transforme en 500; el log ya nos dice la causa real
      }
    });
  }

  private async computeEstimatedWaitTime(
    manager: EntityManager,
    service: ServiceEntity,
  ): Promise<number> {
    const waiting = await manager.getRepository(Ticket).count({
      where: { serviceId: service.id, status: Status.WAITING } as any,
    });

    const perTicket = service.estimatedTime ?? 10;
    return waiting * perTicket;
  }

  async estimateWaitTime(serviceId: number): Promise<number> {
    const service = await this.serviceRepo.findOne({ where: { id: serviceId } });
    if (!service) throw new BadRequestException('Servicio inválido');

    const waiting = await this.ticketRepo.count({
      where: { serviceId, status: Status.WAITING } as any,
    });

    const perTicket = service.estimatedTime ?? 10;
    return waiting * perTicket;
  }

  async getAttentionAlerts(): Promise<AttentionAlert[]> {
    const candidates = await this.ticketRepo.find({
      where: [
        { status: Status.IN_PROGRESS } as any,
        { status: Status.COMPLETED } as any,
      ],
      relations: ['service', 'operator'],
    });

    const now = Date.now();
    const alerts: AttentionAlert[] = [];

    for (const ticket of candidates) {
      const maxMinutes = ticket.service?.maxAttentionTime ?? null;
      if (!maxMinutes || maxMinutes <= 0) continue;

      const limitSeconds = maxMinutes * 60;
      let elapsedSeconds: number | null = null;

      if (ticket.status === Status.COMPLETED) {
        if (typeof ticket.attentionDuration === 'number') {
          elapsedSeconds = ticket.attentionDuration;
        } else if (ticket.startedAt && ticket.completedAt) {
          elapsedSeconds = Math.max(
            0,
            Math.round((ticket.completedAt.getTime() - ticket.startedAt.getTime()) / 1000),
          );
        }
      } else if (ticket.status === Status.IN_PROGRESS) {
        const start = ticket.startedAt ?? ticket.calledAt;
        if (start) {
          elapsedSeconds = Math.max(0, Math.round((now - start.getTime()) / 1000));
        }
      }

      if (elapsedSeconds === null || elapsedSeconds <= limitSeconds) continue;

      alerts.push({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        status: ticket.status,
        operatorId: ticket.operatorId ?? null,
        operatorName: ticket.operator?.name ?? null,
        serviceId: ticket.serviceId,
        serviceName: ticket.service?.name ?? '',
        maxAttentionTime: maxMinutes,
        elapsedSeconds,
        exceededSeconds: elapsedSeconds - limitSeconds,
        startedAt: ticket.startedAt ?? ticket.calledAt ?? null,
        completedAt: ticket.completedAt ?? null,
      });
    }

    alerts.sort((a, b) => b.exceededSeconds - a.exceededSeconds);
    return alerts;
  }

  // ============================================================
  // Transiciones de estado (acciones de negocio)
  // ============================================================

  async cancel(id: number): Promise<void> {
    const t = await this.findOne(id);
    if (t.status === Status.COMPLETED) {
      throw new ConflictException('No se puede cancelar un ticket completado');
    }
    t.status = Status.CANCELLED;
    await this.ticketRepo.save(t);
  }

  /** Llamar un ticket PUNTUAL: WAITING -> CALLED (asigna operador) */
  async callTicket(ticketId: number, operatorId: number): Promise<Ticket> {
    // 1) Validar operador activo
    const op = await this.operatorRepo.findOne({
      where: { id: operatorId, active: true as any },
    });
    if (!op) throw new ForbiddenException('Operador inactivo o inexistente');

    // 2) Cargar ticket
    const t = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['service', 'operator', 'client'],
    });
    if (!t) throw new NotFoundException('Ticket no existe');

    // 3) Idempotencia: si YA está CALLED por el mismo operador, devolver OK
    if (t.status === Status.CALLED && t.operatorId === operatorId) {
      return t;
    }

    // 4) Si está CALLED por OTRO operador → 409
    if (t.status === Status.CALLED && t.operatorId && t.operatorId !== operatorId) {
      throw new ConflictException('El ticket ya fue llamado por otro operador');
    }

    // 5) Validar transición permitida
    const isAbsentReassignment = t.status === Status.ABSENT;
    if (!isAbsentReassignment && t.status !== Status.WAITING) {
      throw new ConflictException(
        `Solo se puede llamar un ticket en estado WAITING (actual: ${t.status})`,
      );
    }

    // 6) Verificar que el operador pueda atender el servicio del ticket
    const allowed = await this.opSvcRepo.findOne({
      where: { operatorId, serviceId: t.serviceId },
    });
    if (!allowed || !isTruthyBoolean((allowed as any).active)) {
      throw new ForbiddenException('Operador no habilitado para este servicio');
    }

    // 7) Si está en WAITING, asegurar que sea el próximo en la cola
    if (!isAbsentReassignment) {
      const nextInQueue = await this.ticketRepo
        .createQueryBuilder('queue')
        .where('queue.serviceId = :serviceId', { serviceId: t.serviceId })
        .andWhere('queue.status = :status', { status: Status.WAITING })
        .orderBy('queue.priority_level', 'DESC')
        .addOrderBy('COALESCE(queue.requeued_at, queue.created_at)', 'ASC')
        .addOrderBy('queue.id', 'ASC')
        .getOne();

      if (nextInQueue && nextInQueue.id !== t.id) {
        throw new ConflictException('No se puede llamar este ticket: hay turnos anteriores en la fila.');
      }
    }

    // 8) Aplicar transición
    t.status = Status.CALLED;
    t.operatorId = operatorId;
    t.calledAt = new Date();
    t.requeuedAt = null;
    t.startedAt = null;
    t.completedAt = null;
    t.attentionDuration = null;

    return this.ticketRepo.save(t);
  }

  /** Llamar SIGUIENTE de UN servicio específico (modo viejo por servicio) */
  async callNextTicket(operatorId: number, serviceId: number): Promise<Ticket | null> {
    // 1) Validaciones
    const op = await this.operatorRepo.findOne({
      where: { id: operatorId, active: true as any },
    });
    if (!op) throw new ForbiddenException('Operador inactivo o inexistente');

    const allowed = await this.opSvcRepo.findOne({
      where: { operatorId, serviceId },
    });
    if (!allowed || !isTruthyBoolean((allowed as any).active)) {
      throw new ForbiddenException('Operador no habilitado para este servicio');
    }

    // 2) Transacción con lock para evitar carreras entre operadores
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Selecciona el próximo WAITING con el orden recomendado
      const rows: Array<{ id: number }> = await qr.query(
        `
        SELECT id
        FROM tickets
        WHERE service_id = ? AND status = 'WAITING'
        ORDER BY priority_level DESC,
                 COALESCE(requeued_at, created_at) ASC,
                 id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        `,
        [serviceId],
      );

      if (!rows.length) {
        await qr.commitTransaction();
        return null;
      }

      const ticketId = rows[0].id;
      const now = new Date();

      // Paso a CALLED y asigno operador (limpio requeued_at)
      await qr.manager
        .createQueryBuilder()
        .update(Ticket)
        .set({
          status: Status.CALLED as any,
          operatorId,
          calledAt: now,
          requeuedAt: null as any,
          startedAt: null as any,
          completedAt: null as any,
          attentionDuration: null as any,
        })
        .where('id = :id', { id: ticketId })
        .execute();

      const full = await qr.manager.getRepository(Ticket).findOne({
        where: { id: ticketId },
        relations: { service: true, operator: true, client: true },
      });

      await qr.commitTransaction();
      return full!;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /**
   * Llamar SIGUIENTE considerando TODOS los servicios habilitados del operador
   * usando la misma lógica de prioridad/alternancia que la cola global.
   */
  async callNextForOperator(operatorId: number): Promise<Ticket | null> {
    // 1) Validar operador activo
    const op = await this.operatorRepo.findOne({
      where: { id: operatorId, active: true as any },
    });
    if (!op) {
      throw new ForbiddenException('Operador inactivo o inexistente');
    }

    // 2) Servicios habilitados para el operador
    const links = await this.opSvcRepo.find({
      where: { operatorId, active: true as any } as any,
    });

    const serviceIds = links
      .map((link) => (link as any).serviceId ?? (link as any).service_id)
      .filter((id) => typeof id === 'number' && Number.isFinite(id));

    if (!serviceIds.length) {
      throw new ForbiddenException('Operador sin servicios habilitados');
    }

    // 3) Elegir el próximo ticket según prioridad + alternate_priority_every
    const next = await this.findNextWaitingForServices(serviceIds);
    if (!next) {
      return null;
    }

    // 4) Asignar operador y pasar a CALLED
    next.status = Status.CALLED;
    next.operatorId = operatorId;
    next.calledAt = new Date();
    next.requeuedAt = null;
    next.startedAt = null;
    next.completedAt = null;
    next.attentionDuration = null;

    return this.ticketRepo.save(next);
  }

  /** Inicia la atención: CALLED -> IN_PROGRESS */
  async startAttention(ticketId: number): Promise<Ticket> {
    const t = await this.findOne(ticketId);
    if (t.status !== Status.CALLED) {
      throw new ConflictException('Solo se puede iniciar atención desde CALLED');
    }
    if (!t.operatorId) {
      throw new ConflictException('El ticket debe tener un operador asignado');
    }
    t.status = Status.IN_PROGRESS;
    t.startedAt = new Date();
    t.attentionDuration = null;
    return this.ticketRepo.save(t);
  }

  /** Finaliza: IN_PROGRESS -> COMPLETED */
  async complete(ticketId: number): Promise<Ticket> {
    const t = await this.findOne(ticketId);
    if (t.status !== Status.IN_PROGRESS) {
      throw new ConflictException('Solo se puede completar desde IN_PROGRESS');
    }
    t.status = Status.COMPLETED;
    t.completedAt = new Date();
    if (t.startedAt) {
      const ms = t.completedAt.getTime() - t.startedAt.getTime();
      t.attentionDuration = Math.max(0, Math.round(ms / 1000));
    }
    return this.ticketRepo.save(t);
  }

  // --------- AUSENTE / REINTEGRAR (núcleo del issue) ---------

  private async buildOperatorAuditSnapshot(
    manager: EntityManager,
    operatorId: number | null,
  ): Promise<{ operatorId: number | null; snapshot: AuditLogActorSnapshot | null }> {
    if (!operatorId) {
      return { operatorId: null, snapshot: null };
    }

    try {
      const operator = await manager.findOne(Operator, {
        where: { id: operatorId },
        relations: ['operatorRoles', 'operatorRoles.role'],
      });

      if (!operator) {
        return { operatorId, snapshot: { id: operatorId } };
      }

      const roles = operator.roles?.map((role) => role.slug) ?? [];
      const primaryRole = operator.role ?? null;
      const snapshot: AuditLogActorSnapshot = {
        id: operator.id,
        name: operator.name ?? null,
        username: operator.username ?? null,
        email: operator.email ?? null,
        roles,
        primaryRole,
        identifier: operator.email ?? operator.username ?? null,
      };

      return { operatorId: operator.id, snapshot };
    } catch (error) {
      this.logger.warn(
        `Failed to build operator snapshot for audit (operatorId=${operatorId}): ${(error as any)?.message ?? error}`,
      );
      return { operatorId, snapshot: { id: operatorId } };
    }
  }

  private async recordTicketStatusChange(
    manager: EntityManager | null,
    payload: {
      ticket: Ticket;
      previousStatus: Status;
      newStatus: Status;
      operatorId: number | null;
      operatorSnapshot: AuditLogActorSnapshot | null;
    },
  ): Promise<void> {
    if (!this.auditRepo) return;

    try {
      const repo = manager ? manager.getRepository(AuditLog) : this.auditRepo;
      const { ticket, previousStatus, newStatus, operatorId, operatorSnapshot } = payload;
      const ticketLabel = ticket.number ?? `ID ${ticket.id}`;
      const eventType = newStatus === Status.ABSENT ? 'TICKET_MARK_ABSENT' : 'TICKET_STATUS_CHANGE';
      const actorName = operatorSnapshot?.name ?? operatorSnapshot?.username ?? null;

      const log = repo.create({
        eventType,
        action: 'Cambio de estado de ticket',
        target: `Ticket ${ticketLabel}`,
        description:
          newStatus === Status.ABSENT
            ? `Ticket ${ticketLabel} marcado como ausente.`
            : `Ticket ${ticketLabel} cambió de estado a ${newStatus}.`,
        severity: 'low',
        actorId: operatorId ?? null,
        actorName,
        actorRole: operatorSnapshot?.primaryRole ?? null,
        actorSnapshot: operatorSnapshot,
        ip: null,
        source: 'Panel operador',
        tags: ['tickets', 'status-change', newStatus.toLowerCase()],
        changes: [
          {
            field: 'status',
            before: previousStatus,
            after: newStatus,
          },
        ],
        metadata: {
          ticketId: ticket.id,
          ticketNumber: ticket.number ?? null,
          previousStatus,
          newStatus,
          serviceId: (ticket as any).serviceId ?? ticket.service?.id ?? null,
          operatorId: operatorId ?? null,
          absentAt:
            newStatus === Status.ABSENT && ticket.absentAt
              ? ticket.absentAt instanceof Date
                ? ticket.absentAt.toISOString()
                : new Date(ticket.absentAt).toISOString()
              : null,
        },
      });

      await repo.save(log);
    } catch (error) {
      this.logger.warn(
        `Failed to record ticket audit event for ticket=${payload.ticket.id}: ${(error as any)?.message ?? error}`,
      );
    }
  }

  /** Orquestador unificado (útil para PATCH /tickets/:id/status) */
  async updateStatus(ticketId: number, next: Status): Promise<Ticket> {
    if (next === Status.ABSENT) return this.markAbsent(ticketId);
    if (next === Status.WAITING) return this.reintegrate(ticketId);
    throw new ConflictException('Transición no soportada por este endpoint');
  }

  /** CALLED/IN_PROGRESS -> ABSENT: libera operador y setea absentAt (transacción) */
  async markAbsent(ticketId: number): Promise<Ticket> {
    return this.dataSource.transaction(async (m) => {
      const ticketRepo = m.getRepository(Ticket);
      const t = await ticketRepo.findOne({
        where: { id: ticketId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!t) throw new NotFoundException('Ticket no existe');

      const allowedOrigins = [Status.CALLED, Status.IN_PROGRESS];
      if (!allowedOrigins.includes(t.status)) {
        throw new ConflictException('Solo se puede marcar ausente un ticket en CALLED o IN_PROGRESS');
      }

      const previousStatus = t.status;
      const { operatorId, snapshot } = await this.buildOperatorAuditSnapshot(m, t.operatorId ?? null);

      t.operatorId = null;
      t.status = Status.ABSENT;
      t.absentAt = new Date();

      await ticketRepo.save(t);
      await this.recordTicketStatusChange(m, {
        ticket: t,
        previousStatus,
        newStatus: Status.ABSENT,
        operatorId,
        operatorSnapshot: snapshot,
      });

      return t;
    });
  }

  /** ABSENT -> WAITING: vuelve al final de la cola del mismo servicio (transacción) */
  async reintegrate(ticketId: number): Promise<Ticket> {
    return this.dataSource.transaction(async (m) => {
      const t = await m.findOne(Ticket, {
        where: { id: ticketId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!t) throw new NotFoundException('Ticket no existe');
      if (t.status !== Status.ABSENT) {
        throw new ConflictException('Solo se puede reintegrar desde ABSENT');
      }

      t.status = Status.WAITING;
      t.operatorId = null;
      t.requeuedAt = new Date(); // ⬅️ clave para mandarlo “al final”
      t.calledAt = null;
      t.startedAt = null;

      await m.save(t);
      return t;
    });
  }

  async registerQrScan(ticketId: number): Promise<Ticket> {
    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, {
        where: { id: ticketId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket no existe');
      }

      ticket.qrScannedAt = new Date();
      await manager.save(ticket);

      return this.findOne(ticketId);
    });
  }
}
