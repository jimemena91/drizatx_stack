import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { ServicesService } from '@/modules/services/services.service';
import { ClientsService } from '@/modules/clients/clients.service';
import { Ticket } from '@/entities/ticket.entity';
import { Service as ServiceEntity } from '@/entities/service.entity';
import { Client } from '@/entities/client.entity';
import { Operator } from '@/entities/operator.entity';
import { OperatorService } from '@/entities/operator-service.entity';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';

const ENTITIES = [Ticket, ServiceEntity, Client, Operator, OperatorService];

describe('TicketsController (HTTP)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let servicesService: ServicesService;
  let clientsService: ClientsService;
  let ticketsService: TicketsService;
  let systemSettingsService: SystemSettingsService;

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
      controllers: [TicketsController],
      providers: [
        TicketsService,
        ServicesService,
        ClientsService,
        {
          provide: SystemSettingsService,
          useValue: {
            find: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    dataSource = moduleRef.get(DataSource);
    servicesService = moduleRef.get(ServicesService);
    clientsService = moduleRef.get(ClientsService);
    ticketsService = moduleRef.get(TicketsService);
    systemSettingsService = moduleRef.get(SystemSettingsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const entity of ENTITIES) {
      await dataSource.getRepository(entity).clear();
    }
    (systemSettingsService.find as jest.Mock).mockResolvedValue(null);
  });

  it('POST /tickets/next returns the highest priority waiting ticket', async () => {
    const serviceRepo = dataSource.getRepository(ServiceEntity);

    const regularService = await servicesService.create({
      name: 'Atención general',
      prefix: 'AG',
      estimatedTime: 5,
      priority: 3,
    });

    const priorityService = await servicesService.create({
      name: 'Servicio prioritario',
      prefix: 'SP',
      estimatedTime: 5,
      priority: 5,
    });

    await serviceRepo.update(priorityService.id, { priority: 6, systemLocked: true });

    await ticketsService.create(regularService.id, {});
    await ticketsService.create(priorityService.id, {});

    (systemSettingsService.find as jest.Mock).mockResolvedValue({ value: '3' });

    const response = await request(app.getHttpServer()).post('/tickets/next').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ priority: 6, serviceId: priorityService.id }),
    );
  });

  it('persists and returns the provided mobile phone when creating a ticket', async () => {
    const service = await servicesService.create({
      name: 'Atención personalizada',
      prefix: 'AP',
      estimatedTime: 5,
      priority: 2,
    });

    const client = await clientsService.create({
      dni: '12345678',
      name: 'Juan Pérez',
    });

    const payload = {
      mobilePhone: '+5491112345678',
      priority: 4,
      clientId: client.id,
    };

    const response = await request(app.getHttpServer())
      .post(`/tickets/${service.id}`)
      .send(payload)
      .expect(201);

    expect(response.body.mobilePhone).toBe(payload.mobilePhone);
    expect(response.body.priority).toBe(payload.priority);
    expect(response.body.clientId).toBe(client.id);

    const stored = await ticketsService.findOne(response.body.id);
    expect(stored.mobilePhone).toBe(payload.mobilePhone);
    expect(stored.priority).toBe(payload.priority);
    expect(stored.clientId).toBe(client.id);
    expect(stored.serviceId).toBe(service.id);
  });
});
