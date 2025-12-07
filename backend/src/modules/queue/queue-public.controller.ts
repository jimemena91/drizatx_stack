import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { QueueService, QueueDashboardResponse } from './queue.service';
import { Ticket } from '../../entities/ticket.entity';
import { Operator } from '../../entities/operator.entity';
import { Service as ServiceEntity } from '../../entities/service.entity';
import { Client } from '../../entities/client.entity';

export type QueuePublicDashboardTicket = {
  id: number;
  number: string;
  serviceId: number;
  status: Ticket['status'];
  priority: number;
  createdAt: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  absentAt: string | null;
  estimatedWaitTime: number | null;
  actualWaitTime: number | null;
  attentionDuration: number | null;
  operatorId: number | null;
  clientId: number | null;
  service?: {
    id: number;
    name: string;
    prefix: string;
    active: boolean;
    priority: number;
    estimatedTime: number;
    maxAttentionTime: number | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  operator?: {
    id: number;
    name: string;
    username: string | null;
    email: string | null;
    position: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  client?: {
    id: number;
    dni: string;
    name: string;
    email: string | null;
    phone: string | null;
    vip: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type QueuePublicDashboardResponse = {
  services: QueueDashboardResponse['services'];
  updatedAt: string;
  currentTicket: QueuePublicDashboardTicket | null;
  nextTickets: QueuePublicDashboardTicket[];
  inProgressTickets: QueuePublicDashboardTicket[];
  calledTickets: QueuePublicDashboardTicket[];
  waitingTickets: QueuePublicDashboardTicket[];
  absentTickets: QueuePublicDashboardTicket[];
  recentlyCompletedTickets: QueuePublicDashboardTicket[];
};

function toIso(value?: Date | string | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

type QueuePublicService = {
  id: number;
  name: string;
  prefix: string;
  active: boolean;
  priority: number;
  estimatedTime: number;
  maxAttentionTime: number | null;
  createdAt: string;
  updatedAt: string;
};

function mapService(service?: ServiceEntity | null): QueuePublicDashboardTicket['service'] {
  if (!service) return null;
  return {
    id: Number(service.id),
    name: String(service.name ?? ''),
    prefix: String(service.prefix ?? ''),
    active: Boolean(service.active),
    priority: Number(service.priority ?? 0),
    estimatedTime: Number(service.estimatedTime ?? 0),
    maxAttentionTime: service.maxAttentionTime ?? null,
    createdAt: toIso(service.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(service.updatedAt) ?? new Date().toISOString(),
  };
}

function mapServiceEntity(service: ServiceEntity): QueuePublicService {
  return {
    id: Number(service.id),
    name: String(service.name ?? ''),
    prefix: String(service.prefix ?? ''),
    active: Boolean(service.active),
    priority: Number(service.priority ?? 0),
    estimatedTime: Number(service.estimatedTime ?? 0),
    maxAttentionTime: service.maxAttentionTime ?? null,
    createdAt: toIso(service.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(service.updatedAt) ?? new Date().toISOString(),
  };
}

function mapOperator(operator?: Operator | null): QueuePublicDashboardTicket['operator'] {
  if (!operator) return null;
  return {
    id: Number(operator.id),
    name: String(operator.name ?? ''),
    username: (operator as any).username ?? null,
    email: (operator as any).email ?? null,
    position: (operator as any).position ?? null,
    active: Boolean(operator.active),
    createdAt: toIso(operator.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(operator.updatedAt) ?? new Date().toISOString(),
  };
}

function mapClient(client?: Client | null): QueuePublicDashboardTicket['client'] {
  if (!client) return null;
  return {
    id: Number(client.id),
    dni: String(client.dni ?? ''),
    name: String(client.name ?? ''),
    email: (client as any).email ?? null,
    phone: (client as any).phone ?? null,
    vip: Boolean(client.vip),
    createdAt: toIso(client.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(client.updatedAt) ?? new Date().toISOString(),
  };
}

function mapTicket(ticket?: Ticket | null): QueuePublicDashboardTicket | null {
  if (!ticket) return null;

  return {
    id: Number(ticket.id),
    number: String(ticket.number ?? ''),
    serviceId: Number(ticket.serviceId ?? ticket?.service?.id ?? 0),
    status: ticket.status,
    priority: Number(ticket.priority ?? 0),
    createdAt: toIso(ticket.createdAt) ?? new Date().toISOString(),
    calledAt: toIso(ticket.calledAt),
    startedAt: toIso(ticket.startedAt),
    completedAt: toIso(ticket.completedAt),
    absentAt: toIso(ticket.absentAt),
    estimatedWaitTime: ticket.estimatedWaitTime ?? null,
    actualWaitTime: ticket.actualWaitTime ?? null,
    attentionDuration: ticket.attentionDuration ?? null,
    operatorId: ticket.operatorId ?? ticket.operator?.id ?? null,
    clientId: ticket.clientId ?? ticket.client?.id ?? null,
    service: mapService(ticket.service),
    operator: mapOperator(ticket.operator),
    client: mapClient(ticket.client),
  };
}

function mapTickets(tickets: Ticket[] | null | undefined): QueuePublicDashboardTicket[] {
  if (!tickets || tickets.length === 0) return [];
  return tickets
    .map((ticket) => mapTicket(ticket))
    .filter((ticket): ticket is QueuePublicDashboardTicket => ticket !== null);
}

@Controller('queue/public')
export class QueuePublicController {
  constructor(private readonly queueService: QueueService) {}

  @Get('dashboard')
  async getPublicDashboard(): Promise<QueuePublicDashboardResponse> {
    const dashboard = await this.queueService.getDashboard();

    return {
      services: dashboard.services.map((service) => ({
        serviceId: Number(service.serviceId),
        serviceName: String(service.serviceName ?? ''),
        serviceIcon:
          service.serviceIcon === null || service.serviceIcon === undefined
            ? null
            : String(service.serviceIcon),
        waitingCount: Number(service.waitingCount ?? 0),
        avgWaitTime: service.avgWaitTime === null ? null : Number(service.avgWaitTime),
        inProgressCount: Number(service.inProgressCount ?? 0),
        completedCountToday: Number(service.completedCountToday ?? 0),
        absentCountToday: Number(service.absentCountToday ?? 0),
        attendedCountToday: Number(service.attendedCountToday ?? 0),
      })),
      updatedAt: dashboard.updatedAt,
      currentTicket: mapTicket(dashboard.currentTicket),
      nextTickets: mapTickets(dashboard.nextTickets),
      inProgressTickets: mapTickets(dashboard.inProgressTickets),
      calledTickets: mapTickets(dashboard.calledTickets),
      waitingTickets: mapTickets(dashboard.waitingTickets),
      absentTickets: mapTickets(dashboard.absentTickets),
      recentlyCompletedTickets: mapTickets(dashboard.recentlyCompletedTickets),
    };
  }

  @Get('services')
  async getPublicServices(): Promise<QueuePublicService[]> {
    const services = await this.queueService.getActiveServices();
    return services.map((service) => mapServiceEntity(service));
  }

  @Post('enqueue')
  async enqueuePublicTicket(
    @Body('serviceId') rawServiceId?: number | string,
    @Body('clientId') rawClientId?: number | string | null,
  ): Promise<QueuePublicDashboardTicket> {
    const serviceId = Number(rawServiceId);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      throw new BadRequestException('serviceId es requerido');
    }

    const maybeClientId =
      rawClientId === undefined || rawClientId === null || rawClientId === ''
        ? undefined
        : Number(rawClientId);

    const clientId =
      maybeClientId !== undefined && Number.isInteger(maybeClientId) && maybeClientId > 0
        ? maybeClientId
        : undefined;

    const ticket = await this.queueService.enqueue(serviceId, clientId);
    const mapped = mapTicket(ticket);
    if (!mapped) {
      throw new BadRequestException('No se pudo generar el ticket');
    }
    return mapped;
  }
}
