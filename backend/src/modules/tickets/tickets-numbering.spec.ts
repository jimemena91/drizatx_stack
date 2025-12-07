import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { TicketsService } from '@/modules/tickets/tickets.service';
import { QueueService } from '@/modules/queue/queue.service';
import { ServicesService } from '@/modules/services/services.service';
import { ClientsService } from '@/modules/clients/clients.service';
import { Ticket } from '@/entities/ticket.entity';
import { Service as ServiceEntity } from '@/entities/service.entity';
import { Client } from '@/entities/client.entity';
import { Operator } from '@/entities/operator.entity';
import { OperatorService } from '@/entities/operator-service.entity';

const ENTITIES = [Ticket, ServiceEntity, Client, Operator, OperatorService];

const ensureCounterTables = async (dataSource: DataSource) => {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS service_counters (
      service_id INTEGER PRIMARY KEY,
      counter_date TEXT NOT NULL,
      last_seq INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS service_counter_history (
      service_id INTEGER NOT NULL,
      counter_date TEXT NOT NULL,
      total_issued INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (service_id, counter_date)
    )
  `);
};

const truncateCounterTables = async (dataSource: DataSource) => {
  await dataSource.query('DELETE FROM service_counter_history');
  await dataSource.query('DELETE FROM service_counters');
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('Atomic ticket numbering', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let ticketsService: TicketsService;
  let queueService: QueueService;
  let servicesService: ServicesService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: ENTITIES,
          synchronize: true,
        }),
        TypeOrmModule.forFeature(ENTITIES),
      ],
      providers: [TicketsService, QueueService, ServicesService, ClientsService],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    ticketsService = moduleRef.get(TicketsService);
    queueService = moduleRef.get(QueueService);
    servicesService = moduleRef.get(ServicesService);

    await ensureCounterTables(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    for (const entity of ENTITIES) {
      await dataSource.getRepository(entity).clear();
    }
    await truncateCounterTables(dataSource);
  });

  it('generates sequential numbers without duplicates in TicketsService.create()', async () => {
    const service = await servicesService.create({
      name: 'Mesa de ayuda',
      prefix: 'HD',
      estimatedTime: 5,
      priority: 2,
    });

    const total = 6;
    const tickets = await Promise.all(
      Array.from({ length: total }, () => ticketsService.create(service.id)),
    );

    const numbers = tickets.map((ticket) => ticket.number);
    expect(new Set(numbers).size).toBe(total);
    expect(numbers.sort()).toEqual(
      Array.from({ length: total }, (_, index) => `HD${String(index + 1).padStart(3, '0')}`),
    );

    const updatedService = await servicesService.findOne(service.id);
    expect(updatedService.nextTicketNumber).toBe(total + 1);
  });

  it('avoids duplicated numbers when enqueueing concurrently through QueueService', async () => {
    const service = await servicesService.create({
      name: 'Atención general',
      prefix: 'AG',
      estimatedTime: 3,
      priority: 1,
    });

    const total = 4;
    const tickets = await Promise.all(
      Array.from({ length: total }, () => queueService.enqueue(service.id)),
    );

    const numbers = tickets.map((ticket) => ticket.number);
    expect(new Set(numbers).size).toBe(total);
    expect(numbers.sort()).toEqual(
      Array.from({ length: total }, (_, index) => `AG${String(index + 1).padStart(3, '0')}`),
    );

    const updatedService = await servicesService.findOne(service.id);
    expect(updatedService.nextTicketNumber).toBe(total + 1);
  });

  it('resets numbering each day and persists daily totals', async () => {
    const service = await servicesService.create({
      name: 'Registro diario',
      prefix: 'RD',
      estimatedTime: 4,
      priority: 1,
    });

    const first = await ticketsService.create(service.id);
    const second = await ticketsService.create(service.id);

    const today = new Date();
    const todayStr = formatDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    await dataSource.query(
      'UPDATE tickets SET issued_for_date = ?, created_at = created_at WHERE service_id = ?',
      [yesterdayStr, service.id],
    );

    await dataSource.query('UPDATE service_counters SET counter_date = ?, last_seq = ? WHERE service_id = ?', [
      yesterdayStr,
      2,
      service.id,
    ]);

    const nextTicket = await ticketsService.create(service.id);

    expect(nextTicket.number).toBe('RD001');
    expect(nextTicket.issuedForDate).toBeInstanceOf(Date);
    expect(formatDate(nextTicket.issuedForDate)).toBe(todayStr);

    const [counterRow] = await dataSource.query(
      'SELECT last_seq AS lastSeq, counter_date AS counterDate FROM service_counters WHERE service_id = ?',
      [service.id],
    );

    expect(Number(counterRow.lastSeq)).toBe(1);
    expect(String(counterRow.counterDate).slice(0, 10)).toBe(todayStr);

    const historyRows = await dataSource.query(
      'SELECT total_issued AS totalIssued FROM service_counter_history WHERE service_id = ? AND counter_date = ?',
      [service.id, yesterdayStr],
    );

    expect(historyRows).toHaveLength(1);
    expect(Number(historyRows[0].totalIssued)).toBe(2);

    expect(first.issuedForDate).toBeInstanceOf(Date);
    expect(second.issuedForDate).toBeInstanceOf(Date);
  });
});
