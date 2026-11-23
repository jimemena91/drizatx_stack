import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TicketEventsService, buildRouteTimings } from '@/modules/tickets/ticket-events.service';
import { TicketEventsSubscriber } from '@/modules/tickets/ticket-events.subscriber';
import { recordTicketEvents } from '@/modules/tickets/ticket-events.recorder';
import { BusinessDateService } from '@/modules/business-date/business-date.service';
import { TicketEvent } from '@/entities/ticket-event.entity';
import { AuditLog } from '@/entities/audit-log.entity';
import { Ticket } from '@/entities/ticket.entity';
import { Service as ServiceEntity } from '@/entities/service.entity';
import { Operator } from '@/entities/operator.entity';
import { Client } from '@/entities/client.entity';
import { OperatorService } from '@/entities/operator-service.entity';
import { OperatorRole } from '@/entities/operator-role.entity';
import { OperatorShift } from '@/entities/operator-shift.entity';
import { OperatorAvailability } from '@/entities/operator-availability.entity';
import { Role } from '@/entities/role.entity';
import { Permission } from '@/entities/permission.entity';
import { RolePermission } from '@/entities/role-permission.entity';
import { Status } from '@/common/enums/status.enum';

/**
 * Prueba de integración contra una base en memoria (sql.js). Si `sql.js` no
 * está instalado el bloque se saltea (no es dependencia del proyecto:
 * `npm i --no-save sql.js`).
 */
const loadSqlJs = (): any => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('sql.js');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
};
const sqlJsDriver = loadSqlJs();
const hasSqlJs = typeof sqlJsDriver === 'function';

const ENTITIES = [
  Ticket,
  ServiceEntity,
  Client,
  Operator,
  OperatorService,
  OperatorRole,
  OperatorShift,
  OperatorAvailability,
  Role,
  Permission,
  RolePermission,
  AuditLog,
  TicketEvent,
];

const minutes = (n: number) => n * 60 * 1000;
const T0 = new Date('2026-11-20T13:00:00Z'); // 10:00 en Mendoza
const at = (min: number) => new Date(T0.getTime() + minutes(min));

