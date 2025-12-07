import { ForbiddenException } from '@nestjs/common';
import { Status } from '@/common/enums/status.enum';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let queueService: QueueService;
  let ticketsService: { callTicket: jest.Mock };
  let dataSource: any;
  let queryBuilder: any;
  let ticketRepoQueryBuilder: any;
  let ticketRepo: any;
  let operatorRepo: any;
  let clientRepo: any;
  let servicesService: any;
  let clientsService: any;

  beforeEach(() => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    ticketRepoQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    dataSource = {
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    ticketRepo = {
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ticketRepoQueryBuilder),
    };
    operatorRepo = {
      findOne: jest.fn(),
    };
    clientRepo = {
      findOne: jest.fn(),
    };
    servicesService = {
      findActive: jest.fn(),
      findOne: jest.fn(),
    };
    clientsService = {
      findOne: jest.fn(),
    };
    ticketsService = {
      callTicket: jest.fn(),
    };

    queueService = new QueueService(
      dataSource as any,
      ticketRepo,
      operatorRepo,
      clientRepo,
      servicesService,
      clientsService,
      ticketsService as any,
    );
  });

  describe('callTicket', () => {
    it('delegates the call to TicketsService', async () => {
      const ticket = { id: 42 } as any;
      ticketsService.callTicket.mockResolvedValue(ticket);

      const result = await queueService.callTicket(42, 7);

      expect(ticketsService.callTicket).toHaveBeenCalledWith(42, 7);
      expect(result).toBe(ticket);
    });

    it('rethrows errors from TicketsService', async () => {
      const error = new ForbiddenException('Operador inactivo');
      ticketsService.callTicket.mockRejectedValue(error);

      await expect(queueService.callTicket(10, 99)).rejects.toBe(error);
    });
  });

  describe('getDashboard', () => {
    it('returns dashboard data including current, next and absent tickets', async () => {
      const inProgressTicket = {
        id: 1,
        status: Status.IN_PROGRESS,
        serviceId: 9,
        priority: 1,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        startedAt: new Date('2024-01-01T10:05:00Z'),
        calledAt: new Date('2024-01-01T10:02:00Z'),
      } as any;

      const calledTicket = {
        id: 2,
        status: Status.CALLED,
        serviceId: 9,
        priority: 1,
        createdAt: new Date('2024-01-01T10:10:00Z'),
        calledAt: new Date('2024-01-01T10:12:00Z'),
      } as any;

      const waitingHighPriority = {
        id: 4,
        status: Status.WAITING,
        serviceId: 9,
        priority: 5,
        createdAt: new Date('2024-01-01T10:20:00Z'),
        requeuedAt: new Date('2024-01-01T10:21:00Z'),
      } as any;

      const waitingLowPriority = {
        id: 5,
        status: Status.WAITING,
        serviceId: 9,
        priority: 2,
        createdAt: new Date('2024-01-01T10:25:00Z'),
        requeuedAt: null,
      } as any;

      const absentTicket = {
        id: 3,
        status: Status.ABSENT,
        serviceId: 9,
        priority: 1,
        createdAt: new Date('2024-01-01T10:15:00Z'),
        calledAt: new Date('2024-01-01T10:18:00Z'),
        absentAt: new Date('2024-01-01T10:20:00Z'),
      } as any;

      queryBuilder.getRawMany.mockResolvedValue([
        {
          serviceId: 9,
          serviceName: 'General',
          waitingCount: 3,
          avgWaitTime: 7,
          inProgressCount: 2,
          completedCountToday: 5,
          absentCountToday: 1,
          attendedCountToday: 6,
        },
      ]);

      const dashboardSpy = jest
        .spyOn(queueService, 'dashboardTickets')
        .mockResolvedValue([
          inProgressTicket,
          calledTicket,
          waitingLowPriority,
          waitingHighPriority,
          absentTicket,
        ]);

      ticketRepoQueryBuilder.getMany.mockResolvedValue([]);

      const result = await queueService.getDashboard();

      expect(dataSource.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(queryBuilder.getRawMany).toHaveBeenCalledTimes(1);
      expect(dashboardSpy).toHaveBeenCalledTimes(1);
      expect(ticketRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(ticketRepoQueryBuilder.getMany).toHaveBeenCalledTimes(1);
      expect(result.services).toHaveLength(1);
      expect(result.currentTicket).toEqual(inProgressTicket);
      expect(result.nextTickets).toEqual([
        calledTicket,
        waitingHighPriority,
        waitingLowPriority,
      ]);
      expect(result.absentTickets).toEqual([absentTicket]);
      expect(result.waitingTickets).toEqual([
        waitingHighPriority,
        waitingLowPriority,
      ]);
      expect(result.recentlyCompletedTickets).toEqual([]);
    });
  });

  describe('startTicket', () => {
    it('throws when the ticket does not exist', async () => {
      ticketRepo.findOne.mockResolvedValue(null);

      await expect(queueService.startTicket(99)).rejects.toThrow('Ticket no encontrado');
      expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it('throws when the ticket status is not CALLED', async () => {
      ticketRepo.findOne.mockResolvedValue({ id: 7, status: Status.WAITING });

      await expect(queueService.startTicket(7)).rejects.toThrow('Solo se puede iniciar desde CALLED');
      expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it('updates the ticket status and timestamps when starting attention', async () => {
      const ticket = {
        id: 11,
        status: Status.CALLED,
        startedAt: null,
        attentionDuration: 45,
      } as any;

      ticketRepo.findOne.mockResolvedValue(ticket);
      ticketRepo.save.mockImplementation(async (entity: any) => entity);

      const result = await queueService.startTicket(11);

      expect(result.status).toBe(Status.IN_PROGRESS);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.attentionDuration).toBeNull();
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 11,
          status: Status.IN_PROGRESS,
          attentionDuration: null,
        }),
      );
    });
  });

  describe('completeTicket', () => {
    it('throws when the ticket does not exist', async () => {
      ticketRepo.findOne.mockResolvedValue(null);

      await expect(queueService.completeTicket(1)).rejects.toThrow('Ticket no encontrado');
      expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it('throws when the ticket status is not IN_PROGRESS', async () => {
      ticketRepo.findOne.mockResolvedValue({ id: 2, status: Status.WAITING });

      await expect(queueService.completeTicket(2)).rejects.toThrow(
        'Solo se puede completar desde IN_PROGRESS',
      );
      expect(ticketRepo.save).not.toHaveBeenCalled();
    });

    it('finalizes the ticket, calculating attention and wait durations', async () => {
      const startedAt = new Date('2024-01-02T12:00:00Z');
      const calledAt = new Date('2024-01-02T11:55:00Z');
      const createdAt = new Date('2024-01-02T11:40:00Z');
      const ticket = {
        id: 3,
        status: Status.IN_PROGRESS,
        startedAt,
        calledAt,
        createdAt,
        completedAt: null,
        attentionDuration: null,
        actualWaitTime: null,
      } as any;

      ticketRepo.findOne.mockResolvedValue(ticket);
      ticketRepo.save.mockImplementation(async (entity: any) => entity);

      const completionTime = new Date('2024-01-02T12:00:30Z');
      jest.useFakeTimers().setSystemTime(completionTime);

      const result = await queueService.completeTicket(3);

      expect(result.status).toBe(Status.COMPLETED);
      expect(result.completedAt?.getTime()).toBe(completionTime.getTime());
      expect(result.attentionDuration).toBe(30);
      expect(result.actualWaitTime).toBe(15);
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 3,
          status: Status.COMPLETED,
          attentionDuration: 30,
          actualWaitTime: 15,
        }),
      );

      jest.useRealTimers();
    });
  });
});
