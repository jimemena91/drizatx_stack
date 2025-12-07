import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Operator } from '../../entities/operator.entity';
import { Ticket } from '../../entities/ticket.entity';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { OperatorService } from '../../entities/operator-service.entity';
import * as bcrypt from 'bcryptjs';
import { Status } from '../../common/enums/status.enum';
import { GetOperatorAttentionMetricsDto, AttentionMetricsPeriod } from './dto/get-operator-attention-metrics.dto';
import { OperatorRole } from '../../entities/operator-role.entity';
import { Role as RoleEntity } from '../../entities/role.entity';
import { Role } from '../../common/enums/role.enum';
import { uniqueNormalizedRoles, sortRolesByRankDesc, normalizeRole } from '../../common/utils/role.utils';
import { OperatorShift } from '../../entities/operator-shift.entity';
import {
  OperatorAvailability,
  OperatorAvailabilityState,
} from '../../entities/operator-availability.entity';

type MutationActor = {
  id?: number | string | null;
  roles?: Array<string | Role | null | undefined> | null;
};

type OperatorServiceAssignment = {
  id: number;
  name: string;
  prefix: string | null;
  active: boolean;
  weight: number;
};

export interface OperatorAttentionHistoryItem {
  ticketId: number;
  ticketNumber: string;
  status: Status;
  serviceId: number;
  serviceName: string;
  startedAt: string | null;
  completedAt: string | null;
  attentionSeconds: number | null;
  maxAttentionTime: number | null;
  exceededSeconds: number | null;
}

export interface OperatorAttentionMetrics {
  operatorId: number;
  totalCompleted: number;
  averageAttentionSeconds: number | null;
  exceededCount: number;
  history: OperatorAttentionHistoryItem[];
  period: AttentionMetricsPeriod;
  from: string | null;
  to: string | null;
  statuses: Status[];
  limit: number;
  serviceId: number | null;
}

export type OperatorDerivedStatus = 'AVAILABLE' | 'CALLING' | 'BUSY' | 'OFFLINE';

export interface OperatorShiftHistoryItem {
  id: number;
  operatorId: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
}

export interface OperatorShiftHistory {
  operatorId: number;
  period: 'day' | 'week' | 'month' | 'all' | 'custom';
  from: string | null;
  to: string | null;
  totalShifts: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number | null;
  daysWorked: number;
  hasOpenShift: boolean;
  shifts: OperatorShiftHistoryItem[];
}