describe('buildRouteTimings (cálculo de tiempos)', () => {
  const ev = (type: any, min: number, extra: any = {}) => ({
    id: null,
    type,
    at: at(min),
    occurredAt: '',
    operatorId: null,
    operatorName: null,
    operatorPosition: null,
    source: null,
    previousStatus: null,
    newStatus: null,
    ...extra,
  });

  it('suma espera, ausente, llamado y atención de un ticket con una vuelta de ausente', () => {
    const raw = [
      ev('CREATED', 0),
      ev('CALLED', 20, { operatorName: 'Ana' }),
      ev('ABSENT', 25, { operatorName: 'Ana' }),
      ev('REQUEUED', 40),
      ev('TAKEN_FROM_ABSENT', 60, { operatorName: 'Beto' }),
      ev('STARTED', 61, { operatorName: 'Beto' }),
      ev('COMPLETED', 70, { operatorName: 'Beto' }),
    ];
    const { events, summary, ongoing } = buildRouteTimings(raw as any, at(500));

    expect(ongoing).toBe(false);
    expect(events.map((e) => e.secondsUntilNext)).toEqual([
      20 * 60, 5 * 60, 15 * 60, 20 * 60, 60, 9 * 60, null,
    ]);
    expect(summary.waitingSeconds).toBe((20 + 20) * 60); // CREATED→CALLED + REQUEUED→TAKEN
    expect(summary.absentSeconds).toBe(15 * 60);
    expect(summary.calledSeconds).toBe((5 + 1) * 60);
    expect(summary.attentionSeconds).toBe(9 * 60);
    expect(summary.totalSeconds).toBe(70 * 60);
    expect(summary.waitBeforeFirstCallSeconds).toBe(20 * 60);
    expect(summary.waitUntilAttentionSeconds).toBe(61 * 60);
    expect(summary.callCount).toBe(2);
    expect(summary.absentCount).toBe(1);
  });

  it('lista cada ausencia con quién la marcó, cuánto duró y quién la retomó', () => {
    const raw = [
      ev('CREATED', 0),
      ev('CALLED', 20, { operatorName: 'Ana', operatorPosition: 'Caja 1' }),
      ev('ABSENT', 25, { operatorName: 'Ana', operatorPosition: 'Caja 1' }),
      ev('REQUEUED', 40),
      ev('CALLED', 60, { operatorName: 'Beto', operatorPosition: 'Caja 2' }),
      ev('ABSENT', 65, { operatorName: 'Beto', operatorPosition: 'Caja 2' }),
      ev('TAKEN_FROM_ABSENT', 70, { operatorName: 'Carla', operatorPosition: 'Caja 3' }),
      ev('COMPLETED', 80, { operatorName: 'Carla' }),
    ];
    const { events, summary } = buildRouteTimings(raw as any, at(500));

    expect(summary.absentCount).toBe(2);
    expect(summary.absences).toHaveLength(2);

    const [first, second] = summary.absences;
    expect(first.markedByName).toBe('Ana');
    expect(first.markedByPosition).toBe('Caja 1');
    expect(first.absentSeconds).toBe(15 * 60); // hasta volver a la fila
    expect(first.backInQueueSeconds).toBe(20 * 60); // de nuevo en fila hasta ser llamado
    expect(first.takenByName).toBe('Beto');
    expect(first.takenByPosition).toBe('Caja 2');

    // retomado directamente desde ausente, sin pasar por la fila
    expect(second.markedByName).toBe('Beto');
    expect(second.absentSeconds).toBe(5 * 60);
    expect(second.backInQueueSeconds).toBeNull();
    expect(second.takenByName).toBe('Carla');

    // los llamados posteriores a una ausencia quedan marcados
    expect(events.filter((e) => e.afterAbsent).map((e) => e.operatorName)).toEqual(['Beto', 'Carla']);
    expect(events[1].afterAbsent).toBe(false);
  });

  it('una ausencia sin retomar queda sin "retomado por"', () => {
    const { summary } = buildRouteTimings(
      [ev('CREATED', 0), ev('CALLED', 5), ev('ABSENT', 8, { operatorName: 'Ana' }), ev('DAILY_CLOSED', 600)] as any,
      at(700),
    );
    expect(summary.absences[0].takenByName).toBeNull();
    expect(summary.absences[0].takenAt).toBeNull();
    expect(summary.absences[0].absentSeconds).toBe(592 * 60);
  });

  it('un ticket abierto cuenta el último tramo hasta ahora', () => {
    const { events, summary, ongoing } = buildRouteTimings(
      [ev('CREATED', 0), ev('CALLED', 10)] as any,
      at(25),
    );
    expect(ongoing).toBe(true);
    expect(events[1].secondsUntilNext).toBe(15 * 60);
    expect(summary.totalSeconds).toBe(25 * 60);
  });

  it('un ticket que nunca fue llamado cuenta la espera hasta ahora', () => {
    const { summary, ongoing } = buildRouteTimings([ev('CREATED', 0)] as any, at(60));
    expect(ongoing).toBe(true);
    expect(summary.waitBeforeFirstCallSeconds).toBe(60 * 60);
    expect(summary.waitUntilAttentionSeconds).toBe(60 * 60);
    expect(summary.waitingSeconds).toBe(60 * 60);
  });
});

