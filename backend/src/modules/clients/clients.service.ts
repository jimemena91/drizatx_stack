import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Client } from '../../entities/client.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Status } from '../../common/enums/status.enum';

type ClientVisitHistoryItem = {
  ticketId: number;
  ticketNumber: string;
  status: Status;
  serviceId: number | null;
  serviceName: string | null;
  operatorId: number | null;
  operatorName: string | null;
  createdAt: Date;
  calledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

type ClientHistoryResponse = {
  client: Client;
  totalVisits: number;
  lastVisitAt: Date | null;
  lastTicketNumber: string | null;
  lastOperator: { id: number | null; name: string | null } | null;
  lastService: { id: number | null; name: string | null } | null;
  history: ClientVisitHistoryItem[];
};

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>, // 👈 CLAVE
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  findAll() {
    return this.clientRepo.find({ order: { name: 'ASC' } });
  }

  findByDni(dni: string) {
    return this.clientRepo.findOne({ where: { dni } });
  }

  search(term: string) {
    // búsqueda simple por nombre/dni
    return this.clientRepo.find({
      where: [{ name: ILike(`%${term}%`) }, { dni: ILike(`%${term}%`) }],
      order: { name: 'ASC' },
      take: 50,
    });
  }

  async findOne(id: number) {
    const c = await this.clientRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  create(data: Partial<Client>) {
    const entity = this.clientRepo.create(data);
    return this.clientRepo.save(entity);
  }

  async update(id: number, data: Partial<Client>) {
    await this.findOne(id);
    await this.clientRepo.update({ id }, data);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.clientRepo.delete(id);
  }

  async getHistory(id: number, limit = 25): Promise<ClientHistoryResponse> {
    const client = await this.findOne(id);

    const query = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.service', 'service')
      .leftJoinAndSelect('ticket.operator', 'operator')
      .where('ticket.client_id = :clientId', { clientId: id })
      .orderBy('ticket.created_at', 'DESC')
      .take(limit);

    const [tickets, totalVisits] = await query.getManyAndCount();

    const history: ClientVisitHistoryItem[] = tickets.map((ticket) => ({
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      status: ticket.status,
      serviceId: ticket.serviceId ?? null,
      serviceName: ticket.service?.name ?? null,
      operatorId: ticket.operatorId ?? null,
      operatorName: ticket.operator?.name ?? null,
      createdAt: ticket.createdAt,
      calledAt: ticket.calledAt ?? null,
      startedAt: ticket.startedAt ?? null,
      completedAt: ticket.completedAt ?? null,
    }));

    const lastTicket = tickets[0] ?? null;
    const lastVisitAt = lastTicket
      ? lastTicket.completedAt ?? lastTicket.startedAt ?? lastTicket.calledAt ?? lastTicket.createdAt
      : null;

    return {
      client,
      totalVisits,
      lastVisitAt,
      lastTicketNumber: lastTicket?.number ?? null,
      lastOperator: lastTicket
        ? {
            id: lastTicket.operatorId ?? null,
            name: lastTicket.operator?.name ?? null,
          }
        : null,
      lastService: lastTicket
        ? {
            id: lastTicket.serviceId ?? null,
            name: lastTicket.service?.name ?? null,
          }
        : null,
      history,
    };
  }
}
