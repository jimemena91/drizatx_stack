import { Status } from '../../common/enums/status.enum';
import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Ticket } from '../../entities/ticket.entity';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { Operator } from '../../entities/operator.entity';
import { Client } from '../../entities/client.entity';

import { ServicesService } from '../../modules/services/services.service';
import { ClientsService } from '../../modules/clients/clients.service';
import { TicketsService } from '../../modules/tickets/tickets.service';

type DashboardServiceSummary = {
  serviceId: number;
  serviceName: string;
  serviceIcon: string | null;
  waitingCount: number;
  avgWaitTime: number | null;
  inProgressCount: number;
  completedCountToday: number;
  absentCountToday: number;
  attendedCountToday: number;
};

export type QueueDashboardResponse = {
  services: DashboardServiceSummary[];
  updatedAt: string;
  currentTicket: Ticket | null;
  nextTickets: Ticket[];
  inProgressTickets: Ticket[];
  calledTickets: Ticket[];
  waitingTickets: Ticket[];
  absentTickets: Ticket[];
  recentlyCompletedTickets: Ticket[];
};

@Injectable()
export class QueueService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,

    // Repos necesarios
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    // Servicios de dominio
    private readonly servicesService: ServicesService,
    private readonly clientsService: ClientsService,
    private readonly ticketsService: TicketsService,
  ) {}

  private normalizePriorityLevel(input: unknown): number | null {
    if (input === null || input === undefined) {
      return null;
    }

    const numeric = Number(input);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    const rounded = Math.round(numeric);
    return Math.max(1, Math.min(6, rounded));
  }

  // Servicios activos ordenados
  async getActiveServices(): Promise<ServiceEntity[]> {
    return this.servicesService.findActive();
  }

  // Crear ticket en cola
  async enqueue(serviceId: number, clientId?: number): Promise<Ticket> {
    const client = clientId ? await this.clientsService.findOne(clientId) : undefined;

    return this.dataSource.transaction(async (manager) => {
      const { service, nextNumber, issuedDate } = await this.servicesService.reserveNextTicketNumber(
        manager,
        serviceId,
      );

      const ticketRepo = manager.getRepository(Ticket);
      const number = `${service.prefix}${String(nextNumber).padStart(3, '0')}`;
      const issuedForDate = issuedDate
        ? new Date(`${issuedDate}T00:00:00`)
        : new Date();
      const waiting = await ticketRepo.count({
        where: { serviceId: service.id, status: Status.WAITING } as any,
      });
      const estimatedWaitTime = waiting * (service.estimatedTime ?? 10);

      const servicePriorityLevel = this.normalizePriorityLevel(service.priorityLevel);
      const legacyServicePriorityLevel = this.normalizePriorityLevel(
        (service as unknown as { priority?: number | null })?.priority,
      );
      const priorityLevel = servicePriorityLevel ?? legacyServicePriorityLevel ?? 3;

      const entity = ticketRepo.create({
        number,
        serviceId: service.id,
        issuedForDate,
        clientId: client?.id ?? null,
        status: Status.WAITING,
        priorityLevel,
        estimatedWaitTime,
      });

      const saved = await ticketRepo.save(entity);
      (saved as Ticket & { service?: ServiceEntity }).service = service;
      return saved;
    });
  }

  // Estimación básica: WAITING * estimatedTime del servicio
  async estimateWaitTime(serviceId: number): Promise<number> {
    const servicePromise = this.servicesService
      .findOne(serviceId)
      .catch(() => null as ServiceEntity | null);

    const [service, waiting] = await Promise.all([
      servicePromise,
      this.ticketRepo.count({ where: { serviceId, status: Status.WAITING } as any }),
    ]);
    const perTicket = service?.estimatedTime ?? 10;
    return waiting * perTicket;
  }

  // Próximo ticket a llamar con respeto a prioridad 6 y alternancia configurable
  async nextTicketToCall(serviceId: number): Promise<Ticket | null> {
    const buildBaseQuery = () =>
      this.ticketRepo
        .createQueryBuilder('ticket')
        .where('ticket.serviceId = :serviceId', { serviceId })
        .andWhere('ticket.status = :status', { status: Status.WAITING });

    const prioritySix = await buildBaseQuery()
      .andWhere('ticket.priority_level = :prioritySix', { prioritySix: 6 })
      .orderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .limit(1)
      .getOne();

    if (prioritySix) {
      return prioritySix;
    }

    const alternateEvery =
      typeof (this.ticketsService as any)?.getAlternatePriorityEvery === 'function'
        ? await (this.ticketsService as any).getAlternatePriorityEvery()
        : 3;

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

  // Llamar un ticket
  async callTicket(ticketId: number, operatorId: number): Promise<Ticket> {
    return this.ticketsService.callTicket(ticketId, operatorId);
  }

  // Iniciar atención
  async startTicket(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket no encontrado');
    if (ticket.status !== Status.CALLED) throw new Error('Solo se puede iniciar desde CALLED');

    ticket.status = Status.IN_PROGRESS;
    ticket.startedAt = new Date();
    ticket.attentionDuration = null;

    return this.ticketRepo.save(ticket);
  }

  // Completar ticket
  async completeTicket(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket no encontrado');
    if (ticket.status !== Status.IN_PROGRESS) throw new Error('Solo se puede completar desde IN_PROGRESS');

    ticket.status = Status.COMPLETED;
    ticket.completedAt = new Date();
    if (ticket.startedAt) {
      const ms = ticket.completedAt.getTime() - ticket.startedAt.getTime();
      ticket.attentionDuration = Math.max(0, Math.round(ms / 1000));
    }

    // cálculo simple del tiempo real de espera si no lo tenés
    if (ticket.calledAt && ticket.createdAt) {
      const ms = ticket.calledAt.getTime() - ticket.createdAt.getTime();
      ticket.actualWaitTime = Math.max(0, Math.round(ms / 60000));
    }

    return this.ticketRepo.save(ticket);
  }

  // Tickets visibles en dashboard
  async dashboardTickets(): Promise<Ticket[]> {
    const statuses = [Status.CALLED, Status.IN_PROGRESS, Status.WAITING, Status.ABSENT];

    return this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.operator', 'operator')
      .leftJoinAndSelect('ticket.client', 'client')
      .leftJoin('ticket.service', 'service')
      .addSelect([
        'service.id',
        'service.name',
        'service.prefix',
        'service.nextTicketNumber',
        'service.active',
        'service.priority_level',
        'service.estimatedTime',
        'service.createdAt',
        'service.updatedAt',
      ])
      .where('ticket.status IN (:...statuses)', { statuses })
      .orderBy('ticket.priority_level', 'DESC')
      .addOrderBy('COALESCE(ticket.requeued_at, ticket.created_at)', 'ASC')
      .addOrderBy('ticket.id', 'ASC')
      .getMany();
  }

  /**
   * Resumen para el dashboard por servicio.
   * Devuelve: { services: [{ serviceId, serviceName, waitingCount, avgWaitTime, inProgressCount, completedCountToday }], updatedAt }
   */
  async getDashboard(): Promise<QueueDashboardResponse> {
    // Ventana de "hoy" sin depender de funciones del motor
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const nextDay = new Date(startOfDay);
    nextDay.setDate(startOfDay.getDate() + 1);

    const dashboardQuery = this.dataSource
      .createQueryBuilder()
      .select('s.id', 'serviceId')
      .addSelect('s.name', 'serviceName')
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.status = :waitingStatus THEN 1 ELSE 0 END), 0)`,
        'waitingCount',
      )
      .addSelect(
        `ROUND(AVG(CASE
          WHEN t.status = :waitingStatus AND t.estimated_wait_time IS NOT NULL
          THEN t.estimated_wait_time
          ELSE NULL
        END))`,
        'avgWaitTime',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.status IN (:...inProgressStatuses) THEN 1 ELSE 0 END), 0)`,
        'inProgressCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE
          WHEN t.status = :completedStatus
            AND t.completed_at >= :startOfDay
            AND t.completed_at < :nextDay
          THEN 1 ELSE 0
        END), 0)`,
        'completedCountToday',
      )
      .addSelect(
        `COALESCE(SUM(CASE
          WHEN t.status = :absentStatus
            AND t.absent_at IS NOT NULL
            AND t.absent_at >= :startOfDay
            AND t.absent_at < :nextDay
          THEN 1 ELSE 0
        END), 0)`,
        'absentCountToday',
      )
      .from(ServiceEntity, 's')
      .leftJoin(Ticket, 't', 't.service_id = s.id')
      .groupBy('s.id')
      .addGroupBy('s.name')
      .addGroupBy('s.priority_level')
      .orderBy('s.priority_level', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .setParameter('waitingStatus', Status.WAITING)
      .setParameter('inProgressStatuses', [Status.IN_PROGRESS, Status.CALLED])
      .setParameter('completedStatus', Status.COMPLETED)
      .setParameter('startOfDay', startOfDay)
      .setParameter('nextDay', nextDay)
      .setParameter('absentStatus', Status.ABSENT);

    const [rows, dashboardTickets, recentlyCompletedTickets, servicesCatalog] = await Promise.all([
      dashboardQuery.getRawMany(),
      this.dashboardTickets(),
      this.ticketRepo
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.operator', 'operator')
        .leftJoinAndSelect('ticket.client', 'client')
        .leftJoinAndSelect('ticket.service', 'service')
        .where('ticket.status = :completedStatus', { completedStatus: Status.COMPLETED })
        .andWhere('ticket.startedAt IS NOT NULL')
        .andWhere('ticket.startedAt >= :startOfDay', { startOfDay })
        .andWhere('ticket.startedAt < :nextDay', { nextDay })
        .orderBy('ticket.startedAt', 'DESC')
        .addOrderBy('ticket.id', 'DESC')
        .limit(5)
        .getMany(),
      this.servicesService.findAll(),
    ]);

    const serviceIconLookup = new Map<number, string | null>(
      servicesCatalog.map((svc) => [svc.id, typeof svc.icon === 'string' && svc.icon.length > 0 ? svc.icon.toLowerCase() : null]),
    );

    const assignIconToTicket = (ticket: Ticket | null | undefined) => {
      if (!ticket || !ticket.service) return;
      const icon = serviceIconLookup.get(ticket.service.id);
      if (icon !== undefined) {
        (ticket.service as ServiceEntity).icon = icon ?? null;
      }
    };

    dashboardTickets.forEach(assignIconToTicket);
    recentlyCompletedTickets.forEach(assignIconToTicket);

    const services = rows.map((r: any) => {
      const completed = Number(r.completedCountToday ?? 0);
      const absent = Number(r.absentCountToday ?? 0);
      const attended = completed + absent;

      return {
        serviceId: Number(r.serviceId),
        serviceName: String(r.serviceName ?? ''),
        serviceIcon: serviceIconLookup.get(Number(r.serviceId)) ?? null,
        waitingCount: Number(r.waitingCount ?? 0),
        avgWaitTime: r.avgWaitTime === null ? null : Number(r.avgWaitTime),
        inProgressCount: Number(r.inProgressCount ?? 0), // incluye CALLED e IN_PROGRESS
        completedCountToday: completed,
        absentCountToday: absent,
        attendedCountToday: attended,
      };
    });

    const inProgressTickets = dashboardTickets
      .filter((ticket) => ticket.status === Status.IN_PROGRESS)
      .sort((a, b) => {
        const aReference = a.startedAt ?? a.calledAt ?? a.createdAt;
        const bReference = b.startedAt ?? b.calledAt ?? b.createdAt;
        return (aReference?.getTime?.() ?? 0) - (bReference?.getTime?.() ?? 0);
      });

    const calledTickets = dashboardTickets
      .filter((ticket) => ticket.status === Status.CALLED)
      .sort((a, b) => {
        const aReference = a.calledAt ?? a.createdAt;
        const bReference = b.calledAt ?? b.createdAt;
        return (aReference?.getTime?.() ?? 0) - (bReference?.getTime?.() ?? 0);
      });

    const waitingTickets = dashboardTickets
      .filter((ticket) => ticket.status === Status.WAITING)
      .sort((a, b) => {
        const aPriority = this.normalizePriorityLevel(a.priorityLevel) ?? 3;
        const bPriority = this.normalizePriorityLevel(b.priorityLevel) ?? 3;
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }

        const aReference = a.requeuedAt ?? a.createdAt;
        const bReference = b.requeuedAt ?? b.createdAt;
        const referenceDiff = (aReference?.getTime?.() ?? 0) - (bReference?.getTime?.() ?? 0);
        if (referenceDiff !== 0) {
          return referenceDiff;
        }

        return (a.id ?? 0) - (b.id ?? 0);
      });

    const absentTickets = dashboardTickets
      .filter((ticket) => ticket.status === Status.ABSENT)
      .sort((a, b) => {
        const aReference = ticketAbsentReference(a);
        const bReference = ticketAbsentReference(b);
        return bReference - aReference;
      });

    const currentTicket =
      inProgressTickets[0] ??
      calledTickets[0] ??
      null;

    const nextTickets = [...inProgressTickets, ...calledTickets, ...waitingTickets].filter(
      (ticket) => !currentTicket || ticket.id !== currentTicket.id,
    );

    return {
      services,
      updatedAt: new Date().toISOString(),
      currentTicket,
      nextTickets,
      inProgressTickets,
      calledTickets,
      waitingTickets,
      absentTickets,
      recentlyCompletedTickets,
    };
  }
}

function ticketAbsentReference(ticket: Ticket): number {
  const ref = (ticket.absentAt ?? ticket.calledAt ?? ticket.createdAt) as Date | undefined;
  return ref?.getTime?.() ?? 0;
}
