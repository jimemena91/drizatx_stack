import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Client } from '../../entities/client.entity';
import { Ticket } from '../../entities/ticket.entity';
import { BulkImportClientRowDto } from './dto/bulk-import-clients.dto';
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

export type BulkImportClientsResult = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  clients: Client[];
  errors: Array<{
    row: number;
    dni?: string;
    message: string;
  }>;
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

  async bulkImport(rows: BulkImportClientRowDto[]): Promise<BulkImportClientsResult> {
    const result: BulkImportClientsResult = {
      processed: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      clients: [],
      errors: [],
    };

    const normalizedRows = rows.map((row, index) => ({
      rowNumber: index + 1,
      dni: String(row.dni ?? '').trim(),
      name: String(row.name ?? '').trim(),
      email: row.email ? String(row.email).trim() : null,
      phone: row.phone ? String(row.phone).trim() : null,
      vip: row.vip ?? false,
    }));

    const seenDnis = new Set<string>();

    for (const row of normalizedRows) {
      if (!row.dni || !row.name) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          dni: row.dni || undefined,
          message: 'DNI y nombre son obligatorios',
        });
        continue;
      }

      if (seenDnis.has(row.dni)) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          dni: row.dni,
          message: 'DNI duplicado dentro del archivo',
        });
        continue;
      }

      seenDnis.add(row.dni);

      try {
        const existing = await this.clientRepo.findOne({ where: { dni: row.dni } });

        if (existing) {
          await this.clientRepo.update(
            { id: existing.id },
            {
              name: row.name,
              email: row.email,
              phone: row.phone,
              vip: row.vip,
            },
          );

          const updated = await this.findOne(existing.id);
          result.updated += 1;
          result.clients.push(updated);
        } else {
          const created = await this.clientRepo.save(
            this.clientRepo.create({
              dni: row.dni,
              name: row.name,
              email: row.email,
              phone: row.phone,
              vip: row.vip,
            }),
          );

          result.created += 1;
          result.clients.push(created);
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          dni: row.dni,
          message: error instanceof Error ? error.message : 'Error procesando cliente',
        });
      }
    }

    return result;
  }

  async getHistory(id: number, limit = 25): Promise<ClientHistoryResponse> {
    const client = await this.findOne(id);

    const totalVisits = await this.ticketRepo.count({
      where: { clientId: id },
    });

    const tickets = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.service', 'service')
      .leftJoinAndSelect('ticket.operator', 'operator')
      .where('ticket.clientId = :clientId', { clientId: id })
      .orderBy('ticket.createdAt', 'DESC')
      .take(limit)
      .getMany();

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
