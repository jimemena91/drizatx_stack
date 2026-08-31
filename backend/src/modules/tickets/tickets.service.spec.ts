import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Status } from "../../common/enums/status.enum";
import { TicketsService } from "./tickets.service";

describe("TicketsService.callTicket", () => {
  let ticketsService: TicketsService;
  let ticketRepo: any;
  let operatorRepo: any;
  let opSvcRepo: any;
  let createQueryBuilder: any;
  let queryBuilder: any;
  let systemSettings: any;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    createQueryBuilder = jest.fn(() => queryBuilder);

    ticketRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder,
    };
    operatorRepo = {
      findOne: jest.fn(),
    };
    opSvcRepo = {
      findOne: jest.fn(),
    };

    systemSettings = {
      find: jest.fn(),
    };

    ticketsService = new TicketsService(
      {} as any,
      ticketRepo,
      {} as any,
      {} as any,
      operatorRepo,
      opSvcRepo,
      {} as any,
      {} as any,
      systemSettings as any,
      {} as any,
      {
        emitTicketCalled: jest.fn(),
        emitQueueUpdated: jest.fn(),
      } as any,
      {
        evaluate: jest.fn().mockReturnValue({
          countsForMetrics: true,
          exclusionReason: null,
        }),
      } as any,
    );
  });

  it("throws ForbiddenException when the operator is inactive", async () => {
    operatorRepo.findOne.mockResolvedValue(null);

    await expect(ticketsService.callTicket(1, 2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ticketRepo.findOne).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the ticket does not exist", async () => {
    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue(null);

    await expect(ticketsService.callTicket(1, 2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("returns the ticket when already called by the same operator", async () => {
    const ticket = {
      id: 1,
      status: Status.CALLED,
      operatorId: 2,
    } as any;
    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue(ticket);

    const result = await ticketsService.callTicket(1, 2);

    expect(result).toBe(ticket);
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it("throws ConflictException when the ticket is called by another operator", async () => {
    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue({
      id: 1,
      status: Status.CALLED,
      operatorId: 3,
    });

    await expect(ticketsService.callTicket(1, 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("throws ConflictException when the ticket is not waiting", async () => {
    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue({
      id: 1,
      status: Status.COMPLETED,
      operatorId: null,
    });

    await expect(ticketsService.callTicket(1, 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("allows calling an absent ticket directly for the operator", async () => {
    const ticket = {
      id: 1,
      status: Status.ABSENT,
      operatorId: null,
      serviceId: 9,
      absentAt: new Date("2024-01-01T10:00:00Z"),
    } as any;

    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue(ticket);
    opSvcRepo.findOne.mockResolvedValue({ active: true });
    ticketRepo.save.mockImplementation(async (entity: any) => entity);

    const result = await ticketsService.callTicket(1, 2);

    expect(result.status).toBe(Status.CALLED);
    expect(result.operatorId).toBe(2);
    expect(queryBuilder.getOne).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when the operator is not allowed for the service", async () => {
    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue({
      id: 1,
      status: Status.WAITING,
      operatorId: null,
      serviceId: 9,
    });
    opSvcRepo.findOne.mockResolvedValue(null);

    await expect(ticketsService.callTicket(1, 2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it("updates the ticket when the operator can call it", async () => {
    const ticket = {
      id: 1,
      status: Status.WAITING,
      operatorId: null,
      serviceId: 9,
      calledAt: null,
      requeuedAt: new Date("2024-01-01T10:00:00Z"),
      startedAt: new Date("2024-01-01T10:05:00Z"),
      completedAt: new Date("2024-01-01T10:10:00Z"),
      attentionDuration: 55,
    } as any;
    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue(ticket);
    opSvcRepo.findOne.mockResolvedValue({ active: true });
    queryBuilder.getOne.mockResolvedValue({ id: 1 });
    ticketRepo.save.mockImplementation(async (entity: any) => entity);

    const result = await ticketsService.callTicket(1, 2);

    expect(result.status).toBe(Status.CALLED);
    expect(result.operatorId).toBe(2);
    expect(result.calledAt).toBeInstanceOf(Date);
    expect(result.requeuedAt).toBeNull();
    expect(result.startedAt).toBeNull();
    expect(result.completedAt).toBeNull();
    expect(result.attentionDuration).toBeNull();
    expect(ticketRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        status: Status.CALLED,
        operatorId: 2,
      }),
    );
  });

  it("throws ConflictException when there is another ticket ahead in the queue", async () => {
    const ticket = {
      id: 2,
      status: Status.WAITING,
      operatorId: null,
      serviceId: 9,
    } as any;

    operatorRepo.findOne.mockResolvedValue({ id: 2, active: true });
    ticketRepo.findOne.mockResolvedValue(ticket);
    opSvcRepo.findOne.mockResolvedValue({ active: true });
    queryBuilder.getOne.mockResolvedValue({ id: 1 });

    await expect(ticketsService.callTicket(2, 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe("TicketsService.findNextTicketForGlobalQueue", () => {
  let ticketsService: TicketsService;
  let ticketRepo: any;
  let systemSettings: any;

  const makeBuilder = ({ one = null, many = [] as any[] } = {}) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(one),
    getMany: jest.fn().mockResolvedValue(many),
  });

  beforeEach(() => {
    systemSettings = {
      find: jest.fn().mockResolvedValue(null),
    };

    ticketRepo = {
      createQueryBuilder: jest.fn(),
    };

    ticketsService = new TicketsService(
      {} as any,
      ticketRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      systemSettings as any,
      {} as any,
      {
        emitTicketCalled: jest.fn(),
        emitQueueUpdated: jest.fn(),
      } as any,
      {
        evaluate: jest.fn().mockReturnValue({
          countsForMetrics: true,
          exclusionReason: null,
        }),
      } as any,
    );
  });

  it("returns priority level 6 ticket first when available", async () => {
    const prioritySix = { id: 1, priorityLevel: 6 } as any;
    ticketRepo.createQueryBuilder.mockImplementationOnce(() =>
      makeBuilder({ one: prioritySix }),
    );

    const result = await ticketsService.findNextTicketForGlobalQueue();

    expect(result).toBe(prioritySix);
    expect(systemSettings.find).not.toHaveBeenCalled();
  });

  it("falls back to priority DESC order when alternation is disabled", async () => {
    const regularTicket = { id: 2, priorityLevel: 5 } as any;
    ticketRepo.createQueryBuilder
      .mockImplementationOnce(() => makeBuilder({ one: null }))
      .mockImplementationOnce(() => makeBuilder({ one: regularTicket }));

    systemSettings.find.mockResolvedValue({ value: "1" });

    const result = await ticketsService.findNextTicketForGlobalQueue();

    expect(result).toBe(regularTicket);
    expect(ticketRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it("applies alternation window for priorities 5..1 when configured", async () => {
    const olderTicket = { id: 3, priorityLevel: 2 } as any;
    const urgentTicket = { id: 4, priorityLevel: 5 } as any;
    const windowTicket = { id: 5, priorityLevel: 3 } as any;

    ticketRepo.createQueryBuilder
      .mockImplementationOnce(() => makeBuilder({ one: null }))
      .mockImplementationOnce(() => makeBuilder({ one: urgentTicket }))
      .mockImplementationOnce(() =>
        makeBuilder({ many: [olderTicket, windowTicket, urgentTicket] }),
      );

    systemSettings.find.mockResolvedValue({ value: "3" });

    const result = await ticketsService.findNextTicketForGlobalQueue();

    expect(result).toBe(urgentTicket);
    expect(ticketRepo.createQueryBuilder).toHaveBeenCalledTimes(3);
  });

  it("forces highest priority ticket when it falls outside the alternation window", async () => {
    const urgentTicket = { id: 6, priorityLevel: 5 } as any;
    const olderTickets = [
      { id: 7, priorityLevel: 2 },
      { id: 8, priorityLevel: 3 },
      { id: 9, priorityLevel: 4 },
    ] as any[];

    ticketRepo.createQueryBuilder
      .mockImplementationOnce(() => makeBuilder({ one: null }))
      .mockImplementationOnce(() => makeBuilder({ one: urgentTicket }))
      .mockImplementationOnce(() => makeBuilder({ many: olderTickets }));

    systemSettings.find.mockResolvedValue({ value: "3" });

    const result = await ticketsService.findNextTicketForGlobalQueue();

    expect(result).toBe(urgentTicket);
    expect(ticketRepo.createQueryBuilder).toHaveBeenCalledTimes(3);
  });
});


describe('TicketsService.autoStartCalledTicket', () => {
  let ticketsService: TicketsService;
  let transactionRepo: any;
  let dataSource: any;
  let queueEvents: any;

  beforeEach(() => {
    transactionRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionRepo),
    };

    dataSource = {
      transaction: jest.fn(async (callback: any) => callback(manager)),
    };

    queueEvents = {
      emitQueueUpdated: jest.fn(),
    };

    ticketsService = new TicketsService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      queueEvents,
      {} as any,
    );
  });

  it('auto-starts an expired CALLED ticket from the current business date', async () => {
    const calledAt = new Date(Date.now() - 120_000);

    const ticket = {
      id: 31,
      number: 'A31',
      status: Status.CALLED,
      operatorId: 8,
      serviceId: 2,
      issuedForDate: new Date('2026-08-17T00:00:00.000Z'),
      calledAt,
      startedAt: null,
      attentionDuration: 10,
    } as any;

    transactionRepo.findOne.mockResolvedValue(ticket);
    transactionRepo.save.mockImplementation(async (entity: any) => entity);

    const result = await ticketsService.autoStartCalledTicket(
      31,
      '2026-08-17',
      30,
    );

    expect(result?.status).toBe(Status.IN_PROGRESS);
    expect(result?.startedAt).toBeInstanceOf(Date);
    expect(result?.attentionStartSource).toBe('AUTO');
    expect(result?.attentionDuration).toBeNull();
    expect(transactionRepo.save).toHaveBeenCalled();
    expect(queueEvents.emitQueueUpdated).toHaveBeenCalledWith({
      ticketId: 31,
      operatorId: 8,
      serviceId: 2,
    });
  });

  it('does nothing when the CALLED ticket has not reached timeout', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 32,
      status: Status.CALLED,
      operatorId: 8,
      serviceId: 2,
      issuedForDate: new Date('2026-08-17T00:00:00.000Z'),
      calledAt: new Date(),
    });

    const result = await ticketsService.autoStartCalledTicket(
      32,
      '2026-08-17',
      120,
    );

    expect(result).toBeNull();
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(queueEvents.emitQueueUpdated).not.toHaveBeenCalled();
  });

  it('does nothing for a ticket from a previous business date', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 33,
      status: Status.CALLED,
      operatorId: 8,
      serviceId: 2,
      issuedForDate: new Date('2026-08-16T00:00:00.000Z'),
      calledAt: new Date(Date.now() - 300_000),
    });

    const result = await ticketsService.autoStartCalledTicket(
      33,
      '2026-08-17',
      30,
    );

    expect(result).toBeNull();
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(queueEvents.emitQueueUpdated).not.toHaveBeenCalled();
  });

  it('does nothing when another transition already changed the ticket', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 34,
      status: Status.ABSENT,
      operatorId: null,
      serviceId: 2,
      issuedForDate: new Date('2026-08-17T00:00:00.000Z'),
      calledAt: new Date(Date.now() - 300_000),
    });

    const result = await ticketsService.autoStartCalledTicket(
      34,
      '2026-08-17',
      30,
    );

    expect(result).toBeNull();
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(queueEvents.emitQueueUpdated).not.toHaveBeenCalled();
  });
});

describe('TicketsService.startAttention', () => {
  let ticketsService: TicketsService;
  let transactionRepo: any;
  let dataSource: any;
  let queueEvents: any;

  beforeEach(() => {
    transactionRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionRepo),
    };

    dataSource = {
      transaction: jest.fn(async (callback: any) => callback(manager)),
    };

    queueEvents = {
      emitQueueUpdated: jest.fn(),
    };

    ticketsService = new TicketsService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      queueEvents,
      {} as any,
    );
  });

  it('changes CALLED to IN_PROGRESS atomically', async () => {
    const ticket = {
      id: 21,
      status: Status.CALLED,
      operatorId: 7,
      serviceId: 3,
      startedAt: null,
      attentionDuration: 45,
    } as any;

    transactionRepo.findOne.mockResolvedValue(ticket);
    transactionRepo.save.mockImplementation(async (entity: any) => entity);

    const result = await ticketsService.startAttention(ticket.id);

    expect(transactionRepo.findOne).toHaveBeenCalledWith({
      where: { id: ticket.id },
      lock: { mode: 'pessimistic_write' },
    });

    expect(result.status).toBe(Status.IN_PROGRESS);
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.attentionStartSource).toBe('MANUAL');
    expect(result.attentionDuration).toBeNull();

    expect(queueEvents.emitQueueUpdated).toHaveBeenCalledWith({
      ticketId: 21,
      operatorId: 7,
      serviceId: 3,
    });
  });

  it('does not start a ticket that is no longer CALLED', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 22,
      status: Status.ABSENT,
      operatorId: null,
      serviceId: 3,
    });

    await expect(
      ticketsService.startAttention(22),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(queueEvents.emitQueueUpdated).not.toHaveBeenCalled();
  });

  it('does not start a CALLED ticket without an assigned operator', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 23,
      status: Status.CALLED,
      operatorId: null,
      serviceId: 3,
    });

    await expect(
      ticketsService.startAttention(23),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(queueEvents.emitQueueUpdated).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the ticket does not exist', async () => {
    transactionRepo.findOne.mockResolvedValue(null);

    await expect(
      ticketsService.startAttention(999),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(queueEvents.emitQueueUpdated).not.toHaveBeenCalled();
  });
});

describe('TicketsService.markAbsent', () => {
  let ticketsService: TicketsService;
  let transactionRepo: any;
  let dataSource: any;

  beforeEach(() => {
    transactionRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionRepo),
    };

    dataSource = {
      transaction: jest.fn(async (callback: any) => callback(manager)),
    };

    ticketsService = new TicketsService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        emitTicketCalled: jest.fn(),
        emitQueueUpdated: jest.fn(),
      } as any,
      {} as any,
    );

    jest
      .spyOn(ticketsService as any, 'buildOperatorAuditSnapshot')
      .mockResolvedValue({
        operatorId: 7,
        snapshot: null,
      });

    jest
      .spyOn(ticketsService as any, 'recordTicketStatusChange')
      .mockResolvedValue(undefined);
  });

  it('allows CALLED to become ABSENT', async () => {
    const ticket = {
      id: 41,
      status: Status.CALLED,
      operatorId: 7,
      serviceId: 2,
      absentAt: null,
    } as any;

    transactionRepo.findOne.mockResolvedValue(ticket);
    transactionRepo.save.mockImplementation(async (entity: any) => entity);

    const result = await ticketsService.markAbsent(41);

    expect(transactionRepo.findOne).toHaveBeenCalledWith({
      where: { id: 41 },
      lock: { mode: 'pessimistic_write' },
    });

    expect(result.status).toBe(Status.ABSENT);
    expect(result.operatorId).toBeNull();
    expect(result.absentAt).toBeInstanceOf(Date);
    expect(transactionRepo.save).toHaveBeenCalled();
  });

  it('rejects MANUAL IN_PROGRESS to ABSENT', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 42,
      status: Status.IN_PROGRESS,
      attentionStartSource: 'MANUAL',
      operatorId: 7,
      serviceId: 2,
    });

    await expect(
      ticketsService.markAbsent(42),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('allows AUTO IN_PROGRESS to become ABSENT', async () => {
    const ticket = {
      id: 43,
      status: Status.IN_PROGRESS,
      attentionStartSource: 'AUTO',
      operatorId: 7,
      serviceId: 2,
      absentAt: null,
    } as any;

    transactionRepo.findOne.mockResolvedValue(ticket);
    transactionRepo.save.mockImplementation(async (entity: any) => entity);

    const result = await ticketsService.markAbsent(43);

    expect(result.status).toBe(Status.ABSENT);
    expect(result.operatorId).toBeNull();
    expect(result.absentAt).toBeInstanceOf(Date);
    expect(transactionRepo.save).toHaveBeenCalled();
  });
});
