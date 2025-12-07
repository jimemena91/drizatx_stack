import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { QueuePublicController } from './queue-public.controller';
import { QueueService, QueueDashboardResponse } from './queue.service';
import { Status } from '@/common/enums/status.enum';

describe('QueuePublicController', () => {
  let app: INestApplication;
  const queueService: { getDashboard: jest.Mock<Promise<QueueDashboardResponse>, []> } = {
    getDashboard: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QueuePublicController],
      providers: [
        {
          provide: QueueService,
          useValue: queueService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.resetAllMocks();
  });

  it('returns a sanitized dashboard payload without requiring authentication', async () => {
    const updatedAt = new Date('2024-01-01T10:00:00.000Z').toISOString();
    queueService.getDashboard.mockResolvedValue({
      services: [
        {
          serviceId: 1,
          serviceName: 'Caja',
          serviceIcon: 'icon-caja',
          waitingCount: 2,
          avgWaitTime: 5,
          inProgressCount: 1,
          completedCountToday: 4,
          absentCountToday: 1,
          attendedCountToday: 5,
        },
      ],
      updatedAt,
      currentTicket: {
        id: 10,
        number: 'A001',
        serviceId: 1,
        service: {
          id: 1,
          name: 'Caja',
          prefix: 'A',
          active: true,
          priority: 1,
          estimatedTime: 5,
          maxAttentionTime: null,
          createdAt: new Date('2024-01-01T08:00:00.000Z'),
          updatedAt: new Date('2024-01-01T09:00:00.000Z'),
        } as any,
        operatorId: 5,
        operator: {
          id: 5,
          name: 'Operador',
          username: 'operador',
          email: 'op@example.com',
          position: 'Caja',
          active: true,
          createdAt: new Date('2024-01-01T08:00:00.000Z'),
          updatedAt: new Date('2024-01-01T09:00:00.000Z'),
        } as any,
        clientId: 9,
        client: {
          id: 9,
          dni: '12345678',
          name: 'Cliente Demo',
          email: 'cliente@example.com',
          phone: '123456789',
          vip: false,
          createdAt: new Date('2024-01-01T07:00:00.000Z'),
          updatedAt: new Date('2024-01-01T07:30:00.000Z'),
        } as any,
        status: Status.IN_PROGRESS,
        priority: 1,
        createdAt: new Date('2024-01-01T09:50:00.000Z'),
        calledAt: new Date('2024-01-01T09:55:00.000Z'),
        startedAt: new Date('2024-01-01T09:57:00.000Z'),
        completedAt: null,
        attentionDuration: null,
        estimatedWaitTime: 4,
        actualWaitTime: 3,
      } as any,
      nextTickets: [],
      inProgressTickets: [],
      calledTickets: [],
      waitingTickets: [],
      absentTickets: [],
      recentlyCompletedTickets: [],
    });

    const response = await request(app.getHttpServer())
      .get('/api/queue/public/dashboard')
      .expect(200);

    expect(response.body).toEqual({
      services: [
        expect.objectContaining({
          serviceId: 1,
          serviceName: 'Caja',
          serviceIcon: 'icon-caja',
          waitingCount: 2,
          avgWaitTime: 5,
          inProgressCount: 1,
          completedCountToday: 4,
          absentCountToday: 1,
          attendedCountToday: 5,
        }),
      ],
      updatedAt,
      currentTicket: expect.objectContaining({
        id: 10,
        number: 'A001',
        serviceId: 1,
        status: Status.IN_PROGRESS,
        operatorId: 5,
        clientId: 9,
        service: expect.objectContaining({ id: 1, name: 'Caja', prefix: 'A' }),
        operator: expect.objectContaining({ id: 5, name: 'Operador' }),
        client: expect.objectContaining({ id: 9, name: 'Cliente Demo' }),
      }),
      nextTickets: [],
      inProgressTickets: [],
      calledTickets: [],
      waitingTickets: [],
      absentTickets: [],
      recentlyCompletedTickets: [],
    });
    expect(queueService.getDashboard).toHaveBeenCalledTimes(1);
  });
});
