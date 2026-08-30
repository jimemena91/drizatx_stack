import { CalledAutoStartScheduler } from './called-auto-start.scheduler';

describe('CalledAutoStartScheduler', () => {
  let scheduler: CalledAutoStartScheduler;
  let ticketRepo: any;
  let ticketsService: any;
  let businessDate: any;
  let queryBuilder: any;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    ticketRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    ticketsService = {
      autoStartCalledTicket: jest.fn(),
    };

    businessDate = {
      getBusinessDate: jest.fn().mockReturnValue('2026-08-17'),
    };

    scheduler = new CalledAutoStartScheduler(
      ticketRepo,
      ticketsService,
      businessDate,
    );
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
    delete process.env.CALLED_AUTO_START_SECONDS;
    jest.restoreAllMocks();
  });

  it('processes only expired CALLED candidates from current business date', async () => {
    process.env.CALLED_AUTO_START_SECONDS = '30';

    queryBuilder.getMany.mockResolvedValue([
      { id: 101 },
      { id: 102 },
    ]);

    ticketsService.autoStartCalledTicket.mockResolvedValue(null);

    await (scheduler as any).handleTick();

    expect(businessDate.getBusinessDate).toHaveBeenCalled();

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'ticket.status = :status',
      expect.any(Object),
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'ticket.issued_for_date = :businessDate',
      { businessDate: '2026-08-17' },
    );

    expect(queryBuilder.limit).toHaveBeenCalledWith(100);

    expect(ticketsService.autoStartCalledTicket).toHaveBeenNthCalledWith(
      1,
      101,
      '2026-08-17',
      30,
    );

    expect(ticketsService.autoStartCalledTicket).toHaveBeenNthCalledWith(
      2,
      102,
      '2026-08-17',
      30,
    );
  });

  it('uses 120 seconds when environment configuration is missing', async () => {
    queryBuilder.getMany.mockResolvedValue([{ id: 201 }]);

    await (scheduler as any).handleTick();

    expect(ticketsService.autoStartCalledTicket).toHaveBeenCalledWith(
      201,
      '2026-08-17',
      120,
    );
  });

  it('does not overlap scheduler executions', async () => {
    (scheduler as any).running = true;

    await (scheduler as any).handleTick();

    expect(ticketRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(ticketsService.autoStartCalledTicket).not.toHaveBeenCalled();
  });

  it('continues processing remaining tickets when one candidate fails', async () => {
    queryBuilder.getMany.mockResolvedValue([
      { id: 301 },
      { id: 302 },
    ]);

    ticketsService.autoStartCalledTicket
      .mockRejectedValueOnce(new Error('simulated failure'))
      .mockResolvedValueOnce(null);

    await (scheduler as any).handleTick();

    expect(ticketsService.autoStartCalledTicket).toHaveBeenCalledTimes(2);
  });
});