type ShiftHistoryQuery = {
  period?: 'day' | 'week' | 'month' | 'all';
  date?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class OperatorsService {
  private readonly logger = new Logger(OperatorsService.name);
  private readonly operatorRelations = {
    operatorRoles: { role: true },
  } as const;

  // ---- Helper tolerante para flags on/off desde DB (tinyint, boolean, string, null) ----
  private isTruthyOnOff(value: unknown, opts?: { nullMeans?: 'on' | 'off' }) {
    // true-ish
    if (value === true || value === 1 || value === '1') return true;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === 't' || v === 'y' || v === 'yes' || v === '1') return true;
      if (v === 'false' || v === 'f' || v === 'n' || v === 'no' || v === '0') return false;
    }
    // false-ish
    if (value === 0 || value === '0' || value === false) return false;
    // default para null/undefined/otros
    return opts?.nullMeans === 'off' ? false : true;
  }

  private isOperatorServiceActive(link?: Pick<OperatorService, 'active'> | null): boolean {
    return this.isTruthyOnOff(link?.active, { nullMeans: 'on' });
  }

  private isServiceActive(service?: Pick<ServiceEntity, 'active'> | null): boolean {
    return this.isTruthyOnOff(service?.active, { nullMeans: 'on' });
  }

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(ServiceEntity)
    private readonly svcRepo: Repository<ServiceEntity>,
    @InjectRepository(OperatorService)
    private readonly mapRepo: Repository<OperatorService>,
    @InjectRepository(OperatorShift)
    private readonly shiftRepo: Repository<OperatorShift>,
    @InjectRepository(OperatorAvailability)
    private readonly availabilityRepo: Repository<OperatorAvailability>,
    @InjectRepository(RoleEntity)
    private readonly rolesRepo: Repository<RoleEntity>,
    @InjectRepository(OperatorRole)
    private readonly operatorRoleRepo: Repository<OperatorRole>,
  ) {}

  private normalizeAvailabilityInput(value: unknown): OperatorAvailabilityState | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    if (!normalized) return null;

    if (['ACTIVE', 'AVAILABLE', 'ONLINE', 'ON', 'READY'].includes(normalized)) {
      return 'ACTIVE';
    }

    if (['BREAK', 'AWAY', 'PAUSE', 'PAUSED', 'REST'].includes(normalized)) {
      return 'BREAK';
    }

    if (['OFF', 'OFFLINE', 'INACTIVE', 'END', 'ENDED', 'FINISH', 'FINISHED'].includes(normalized)) {
      return 'OFF';
    }

    return null;
  }

  private fallbackAvailabilityForOperator(op: Operator): OperatorAvailabilityState {
    return op.active ? 'ACTIVE' : 'OFF';
  }

  private toResponse(op: Operator) {
    const { operatorRoles, ...rest } = op as Operator & { operatorRoles?: OperatorRole[] };
    const roles = sortRolesByRankDesc(uniqueNormalizedRoles(op.roles.map((role) => role.slug)));
    return {
      ...rest,
      role: op.role,
      roles,
      operatorRoles,
    };
  }

  private normalizeActor(actor?: MutationActor): { id?: number; roles: Role[] } {
    if (!actor) {
      return { roles: [] };
    }

    const candidateId = actor.id;
    const parsedId =
      typeof candidateId === 'number'
        ? candidateId
        : candidateId !== undefined && candidateId !== null
          ? Number(candidateId)
          : undefined;
    const id = Number.isFinite(parsedId) ? Number(parsedId) : undefined;

    const normalizedRoles = uniqueNormalizedRoles(
      Array.isArray(actor.roles) ? actor.roles : [],
    );

    return { id, roles: normalizedRoles };
  }

  private isSuperAdminOperator(operator: Operator): boolean {
    return operator.roles.some(
      (role) => normalizeRole(role?.slug) === Role.SUPERADMIN,
    );
  }

  private assertCanMutateOperator(target: Operator, actor?: MutationActor): void {
    if (!this.isSuperAdminOperator(target)) {
      return;
    }

    const { id: actorId } = this.normalizeActor(actor);
    if (actorId === target.id) {
      return;
    }

    throw new ForbiddenException('No se puede modificar una cuenta SuperAdmin');
  }

  private normalizeRolesInput(role?: Role | null, roles?: Role[] | null): Role[] {
    const provided = [
      ...(Array.isArray(roles) ? roles : []),
      role ?? undefined,
    ].filter((value): value is Role => value !== undefined && value !== null);
    const normalized = uniqueNormalizedRoles(provided);
    if (normalized.length === 0) {
      if (provided.length === 0) {
        return [Role.OPERATOR];
      }
      throw new BadRequestException('Roles inválidos');
    }
    return normalized;
  }

  private async replaceRoles(operatorId: number, roleSlugs: Role[]): Promise<void> {
    const uniqueSlugs = [...new Set(roleSlugs.map((slug) => slug.toUpperCase() as Role))];
    const roles = await this.rolesRepo.find({ where: { slug: In(uniqueSlugs) as any } });
    if (roles.length !== uniqueSlugs.length) {
      throw new BadRequestException('Alguno de los roles enviados no existe');
    }

    await this.operatorRoleRepo.delete({ operatorId });

    if (roles.length === 0) {
      return;
    }

    const links = roles.map((role) =>
      this.operatorRoleRepo.create({ operatorId, roleId: role.id }),
    );
    await this.operatorRoleRepo.save(links);
  }

  private async loadOperatorOrFail(id: number): Promise<Operator> {
    const op = await this.operatorRepo.findOne({
      where: { id },
      relations: this.operatorRelations,
    });
    if (!op) throw new NotFoundException('Operador no encontrado');
    return op;
  }

  // ========= CRUD =========

  async findAll() {
    const operators = await this.operatorRepo.find({ relations: this.operatorRelations });
    return operators.map((op) => this.toResponse(op));
  }

  async findActive() {
    const operators = await this.operatorRepo.find({
      where: { active: true as any },
      relations: this.operatorRelations,
    });
    return operators.map((op) => this.toResponse(op));
  }

  async findOne(id: number) {
    const op = await this.loadOperatorOrFail(id);
    return this.toResponse(op);
  }

  async create(dto: CreateOperatorDto) {
    // Unicidad
    const exists = await this.operatorRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (exists) {
      throw new ConflictException('Username o email ya existen');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const op = this.operatorRepo.create({
      name: dto.name,
      username: dto.username,
      email: dto.email ?? null,
      passwordHash,
      position: dto.position ?? null,
      active: dto.active ?? true,
    });

    const saved = await this.operatorRepo.save(op);

    const normalizedRoles = this.normalizeRolesInput(dto.role ?? null, dto.roles ?? null);
    await this.replaceRoles(saved.id, normalizedRoles);

    // si mandaron servicios, los habilitamos
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      await this.replaceServices(saved.id, dto.serviceIds);
    }

    const withRelations = await this.loadOperatorOrFail(saved.id);
    return this.toResponse(withRelations);
  }

  async update(id: number, body: Partial<CreateOperatorDto>, actor?: MutationActor) {
    const op = await this.loadOperatorOrFail(id);
    this.assertCanMutateOperator(op, actor);

    if (body.username && body.username !== op.username) {
      const exists = await this.operatorRepo.findOne({ where: { username: body.username } });
      if (exists) throw new ConflictException('Username ya existe');
      op.username = body.username;
    }
    if (body.email && body.email !== op.email) {
      const exists = await this.operatorRepo.findOne({ where: { email: body.email } });
      if (exists) throw new ConflictException('Email ya existe');
      op.email = body.email;
    }

    if (typeof body.name === 'string') op.name = body.name;
    if (typeof body.position === 'string') op.position = body.position;
    if (typeof body.active === 'boolean') op.active = body.active;

    // ✅ Ajustado a mínimo 3 caracteres
    if (body.password && body.password.length >= 3) {
      op.passwordHash = await bcrypt.hash(body.password, 10);
    }

    await this.operatorRepo.save(op);

    const incomingRoles = (body as any).roles as Role[] | undefined;
    const hasRolesArray = Array.isArray(incomingRoles);
    if (body.role !== undefined || hasRolesArray) {
      const normalizedRoles = this.normalizeRolesInput(body.role ?? null, incomingRoles ?? null);
      await this.replaceRoles(op.id, normalizedRoles);
    }

    const updated = await this.loadOperatorOrFail(op.id);
    return this.toResponse(updated);
  }

  async remove(id: number, actor?: MutationActor) {
    const op = await this.loadOperatorOrFail(id);
    this.assertCanMutateOperator(op, actor);

    const res = await this.operatorRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Operador no encontrado');
  }

  // ========= Derivación de estado por operador =========

  private deriveStatus(
    active: boolean,
    current: Pick<Ticket, 'status'> | null,
    availability?: OperatorAvailabilityState | null,
  ): OperatorDerivedStatus {
    if (availability === 'OFF') {
      return 'OFFLINE';
    }

    if (availability === 'BREAK') {
      return 'OFFLINE';
    }

    if (!active) return 'OFFLINE';
    if (current?.status === 'IN_PROGRESS') return 'BUSY';
    if (current?.status === 'CALLED') return 'CALLING';
    return 'AVAILABLE';
  }

  private mapLabel(status: OperatorDerivedStatus, availability?: OperatorAvailabilityState | null): string {
    if (status === 'OFFLINE' && availability === 'BREAK') {
      return 'En descanso';
    }

    if (status === 'OFFLINE') {
      return 'Fuera de turno';
    }

    switch (status) {
      case 'BUSY':
        return 'Atendiendo';
      case 'CALLING':
        return 'Llamando';
      case 'AVAILABLE':
        return 'Disponible';
      default:
        return 'Fuera de turno';
    }
  }

  private async fetchActiveServiceAssignments(operatorIds: number[]) {
    if (!operatorIds.length) {
      return new Map<number, OperatorServiceAssignment[]>();
    }

    const rows = await this.mapRepo.find({
      where: {
        operatorId: In(operatorIds) as any,
      },
      relations: { service: true },
      order: { serviceId: 'ASC' },
    });

    const assignments = new Map<number, OperatorServiceAssignment[]>();
    for (const row of rows) {
      if (!row.service || !this.isOperatorServiceActive(row)) continue;
      const current = assignments.get(row.operatorId) ?? [];
      current.push({
        id: row.serviceId,
        name: row.service.name,
        prefix: row.service.prefix ?? null,
        active: row.active,
        weight: row.weight,
      });
      assignments.set(row.operatorId, current);
    }

    for (const [, services] of assignments) {
      services.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }

    return assignments;
  }

  private async attachServicesToOperators<T extends { id: number }>(operators: T[]) {
    if (!operators.length) {
      return [] as Array<T & { serviceIds: number[]; services: OperatorServiceAssignment[] }>;
    }

    const assignments = await this.fetchActiveServiceAssignments(operators.map((op) => op.id));
    return operators.map((operator) => {
      const services = assignments.get(operator.id) ?? [];
      return {
        ...operator,
        serviceIds: services.map((service) => service.id),
        services,
      };
    });
  }

  private async buildOperatorsWithStatus(operators: Operator[]) {
    if (operators.length === 0) return [] as Array<ReturnType<typeof this.toResponse>>;

    const opIds = operators.map((op) => op.id);

    const [activeTickets, availabilityRows, openShifts] = await Promise.all([
      this.ticketRepo.find({
        where: {
          operatorId: In(opIds) as any,
          status: In(['IN_PROGRESS', 'CALLED']) as any,
        },
        relations: { service: true, operator: true, client: true },
        order: { startedAt: 'ASC', calledAt: 'ASC', id: 'ASC' },
      }),
      this.availabilityRepo.find({ where: { operatorId: In(opIds) as any } }),
      this.shiftRepo.find({
        where: { operatorId: In(opIds) as any, endedAt: IsNull() },
        order: { startedAt: 'DESC' },
      }),
    ]);

    const byOp = new Map<number, Ticket[]>();
    for (const ticket of activeTickets) {
      const list = byOp.get(ticket.operatorId as number) ?? [];
      list.push(ticket);
      byOp.set(ticket.operatorId as number, list);
    }

    const availabilityMap = new Map<number, OperatorAvailabilityState>();
    for (const row of availabilityRows) {
      const normalized = this.normalizeAvailabilityInput(row.state);
      if (normalized) {
        availabilityMap.set(row.operatorId, normalized);
      }
    }

    const shiftMap = new Map<number, OperatorShift>();
    for (const shift of openShifts) {
      if (!shiftMap.has(shift.operatorId)) {
        shiftMap.set(shift.operatorId, shift);
      }
    }

    const pickCurrent = (list?: Ticket[]): Ticket | null => {
      if (!list || list.length === 0) return null;
      const inProg = list.find((ticket) => ticket.status === 'IN_PROGRESS');
      if (inProg) return inProg;
      return list.find((ticket) => ticket.status === 'CALLED') ?? null;
    };

    return operators.map((op) => {
      const current = pickCurrent(byOp.get(op.id));
      const availability = availabilityMap.get(op.id) ?? this.fallbackAvailabilityForOperator(op);
      const derivedStatus = this.deriveStatus(
        !!op.active,
        current ? { status: current.status } : null,
        availability,
      );
      const shift = shiftMap.get(op.id) ?? null;

      return {
        ...this.toResponse(op),
        currentTicket: current
          ? {
              id: current.id,
              number: current.number,
              status: current.status,
              startedAt: current.startedAt ?? null,
              calledAt: current.calledAt ?? null,
              serviceId: current.serviceId,
              service: current.service
                ? {
                    id: current.service.id,
                    name: current.service.name,
                    maxAttentionTime: current.service.maxAttentionTime ?? null,
                  }
                : null,
              attentionDuration: current.attentionDuration ?? null,
            }
          : null,
        derivedStatus,
        derivedStatusLabel: this.mapLabel(derivedStatus, availability),
        availability,
        availabilityStatus: availability,
        status: availability,
        currentShift: shift
          ? {
              id: shift.id,
              startedAt: shift.startedAt,
              endedAt: shift.endedAt ?? null,
            }
          : null,
      };
    });
  }

  /**
   * ✅ SIN N+1: trae todos los tickets activos (IN_PROGRESS|CALLED) de los operadores
   *    y arma el "currentTicket" por operador priorizando IN_PROGRESS.
   *    Requiere índice: tickets(operator_id, status).
  */
  async findAllWithStatus() {
    try {
      const ops = await this.operatorRepo.find({ relations: this.operatorRelations });
      if (ops.length === 0) return [];

      const enriched = await this.buildOperatorsWithStatus(ops);
      const withServices = await this.attachServicesToOperators(enriched);

      withServices.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      return withServices;
    } catch (error) {
      const err = error as Error;
      this.logger.error('findAllWithStatus fallback triggered', err.stack ?? String(err));

      const ops = await this.operatorRepo.find({ relations: this.operatorRelations });
      const fallback = ops.map((op) => {
        const availability = this.fallbackAvailabilityForOperator(op);
        const status = this.deriveStatus(!!op.active, null, availability);
        return {
          ...this.toResponse(op),
          currentTicket: null,
          derivedStatus: status,
          derivedStatusLabel: this.mapLabel(status, availability),
          availability,
          availabilityStatus: availability,
          status: availability,
          currentShift: null,
        };
      });
      const withServices = await this.attachServicesToOperators(fallback);
      withServices.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      return withServices;
    }
  }

  async findOperatorsByService(serviceId: number) {
    await this.ensureService(serviceId);

    const links = (await this.mapRepo.find({
      where: { serviceId },
    })).filter((link) => this.isOperatorServiceActive(link));

    if (!links.length) {
      return [];
    }

    const operatorIds = Array.from(new Set(links.map((link) => link.operatorId)));
    const operators = await this.operatorRepo.find({
      where: { id: In(operatorIds) as any },
      relations: this.operatorRelations,
    });

    if (!operators.length) {
      return [];
    }

    try {
      const enriched = await this.buildOperatorsWithStatus(operators);
      const withServices = await this.attachServicesToOperators(enriched);
      withServices.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      return withServices;
    } catch (error) {
      const err = error as Error;
      this.logger.error('findOperatorsByService fallback triggered', err.stack ?? String(err));

      const fallback = operators.map((op) => {
        const availability = this.fallbackAvailabilityForOperator(op);
        const status = this.deriveStatus(!!op.active, null, availability);
        return {
          ...this.toResponse(op),
          currentTicket: null,
          derivedStatus: status,
          derivedStatusLabel: this.mapLabel(status, availability),
          availability,
          availabilityStatus: availability,
          status: availability,
          currentShift: null,
        };
      });
      const withServices = await this.attachServicesToOperators(fallback);
      withServices.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      return withServices;
    }
  }

  async findOneWithStatus(operatorId: number) {
    const op = await this.loadOperatorOrFail(operatorId);
    try {
      const [enriched] = await this.buildOperatorsWithStatus([op]);
      if (enriched) {
        const [withServices] = await this.attachServicesToOperators([enriched]);
        if (withServices) {
          return withServices;
        }
        return enriched;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('findOneWithStatus fallback triggered', err.stack ?? String(err));
    }

    const availability = this.fallbackAvailabilityForOperator(op);
    const status = this.deriveStatus(!!op.active, null, availability);
    const fallback = {
      ...this.toResponse(op),
      currentTicket: null,
      derivedStatus: status,
      derivedStatusLabel: this.mapLabel(status, availability),
      availability,
      availabilityStatus: availability,
      status: availability,
      currentShift: null,
    };
    const [withServices] = await this.attachServicesToOperators([fallback]);
    return withServices ?? fallback;
  }

  async updateAvailabilityStatus(
    operatorId: number,
    status: OperatorAvailabilityState | string,
    actor?: MutationActor,
  ) {
    const op = await this.loadOperatorOrFail(operatorId);
    this.assertCanMutateOperator(op, actor);

    const normalized = this.normalizeAvailabilityInput(status);
    if (!normalized) {
      throw new BadRequestException('Estado de disponibilidad inválido');
    }

    await this.dataSource.transaction(async (manager) => {
      const availabilityRepo = manager.getRepository(OperatorAvailability);
      const shiftRepo = manager.getRepository(OperatorShift);

      let availability = await availabilityRepo.findOne({ where: { operatorId } });
      if (!availability) {
        availability = availabilityRepo.create({ operatorId, state: normalized });
      } else {
        availability.state = normalized;
      }
      await availabilityRepo.save(availability);

      const ensureOpenShift = async () => {
        const existing = await shiftRepo.findOne({
          where: { operatorId, endedAt: IsNull() },
          order: { startedAt: 'DESC' },
        });
        if (!existing) {
          const shift = shiftRepo.create({ operatorId, startedAt: new Date(), endedAt: null });
          await shiftRepo.save(shift);
        }
      };

      if (normalized === 'ACTIVE') {
        await ensureOpenShift();
      } else if (normalized === 'BREAK') {
        await ensureOpenShift();
      } else if (normalized === 'OFF') {
        const openShift = await shiftRepo.findOne({
          where: { operatorId, endedAt: IsNull() },
          order: { startedAt: 'DESC' },
        });
        if (openShift) {
          openShift.endedAt = new Date();
          await shiftRepo.save(openShift);
        }
      }
    });

    return this.findOneWithStatus(operatorId);
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfWeek(date: Date): Date {
    const d = this.startOfDay(date);
    const day = d.getDay();
    const diff = (day + 6) % 7; // convierte domingo=0 en lunes=0
    d.setDate(d.getDate() - diff);
    return d;
  }

  private startOfMonth(date: Date): Date {
    const d = this.startOfDay(date);
    d.setDate(1);
    return d;
  }

  private addDays(date: Date, amount: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    return d;
  }

  private addMonths(date: Date, amount: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + amount);
    return d;
  }

  private startOfYear(date: Date): Date {
    const d = this.startOfDay(date);
    d.setMonth(0, 1);
    return d;
  }

  private addYears(date: Date, amount: number): Date {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + amount);
    return d;
  }

  private normalizeStatuses(statuses?: Status[]): Status[] {
    const allowed = new Set(Object.values(Status));
    if (!statuses || statuses.length === 0) {
      return [Status.COMPLETED, Status.IN_PROGRESS, Status.CALLED, Status.CANCELLED];
    }

    const normalized = statuses
      .map((status) => (typeof status === 'string' ? (status.toUpperCase() as Status) : status))
      .filter((status): status is Status => allowed.has(status as any));

    if (normalized.length === 0) {
      return [Status.COMPLETED, Status.IN_PROGRESS, Status.CALLED, Status.CANCELLED];
    }

    return Array.from(new Set(normalized));
  }

  private resolveAttentionRange(options?: GetOperatorAttentionMetricsDto): {
    period: AttentionMetricsPeriod;
    from: Date | null;
    to: Date | null;
  } {
    if (!options) {
      const start = this.startOfWeek(new Date());
      return { period: 'week', from: start, to: this.addDays(start, 7) };
    }

    if (options.from || options.to) {
      const start = options.from ? new Date(options.from) : null;
      const end = options.to ? new Date(options.to) : null;
      return {
        period: 'custom',
        from: start && !Number.isNaN(start.getTime()) ? start : null,
        to: end && !Number.isNaN(end.getTime()) ? end : null,
      };
    }

    let reference = options.date ? new Date(options.date) : new Date();
    if (Number.isNaN(reference.getTime())) {
      reference = new Date();
    }

    const normalized = (options.period ?? 'week').toLowerCase();

    if (normalized === 'day') {
      const start = this.startOfDay(reference);
      return { period: 'day', from: start, to: this.addDays(start, 1) };
    }

    if (normalized === 'month') {
      const start = this.startOfMonth(reference);
      return { period: 'month', from: start, to: this.addMonths(start, 1) };
    }

    if (normalized === 'year') {
      const start = this.startOfYear(reference);
      return { period: 'year', from: start, to: this.addYears(start, 1) };
    }

    if (normalized === 'all') {
      return { period: 'all', from: null, to: null };
    }

    const start = this.startOfWeek(reference);
    return { period: 'week', from: start, to: this.addDays(start, 7) };
  }

  private resolveShiftRange(options: ShiftHistoryQuery | undefined) {
    if (!options) {
      const start = this.startOfWeek(new Date());
      return { period: 'week' as const, from: start, to: this.addDays(start, 7) };
    }

    if (options.from || options.to) {
      const start = options.from ? new Date(options.from) : null;
      const end = options.to ? new Date(options.to) : null;
      return {
        period: 'custom' as const,
        from: start && !Number.isNaN(start.getTime()) ? start : null,
        to: end && !Number.isNaN(end.getTime()) ? end : null,
      };
    }

    let reference = options.date ? new Date(options.date) : new Date();
    if (Number.isNaN(reference.getTime())) {
      reference = new Date();
    }

    const normalized = (options.period ?? 'week').toLowerCase();

    if (normalized === 'day') {
      const start = this.startOfDay(reference);
      return { period: 'day' as const, from: start, to: this.addDays(start, 1) };
    }

    if (normalized === 'month') {
      const start = this.startOfMonth(reference);
      return { period: 'month' as const, from: start, to: this.addMonths(start, 1) };
    }

    if (normalized === 'all') {
      return { period: 'all' as const, from: null, to: null };
    }

    const start = this.startOfWeek(reference);
    return { period: 'week' as const, from: start, to: this.addDays(start, 7) };
  }

  async getShiftHistory(operatorId: number, options?: ShiftHistoryQuery): Promise<OperatorShiftHistory> {
    await this.loadOperatorOrFail(operatorId);

    const range = this.resolveShiftRange(options);

    const qb = this.shiftRepo
      .createQueryBuilder('shift')
      .where('shift.operatorId = :operatorId', { operatorId })
      .orderBy('shift.startedAt', 'DESC');

    if (range.from) {
      qb.andWhere('shift.startedAt >= :from', { from: range.from });
    }

    if (range.to) {
      qb.andWhere('shift.startedAt < :to', { to: range.to });
    }

    const shifts = await qb.getMany();
    const now = new Date();

    const items: OperatorShiftHistoryItem[] = shifts.map((shift) => {
      const endedAt = shift.endedAt ?? null;
      const effectiveEnd = endedAt ?? now;
      const durationSeconds = Math.max(
        0,
        Math.round((effectiveEnd.getTime() - shift.startedAt.getTime()) / 1000),
      );

      return {
        id: shift.id,
        operatorId: shift.operatorId,
        startedAt: shift.startedAt.toISOString(),
        endedAt: endedAt ? endedAt.toISOString() : null,
        durationSeconds,
      };
    });

    const totalDurationSeconds = items.reduce((acc, item) => acc + item.durationSeconds, 0);
    const averageDurationSeconds = items.length > 0
      ? Math.round(totalDurationSeconds / items.length)
      : null;
    const daysWorked = new Set(items.map((item) => item.startedAt.slice(0, 10))).size;
    const hasOpenShift = items.some((item) => item.endedAt === null);

    return {
      operatorId,
      period: range.period,
      from: range.from ? range.from.toISOString() : null,
      to: range.to ? range.to.toISOString() : null,
      totalShifts: items.length,
      totalDurationSeconds,
      averageDurationSeconds,
      daysWorked,
      hasOpenShift,
      shifts: items,
    };
  }

  async getAttentionMetrics(
    operatorId: number,
    options?: GetOperatorAttentionMetricsDto,
  ): Promise<OperatorAttentionMetrics> {
    await this.loadOperatorOrFail(operatorId);

    const range = this.resolveAttentionRange(options);
    const statuses = this.normalizeStatuses(options?.statuses);
    const requestedLimit = options?.limit ?? 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 200);
    const serviceId = options?.serviceId ?? null;

    let totalCompleted = 0;
    let avgSeconds: number | null = null;
    let exceededCount = 0;

    if (!options?.statuses || statuses.includes(Status.COMPLETED)) {
      const statsQuery = this.ticketRepo
        .createQueryBuilder('t')
        .leftJoin('t.service', 's')
        .select('COUNT(*)', 'total')
        .addSelect(
          "AVG(COALESCE(t.attention_duration, CASE WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, t.started_at, t.completed_at) ELSE NULL END))",
          'avg',
        )
        .addSelect(
          "SUM(CASE WHEN s.max_attention_time IS NOT NULL AND COALESCE(t.attention_duration, CASE WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, t.started_at, t.completed_at) ELSE NULL END) > s.max_attention_time * 60 THEN 1 ELSE 0 END)",
          'exceeded',
        )
        .where('t.operator_id = :operatorId', { operatorId })
        .andWhere('t.status = :statusCompleted', { statusCompleted: Status.COMPLETED });

      if (range.from) {
        statsQuery.andWhere(
          'COALESCE(t.completed_at, t.started_at, t.called_at, t.created_at) >= :from',
          { from: range.from },
        );
      }

      if (range.to) {
        statsQuery.andWhere(
          'COALESCE(t.completed_at, t.started_at, t.called_at, t.created_at) < :to',
          { to: range.to },
        );
      }

      if (serviceId !== null) {
        statsQuery.andWhere('t.service_id = :serviceId', { serviceId });
      }

      const statsRaw = await statsQuery.getRawOne<{ total: string | null; avg: string | null; exceeded: string | null }>();

      totalCompleted = statsRaw?.total !== undefined ? Number(statsRaw.total ?? 0) : 0;
      avgSeconds =
        statsRaw?.avg !== undefined && statsRaw.avg !== null
          ? Math.round(Number(statsRaw.avg))
          : null;
      exceededCount = statsRaw?.exceeded !== undefined ? Number(statsRaw.exceeded ?? 0) : 0;
    }

    const historyQuery = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.service', 'service')
      .where('ticket.operator_id = :operatorId', { operatorId })
      .andWhere('ticket.status IN (:...statuses)', { statuses });

    if (range.from) {
      historyQuery.andWhere(
        'COALESCE(ticket.completed_at, ticket.started_at, ticket.called_at, ticket.created_at) >= :from',
        { from: range.from },
      );
    }

    if (range.to) {
      historyQuery.andWhere(
        'COALESCE(ticket.completed_at, ticket.started_at, ticket.called_at, ticket.created_at) < :to',
        { to: range.to },
      );
    }

    if (serviceId !== null) {
      historyQuery.andWhere('ticket.service_id = :serviceId', { serviceId });
    }

    historyQuery
      .orderBy('ticket.completed_at', 'DESC')
      .addOrderBy('ticket.started_at', 'DESC')
      .addOrderBy('ticket.called_at', 'DESC')
      .addOrderBy('ticket.id', 'DESC')
      .limit(limit);

    const historyTickets = await historyQuery.getMany();

    const now = Date.now();
    const history: OperatorAttentionHistoryItem[] = historyTickets.map((ticket) => {
      const startedAt = ticket.startedAt ?? ticket.calledAt ?? null;
      let attentionSeconds: number | null = null;

      if (typeof ticket.attentionDuration === 'number') {
        attentionSeconds = ticket.attentionDuration;
      } else if (ticket.status === Status.COMPLETED && ticket.startedAt && ticket.completedAt) {
        attentionSeconds = Math.max(
          0,
          Math.round((ticket.completedAt.getTime() - ticket.startedAt.getTime()) / 1000),
        );
      } else if (ticket.status === Status.IN_PROGRESS && startedAt) {
        attentionSeconds = Math.max(0, Math.round((now - startedAt.getTime()) / 1000));
      }

      const maxMinutes = ticket.service?.maxAttentionTime ?? null;
      const limitSeconds = maxMinutes ? maxMinutes * 60 : null;
      const exceededSeconds =
        limitSeconds !== null && attentionSeconds !== null
          ? Math.max(0, attentionSeconds - limitSeconds)
          : null;

      return {
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        status: ticket.status,
        serviceId: ticket.serviceId,
        serviceName: ticket.service?.name ?? '',
        startedAt: startedAt ? startedAt.toISOString() : null,
        completedAt: ticket.completedAt ? ticket.completedAt.toISOString() : null,
        attentionSeconds,
        maxAttentionTime: maxMinutes,
        exceededSeconds,
      };
    });

    return {
      operatorId,
      totalCompleted,
      averageAttentionSeconds: avgSeconds !== null && Number.isFinite(avgSeconds) ? avgSeconds : null,
      exceededCount,
      history,
      period: range.period,
      from: range.from ? range.from.toISOString() : null,
      to: range.to ? range.to.toISOString() : null,
      statuses,
      limit,
      serviceId,
    };
  }

  // ========= Lógica de negocio: call-next por servicio =========
  async callNextByService(operatorId: number, serviceId: number) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SELECT id FROM operators WHERE id = ? FOR UPDATE`, [operatorId]);

      const operator = await runner.manager.findOne(Operator, {
        where: { id: operatorId, active: true as any },
      });
      if (!operator) throw new BadRequestException('Operador inválido o inactivo');

      const servicesLinks = await runner.manager.find(OperatorService, {
        where: { operatorId },
        relations: { service: true },
      });

      const normalizedServiceId = Number(String(serviceId).trim());
      if (!Number.isFinite(normalizedServiceId)) {
        throw new BadRequestException('Servicio inválido');
      }

      // Log diagnóstico para entender por qué no aparece habilitado
      this.logger.debug(
        '[callNextByService] op=%s svc=%s links=%j',
        operatorId,
        normalizedServiceId,
        servicesLinks.map((l) => ({
          serviceId: l.serviceId,
          linkActive: l.active,
          svcActive: l.service?.active ?? null,
        })),
      );

      const activeServiceIds = Array.from(
        new Set(
          servicesLinks
            .filter((link) => this.isOperatorServiceActive(link))
            .filter((link) => (link.service ? this.isServiceActive(link.service) : true))
            .map((link) => Number(link.serviceId))
            .filter((id) => Number.isFinite(id)),
        ),
      );

      this.logger.debug('[callNextByService] activeServiceIds=%j', activeServiceIds);

      if (!activeServiceIds.length) {
        throw new BadRequestException('El operador no tiene servicios habilitados');
      }

      if (!activeServiceIds.includes(normalizedServiceId)) {
        throw new BadRequestException('El operador no está habilitado para este servicio');
      }

      const already = await runner.query(
        `SELECT 1 FROM tickets
         WHERE operator_id = ? AND status IN ('CALLED','IN_PROGRESS')
         LIMIT 1`,
        [operatorId],
      );
      if (already?.length) {
        throw new BadRequestException('El operador ya tiene un ticket activo');
      }

      const requestedRows = await runner.query(
        `SELECT t.id FROM tickets t
         WHERE t.status = 'WAITING' AND t.service_id = ?
          ORDER BY t.priority_level DESC,
                   COALESCE(t.requeued_at, t.created_at) ASC,
                   t.id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
        [normalizedServiceId],
      );

      let ticketId: number | null = requestedRows?.length ? (requestedRows[0].id as number) : null;

      if (ticketId === null) {
        const fallbackServiceIds = activeServiceIds.filter((id) => id !== normalizedServiceId);

        if (fallbackServiceIds.length) {
          const placeholders = fallbackServiceIds.map(() => '?').join(', ');
          const fallbackRows = await runner.query(
            `SELECT t.id FROM tickets t
             WHERE t.status = 'WAITING' AND t.service_id IN (${placeholders})
             ORDER BY t.priority_level DESC,
                      COALESCE(t.requeued_at, t.created_at) ASC,
                      t.id ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED`,
            fallbackServiceIds,
          );

          if (fallbackRows?.length) {
            ticketId = fallbackRows[0].id as number;
          }
        }
      }

      if (ticketId === null) {
        throw new NotFoundException(
          'No hay tickets en espera para el servicio solicitado ni otros servicios asignados',
        );
      }

      await runner.query(
        `UPDATE tickets
         SET status = 'CALLED',
             operator_id = ?,
             called_at = NOW(),
             actual_wait_time = TIMESTAMPDIFF(MINUTE, created_at, NOW())
         WHERE id = ?`,
        [operatorId, ticketId],
      );

      const ticket = await runner.manager.findOneByOrFail(Ticket, { id: ticketId as any });
      await runner.commitTransaction();
      return ticket;
    } catch (e) {
      await runner.rollbackTransaction();
      this.logger.error(`callNextByService failed: ${e}`);
      throw e;
    } finally {
      await runner.release();
    }
  }

  // ========= Lógica de negocio: call-next considerando todos los servicios =========
  async callNext(operatorId: number) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.query(`SELECT id FROM operators WHERE id = ? FOR UPDATE`, [operatorId]);

      const operator = await runner.manager.findOne(Operator, {
        where: { id: operatorId, active: true as any },
      });
      if (!operator) {
        throw new BadRequestException('Operador inválido o inactivo');
      }

      const services = await runner.manager.find(OperatorService, {
        where: { operatorId },
      });
      const activeServiceIds = services
        .filter((link) => this.isOperatorServiceActive(link))
        .map((link) => link.serviceId);

      if (!activeServiceIds.length) {
        throw new BadRequestException('El operador no tiene servicios habilitados');
      }

      const already = await runner.query(
        `SELECT 1 FROM tickets
         WHERE operator_id = ? AND status IN ('CALLED','IN_PROGRESS')
         LIMIT 1`,
        [operatorId],
      );
      if (already?.length) {
        throw new BadRequestException('El operador ya tiene un ticket activo');
      }

      const placeholders = activeServiceIds.map(() => '?').join(', ');
      const rows = await runner.query(
        `SELECT t.id, t.service_id FROM tickets t
         WHERE t.status = 'WAITING' AND t.service_id IN (${placeholders})
        ORDER BY t.priority_level DESC,
                  COALESCE(t.requeued_at, t.created_at) ASC,
                  t.id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        activeServiceIds,
      );

      if (!rows?.length) {
        throw new NotFoundException('No hay tickets en espera para los servicios asignados');
      }

      const ticketId = rows[0].id as number;

      await runner.query(
        `UPDATE tickets
         SET status = 'CALLED',
             operator_id = ?,
             called_at = NOW(),
             actual_wait_time = TIMESTAMPDIFF(MINUTE, created_at, NOW())
         WHERE id = ?`,
        [operatorId, ticketId],
      );

      const ticket = await runner.manager.findOneByOrFail(Ticket, { id: ticketId as any });
      await runner.commitTransaction();
      return ticket;
    } catch (e) {
      await runner.rollbackTransaction();
      this.logger.error(`callNext failed: ${e}`);
      throw e;
    } finally {
      await runner.release();
    }
  }

  private async ensureOperator(id: number): Promise<Operator> {
    return this.loadOperatorOrFail(id);
  }

  private async ensureService(id: number): Promise<ServiceEntity> {
    const service = await this.svcRepo.findOne({ where: { id: id as any } });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return service;
  }

  /** Lista servicios habilitados del operador (activos) */
  async getServicesForOperator(operatorId: number) {
    await this.ensureOperator(operatorId);
    const assignments = await this.fetchActiveServiceAssignments([operatorId]);
    const services = assignments.get(operatorId) ?? [];

    return {
      operatorId,
      serviceIds: services.map((service) => service.id),
      services,
    };
  }

  /** Reemplaza todas las habilitaciones del operador por la lista provista */
  async replaceServices(operatorId: number, serviceIds: number[]) {
    await this.ensureOperator(operatorId);

    const unique = Array.from(new Set(serviceIds));
    if (unique.length !== serviceIds.length) {
      throw new BadRequestException('serviceIds contiene duplicados');
    }

    const svcs = await this.svcRepo.find({ where: { id: In(unique) } });
    if (svcs.length !== unique.length) {
      const found = new Set(svcs.map((s) => s.id));
      const missing = unique.filter((id) => !found.has(id));
      throw new BadRequestException(`Servicios inexistentes: ${missing.join(', ')}`);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager
        .createQueryBuilder()
        .delete()
        .from(OperatorService)
        .where('operator_id = :op', { op: operatorId })
        .andWhere(unique.length ? 'service_id NOT IN (:...ids)' : '1=1', { ids: unique })
        .execute();

      for (const sid of unique) {
        await qr.query(
          `
          INSERT INTO operator_services (operator_id, service_id, active, weight)
          VALUES (?, ?, 1, 1)
          ON DUPLICATE KEY UPDATE
            active = VALUES(active),
            weight = VALUES(weight),
            updated_at = CURRENT_TIMESTAMP(6)
          `,
          [operatorId, sid],
        );
      }

      await qr.commitTransaction();
      return this.getServicesForOperator(operatorId);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** Reemplaza todos los operadores habilitados para un servicio */
  async replaceOperatorsForService(serviceId: number, operatorIds: number[]) {
    await this.ensureService(serviceId);

    const unique = Array.from(new Set(operatorIds));
    if (unique.length !== operatorIds.length) {
      throw new BadRequestException('operatorIds contiene duplicados');
    }

    if (unique.length > 0) {
      const operators = await this.operatorRepo.find({ where: { id: In(unique) as any } });
      if (operators.length !== unique.length) {
        const found = new Set(operators.map((op) => op.id));
        const missing = unique.filter((id) => !found.has(id));
        throw new BadRequestException(`Operadores inexistentes: ${missing.join(', ')}`);
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager
        .createQueryBuilder()
        .delete()
        .from(OperatorService)
        .where('service_id = :service', { service: serviceId })
        .andWhere(unique.length ? 'operator_id NOT IN (:...ids)' : '1=1', { ids: unique })
        .execute();

      for (const operatorId of unique) {
        await qr.query(
          `
          INSERT INTO operator_services (operator_id, service_id, active, weight)
          VALUES (?, ?, 1, 1)
          ON DUPLICATE KEY UPDATE
            active = VALUES(active),
            weight = VALUES(weight),
            updated_at = CURRENT_TIMESTAMP(6)
          `,
          [operatorId, serviceId],
        );
      }

      await qr.commitTransaction();
      return this.findOperatorsByService(serviceId);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /* ========= Utilidad: sincronizar/forzar hash de un usuario (p.ej. admin) ========= */
  async syncAdminPasswordHash(userIdOrEmail: string, plainPassword: string) {
    if (!userIdOrEmail?.trim() || !plainPassword?.trim()) {
      throw new BadRequestException('Parámetros inválidos');
    }
    const hash = await bcrypt.hash(plainPassword, 10);

    await this.dataSource.query(
      `UPDATE operators
         SET password_hash = ?
       WHERE TRIM(username) = ? OR LOWER(TRIM(email)) = LOWER(?)
       LIMIT 1`,
      [hash, userIdOrEmail, userIdOrEmail],
    );

    try {
      const updated = await this.operatorRepo
        .createQueryBuilder('op')
        .addSelect('op.passwordHash')
        .where('TRIM(op.username) = :u OR LOWER(TRIM(op.email)) = LOWER(:u)', { u: userIdOrEmail })
        .getOne();

      this.logger.log('[syncAdminPasswordHash]', {
        user: userIdOrEmail,
        updatedId: updated?.id ?? null,
        hasHash: !!updated?.passwordHash,
      });

      if (!updated?.passwordHash) {
        throw new NotFoundException('Usuario no encontrado o sin hash actualizado');
      }
      return { ok: true, id: updated.id };
    } catch (e) {
      this.logger.warn(`[syncAdminPasswordHash] verificación: ${(e as any)?.message}`);
      return { ok: true, id: null };
    }
  }

  // ========= ADMIN: cambiar contraseña de un operador =========
  async adminUpdatePassword(operatorId: number, newPassword: string, actor?: MutationActor) {
    const op = await this.loadOperatorOrFail(operatorId);
    this.assertCanMutateOperator(op, actor);

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await this.operatorRepo.update(operatorId, { passwordHash });

    // Auditoría mínima por logs (si tenés tabla Audit, persistilo allí)
    const { id: actorId } = this.normalizeActor(actor);
    this.logger.log(`[adminUpdatePassword] actor=${actorId ?? 'n/a'} target=${operatorId}`);

    return { id: operatorId, updated: true };
  }
}