(hasSqlJs ? describe : describe.skip)('TicketEventsService + suscriptor', () => {
  let dataSource: DataSource;
  let service: TicketEventsService;
  let serviceId: number;
  let anaId: number;
  let betoId: number;
  let seq = 0;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      driver: sqlJsDriver,
      autoSave: false,
      dropSchema: true,
      entities: ENTITIES,
      synchronize: true,
    } as any);

    const MYSQL_TO_SQLITE: Record<string, string> = {
      timestamp: 'datetime',
      enum: 'simple-enum',
      json: 'simple-json',
    };
    (dataSource.driver as any).supportedDataTypes.push(...Object.keys(MYSQL_TO_SQLITE));
    const buildMetadatas = (dataSource as any).buildMetadatas.bind(dataSource);
    (dataSource as any).buildMetadatas = async () => {
      await buildMetadatas();
      for (const meta of dataSource.entityMetadatas) {
        for (const column of meta.columns) {
          const mapped = MYSQL_TO_SQLITE[column.type as unknown as string];
          if (mapped) column.type = mapped as any;
          column.precision = undefined;
          if (typeof column.default === 'function') {
            const expr = String((column.default as () => string)());
            if (expr.startsWith('CURRENT_TIMESTAMP(')) column.default = () => 'CURRENT_TIMESTAMP';
          }
        }
      }
    };

    await dataSource.initialize();

    service = new TicketEventsService(
      dataSource.getRepository(TicketEvent),
      dataSource.getRepository(Ticket),
      dataSource.getRepository(AuditLog),
      new BusinessDateService(),
    );
    new TicketEventsSubscriber(dataSource, service);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    for (const entity of [TicketEvent, AuditLog, Ticket, Operator, ServiceEntity]) {
      await dataSource.getRepository(entity as any).clear();
    }
    const svc = await dataSource.getRepository(ServiceEntity).save({
      name: 'Caja',
      prefix: 'C',
      active: true,
    } as any);
    serviceId = svc.id;

    const ana = await dataSource.getRepository(Operator).save({
      name: 'Ana',
      username: `ana${++seq}`,
      email: `ana${seq}@test.local`,
      password: 'x',
      position: 'Caja 1',
      active: true,
    } as any);
    anaId = ana.id;
    const beto = await dataSource.getRepository(Operator).save({
      name: 'Beto',
      username: `beto${++seq}`,
      email: `beto${seq}@test.local`,
      password: 'x',
      position: 'Caja 2',
      active: true,
    } as any);
    betoId = beto.id;
  });

  const tickets = () => dataSource.getRepository(Ticket);
  const events = (ticketId: number) =>
    dataSource.getRepository(TicketEvent).find({ where: { ticketId }, order: { id: 'ASC' } });

  const issue = () =>
    tickets().save({
      number: `C-${++seq}`,
      serviceId,
      issuedForDate: '2026-11-20' as any,
      status: Status.WAITING,
    } as any) as Promise<Ticket>;

  it('registra la emisión del ticket', async () => {
    const t = await issue();
    const rows = await events(t.id);
    expect(rows.map((r) => r.eventType)).toEqual(['CREATED']);
    expect(rows[0].ticketNumber).toBe(t.number);
    expect(rows[0].newStatus).toBe('WAITING');
  });

  it('registra el recorrido completo: llamado, ausente, reingreso, retomado por otro y atención', async () => {
    const t = await issue();

    // Ana lo llama
    await tickets().save({ ...t, status: Status.CALLED, operatorId: anaId, calledAt: at(20) } as any);
    // Ana lo marca ausente (se libera el operador)
    const called = (await tickets().findOneBy({ id: t.id }))!;
    await tickets().save({ ...called, status: Status.ABSENT, operatorId: null, absentAt: at(25) } as any);
    // vuelve a la fila
    const absent = (await tickets().findOneBy({ id: t.id }))!;
    await tickets().save({
      ...absent,
      status: Status.WAITING,
      operatorId: null,
      requeuedAt: at(40),
      calledAt: null,
    } as any);
    // Beto lo retoma, empieza (inicio automático) y completa
    const requeued = (await tickets().findOneBy({ id: t.id }))!;
    await tickets().save({
      ...requeued,
      status: Status.CALLED,
      operatorId: betoId,
      calledAt: at(60),
      requeuedAt: null,
    } as any);
    const retaken = (await tickets().findOneBy({ id: t.id }))!;
    await tickets().save({
      ...retaken,
      status: Status.IN_PROGRESS,
      startedAt: at(61),
      attentionStartSource: 'AUTO',
    } as any);
    const started = (await tickets().findOneBy({ id: t.id }))!;
    await tickets().save({ ...started, status: Status.COMPLETED, completedAt: at(70) } as any);

    const rows = await events(t.id);
    expect(rows.map((r) => r.eventType)).toEqual([
      'CREATED',
      'CALLED',
      'ABSENT',
      'REQUEUED',
      'CALLED', // lo llama Beto desde la fila (el ABSENT→CALLED directo es TAKEN_FROM_ABSENT)
      'STARTED',
      'COMPLETED',
    ]);

    const [, called1, absent1, requeued1, taken, started1, done] = rows;
    expect(called1.operatorName).toBe('Ana');
    expect(called1.operatorPosition).toBe('Caja 1');
    expect(called1.occurredAt.getTime()).toBe(at(20).getTime());
    // quien lo marca ausente es el operador que lo tenía, aunque el ticket quede sin operador
    expect(absent1.operatorName).toBe('Ana');
    expect(absent1.previousStatus).toBe('CALLED');
    expect(requeued1.operatorId).toBeNull();
    // quien lo retoma desde ausente
    expect(taken.operatorName).toBe('Beto');
    expect(taken.operatorPosition).toBe('Caja 2');
    expect(started1.source).toBe('AUTO');
    expect(done.operatorName).toBe('Beto');
  });

  it('la ruta calculada reproduce los tiempos del caso', async () => {
    const t = await issue();
    // los eventos del historial con horas controladas
    await dataSource.getRepository(TicketEvent).clear();
    const base = { ticketId: t.id, ticketNumber: t.number, serviceId, previousStatus: null, newStatus: null, operatorId: null, operatorName: null, operatorPosition: null, source: null };
    await dataSource.getRepository(TicketEvent).save([
      { ...base, eventType: 'CREATED', occurredAt: at(0) },
      { ...base, eventType: 'CALLED', occurredAt: at(20), operatorName: 'Ana', operatorPosition: 'Caja 1' },
      { ...base, eventType: 'ABSENT', occurredAt: at(25), operatorName: 'Ana' },
      { ...base, eventType: 'TAKEN_FROM_ABSENT', occurredAt: at(60), operatorName: 'Beto', operatorPosition: 'Caja 2' },
      { ...base, eventType: 'COMPLETED', occurredAt: at(70), operatorName: 'Beto' },
    ] as any);

    const [route] = await service.getRoutes(t.number, '2026-11-20', at(600));
    expect(route.reconstructed).toBe(false);
    expect(route.ongoing).toBe(false);
    expect(route.events.map((e) => e.type)).toEqual([
      'CREATED', 'CALLED', 'ABSENT', 'TAKEN_FROM_ABSENT', 'COMPLETED',
    ]);
    expect(route.summary.absentSeconds).toBe(35 * 60);
    expect(route.summary.waitBeforeFirstCallSeconds).toBe(20 * 60);
    expect(route.summary.totalSeconds).toBe(70 * 60);
  });

  it('guardar sin cambiar el estado, o con datos parciales, no genera eventos', async () => {
    const t = await issue();
    await tickets().save({ ...t, notificationSent: true } as any);
    await tickets().save({ id: t.id, mobilePhone: '123' } as any);
    expect((await events(t.id)).map((r) => r.eventType)).toEqual(['CREATED']);
  });

  it('un UPDATE masivo no duplica eventos; el llamado por fila se registra aparte', async () => {
    const t = await issue();
    await tickets()
      .createQueryBuilder()
      .update(Ticket)
      .set({ status: Status.CALLED as any, operatorId: anaId, calledAt: at(5) })
      .where('id = :id', { id: t.id })
      .execute();
    expect((await events(t.id)).map((r) => r.eventType)).toEqual(['CREATED']);

    const full = (await tickets().findOneBy({ id: t.id }))!;
    await service.recordQueueCall(full, anaId, at(5));
    const rows = await events(t.id);
    expect(rows.map((r) => r.eventType)).toEqual(['CREATED', 'CALLED']);
    expect(rows[1].operatorName).toBe('Ana');
    expect(rows[1].occurredAt.getTime()).toBe(at(5).getTime());
  });

  it('el puesto queda guardado como estaba, aunque después cambie', async () => {
    const t = await issue();
    await tickets().save({ ...t, status: Status.CALLED, operatorId: anaId, calledAt: at(5) } as any);
    await dataSource.getRepository(Operator).update({ id: anaId }, { position: 'Caja 9' } as any);

    const [, called] = await events(t.id);
    expect(called.operatorPosition).toBe('Caja 1');
  });

  it('si falla el registro del historial, el ticket se guarda igual', async () => {
    const t = await issue();
    await dataSource.query('DROP TABLE ticket_events');

    await expect(
      tickets().save({ ...t, status: Status.CALLED, operatorId: anaId, calledAt: at(5) } as any),
    ).resolves.toBeDefined();
    const after = await tickets().findOneBy({ id: t.id });
    expect(after?.status).toBe(Status.CALLED);

    // se vuelve a crear la tabla para los demás tests
    await dataSource.synchronize();
  });

  it('el cierre diario deja un evento por ticket con su operador anterior', async () => {
    const t = await issue();
    await tickets().save({ ...t, status: Status.CALLED, operatorId: anaId, calledAt: at(5) } as any);

    await recordTicketEvents(dataSource.manager, [
      {
        ticketId: t.id,
        ticketNumber: t.number,
        serviceId,
        eventType: 'DAILY_CLOSED',
        previousStatus: 'CALLED',
        newStatus: 'DAILY_CLOSED',
        operatorId: anaId,
        occurredAt: at(600),
        source: 'SYSTEM',
      },
    ]);
    const rows = await events(t.id);
    const closed = rows[rows.length - 1];
    expect(closed.eventType).toBe('DAILY_CLOSED');
    expect(closed.operatorName).toBe('Ana');
    expect(closed.source).toBe('SYSTEM');
  });

  it('reconstruye la ruta de un ticket anterior al historial con el ticket y la auditoría', async () => {
    const t = await issue();
    await dataSource.getRepository(TicketEvent).clear(); // como si fuera previo al historial

    await tickets().update(
      { id: t.id },
      {
        status: Status.COMPLETED,
        operatorId: betoId,
        createdAt: at(0),
        calledAt: at(60),
        startedAt: at(61),
        completedAt: at(70),
      } as any,
    );
    await dataSource.getRepository(AuditLog).save({
      eventType: 'TICKET_MARK_ABSENT',
      action: 'Cambio de estado de ticket',
      target: `Ticket ${t.number}`,
      severity: 'low',
      actorId: anaId,
      actorName: 'Ana',
      metadata: { ticketId: t.id, absentAt: at(25).toISOString() },
    } as any);
    // una auditoría de otro ticket con el mismo número no debe mezclarse
    await dataSource.getRepository(AuditLog).save({
      eventType: 'TICKET_MARK_ABSENT',
      action: 'Cambio de estado de ticket',
      target: `Ticket ${t.number}`,
      severity: 'low',
      actorName: 'Otro',
      metadata: { ticketId: t.id + 999, absentAt: at(30).toISOString() },
    } as any);

    const [route] = await service.getRoutes(t.number, '2026-11-20', at(600));
    expect(route.reconstructed).toBe(true);
    expect(route.events.map((e) => e.type)).toEqual(['CREATED', 'ABSENT', 'CALLED', 'STARTED', 'COMPLETED']);
    const absent = route.events.find((e) => e.type === 'ABSENT')!;
    expect(absent.operatorName).toBe('Ana');
    expect(route.summary.waitUntilAttentionSeconds).toBe(61 * 60);
  });

  it('valida el número y la fecha, y devuelve vacío si no existe', async () => {
    await expect(service.getRoutes('   ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getRoutes('C-1', '20-11-2026')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getRoutes('NO-EXISTE', '2026-11-20')).resolves.toEqual([]);
  });

  it('lista los turnos del día con su estado actual, operador y veces ausente', async () => {
    const waiting = await issue();
    const done = await issue();
    const absent = await issue();

    await tickets().save({ ...done, status: Status.CALLED, operatorId: anaId, calledAt: at(10) } as any);
    const calledDone = (await tickets().findOneBy({ id: done.id }))!;
    await tickets().save({ ...calledDone, status: Status.COMPLETED, completedAt: at(30) } as any);

    await tickets().save({ ...absent, status: Status.CALLED, operatorId: betoId, calledAt: at(12) } as any);
    const calledAbsent = (await tickets().findOneBy({ id: absent.id }))!;
    await tickets().save({ ...calledAbsent, status: Status.ABSENT, operatorId: null } as any);

    const list = await service.listDay('2026-11-20');
    expect(list).toHaveLength(3);

    const byId = new Map(list.map((i) => [i.id, i]));
    expect(byId.get(waiting.id)).toMatchObject({ status: 'WAITING', operatorName: null, absentCount: 0 });
    expect(byId.get(done.id)).toMatchObject({
      status: 'COMPLETED',
      operatorName: 'Ana',
      operatorPosition: 'Caja 1',
      serviceName: 'Caja',
    });
    expect(byId.get(absent.id)).toMatchObject({ status: 'ABSENT', absentCount: 1 });

    // otro día: vacío; fecha inválida: error
    await expect(service.listDay('2026-11-19')).resolves.toEqual([]);
    await expect(service.listDay('19/11/2026')).rejects.toBeInstanceOf(BadRequestException);
  });
});
