import { DataSource } from 'typeorm';

import { TicketEventsService } from '@/modules/tickets/ticket-events.service';
import { recordQueueCallEvent } from '@/modules/tickets/ticket-events.recorder';
import { ReportsAbsencesService } from '@/modules/reports/reports-absences.service';
import { TicketEventsSubscriber } from '@/modules/tickets/ticket-events.subscriber';
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


(hasSqlJs ? describe : describe.skip)('ReportsAbsencesService', () => {
  let dataSource: DataSource;
  let events: TicketEventsService;
  let report: ReportsAbsencesService;
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
    const MYSQL_TO_SQLITE: Record<string, string> = { timestamp: 'datetime', enum: 'simple-enum', json: 'simple-json' };
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
    events = new TicketEventsService(
      dataSource.getRepository(TicketEvent),
      dataSource.getRepository(Ticket),
      dataSource.getRepository(AuditLog),
      new BusinessDateService(),
    );
    new TicketEventsSubscriber(dataSource, events);
    report = new ReportsAbsencesService(dataSource.getRepository(Ticket), dataSource.getRepository(TicketEvent));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    for (const entity of [TicketEvent, AuditLog, Ticket, Operator, ServiceEntity]) {
      await dataSource.getRepository(entity as any).clear();
    }
    const svc = await dataSource.getRepository(ServiceEntity).save({ name: 'Caja', prefix: 'C', active: true } as any);
    serviceId = svc.id;
    const mk = (name: string, position: string) =>
      dataSource.getRepository(Operator).save({
        name,
        username: `${name}${++seq}`,
        email: `${name}${seq}@test.local`,
        password: 'x',
        position,
        active: true,
      } as any);
    anaId = (await mk('Ana', 'Caja 1')).id;
    betoId = (await mk('Beto', 'Caja 2')).id;
  });

  const tickets = () => dataSource.getRepository(Ticket);
  const issue = (createdAt: Date) =>
    tickets().save({
      number: `C-${++seq}`,
      serviceId,
      issuedForDate: '2026-11-20' as any,
      status: Status.WAITING,
      createdAt,
    } as any) as Promise<Ticket>;
  const patch = async (id: number, changes: Record<string, unknown>) => {
    const current = (await tickets().findOneBy({ id }))!;
    await tickets().save({ ...current, ...changes } as any);
  };
  const range = { from: at(-60).toISOString(), to: at(600).toISOString() } as any;

  it('cuenta ausentes por operador, quién los retoma y cuánto duran', async () => {
    const t = await issue(at(0));
    await patch(t.id, { status: Status.CALLED, operatorId: anaId, calledAt: at(10) });
    await patch(t.id, { status: Status.ABSENT, operatorId: null, absentAt: at(15) });
    await patch(t.id, { status: Status.WAITING, operatorId: null, calledAt: null, requeuedAt: at(20) });
    await patch(t.id, { status: Status.CALLED, operatorId: betoId, calledAt: at(40), requeuedAt: null });

    const r = await report.build(range, 50, at(60));
    expect(r.absences.total).toBe(1);
    expect(r.absences.ticketsWithAbsence).toBe(1);
    expect(r.details[0]).toMatchObject({ markedByName: 'Ana', takenByName: 'Beto', takenByPosition: 'Caja 2' });

    const ana = r.byOperator.find((o) => o.name === 'Ana')!;
    const beto = r.byOperator.find((o) => o.name === 'Beto')!;
    expect(ana).toMatchObject({ markedAbsent: 1, retaken: 0 });
    expect(beto).toMatchObject({ markedAbsent: 0, retaken: 1 });
    expect(r.absences.avgAbsentSeconds).toBe(5 * 60); // 15 → 20: volvió a la fila
  });

  it('un ausente que nadie retomó queda como "sin retomar"', async () => {
    const t = await issue(at(0));
    await patch(t.id, { status: Status.CALLED, operatorId: anaId, calledAt: at(5) });
    await patch(t.id, { status: Status.ABSENT, operatorId: null, absentAt: at(8) });
    const r = await report.build(range, 50, at(30));
    expect(r.absences.notRetaken).toBe(1);
    expect(r.byOperator[0]).toMatchObject({ name: 'Ana', markedAbsent: 1, notRetaken: 1 });
  });

  it('el filtro por operador deja sólo los ausentes que marcó ese operador', async () => {
    const a = await issue(at(0));
    await patch(a.id, { status: Status.CALLED, operatorId: anaId, calledAt: at(5) });
    await patch(a.id, { status: Status.ABSENT, operatorId: null, absentAt: at(8) });
    const b = await issue(at(1));
    await patch(b.id, { status: Status.CALLED, operatorId: betoId, calledAt: at(6) });
    await patch(b.id, { status: Status.ABSENT, operatorId: null, absentAt: at(9) });

    const onlyBeto = await report.build({ ...range, operatorId: betoId }, 50, at(30));
    expect(onlyBeto.absences.total).toBe(1);
    expect(onlyBeto.details[0].markedByName).toBe('Beto');
  });

  it('lista los turnos que esperaron más del umbral y cuenta los que siguen esperando', async () => {
    const quick = await issue(at(0));
    await patch(quick.id, { status: Status.IN_PROGRESS, operatorId: anaId, startedAt: at(5) });
    const slow = await issue(at(0));
    await patch(slow.id, { status: Status.CALLED, operatorId: betoId, calledAt: at(40) });
    await patch(slow.id, { status: Status.IN_PROGRESS, startedAt: at(50) });
    const stillWaiting = await issue(at(10));

    const r = await report.build({ ...range, waitThresholdMin: 30 }, 50, at(100));
    expect(r.thresholdMin).toBe(30);
    expect(r.longWaits.totalTickets).toBe(3);
    expect(r.longWaits.overThreshold).toBe(2);
    expect(r.longWaits.rows.map((w) => w.ticketId)).toEqual([stillWaiting.id, slow.id]);
    expect(r.longWaits.rows[0]).toMatchObject({ ongoing: true, waitSeconds: 90 * 60 });
    expect(r.longWaits.rows[1]).toMatchObject({ ongoing: false, waitSeconds: 50 * 60 });
    expect(r.longWaits.maxWaitSeconds).toBe(90 * 60);
  });

  it('sin datos devuelve ceros y listas vacías', async () => {
    const r = await report.build(range, 50, at(30));
    expect(r.absences).toMatchObject({ total: 0, avgAbsentSeconds: null, notRetaken: 0 });
    expect(r.byOperator).toEqual([]);
    expect(r.longWaits).toMatchObject({ totalTickets: 0, overThreshold: 0, overThresholdPct: null, rows: [] });
  });

  it('retomar con la relación `operator` cargada igual deja al operador en el evento', async () => {
    const t = await issue(at(0));
    await patch(t.id, { status: Status.CALLED, operatorId: anaId, calledAt: at(10) });
    await patch(t.id, { status: Status.ABSENT, operatorId: null, absentAt: at(15) });

    // igual que TicketsService.callTicket: se carga con relaciones y se guarda
    const full = (await tickets().findOne({ where: { id: t.id }, relations: ['service', 'operator', 'client'] }))!;
    full.status = Status.CALLED;
    full.operatorId = betoId;
    full.calledAt = at(30);
    await tickets().save(full);

    const r = await report.build(range, 50, at(60));
    expect(r.details[0]).toMatchObject({
      markedByName: 'Ana',
      takenByName: 'Beto',
      takenByPosition: 'Caja 2',
    });
    expect(r.byOperator.find((o) => o.name === 'Beto')).toMatchObject({ retaken: 1 });
    expect(r.absences.notRetaken).toBe(0);
  });

  it('mide la atención de los tickets retomados por cada operador', async () => {
    const t = await issue(at(0));
    await patch(t.id, { status: Status.CALLED, operatorId: anaId, calledAt: at(10) });
    await patch(t.id, { status: Status.ABSENT, operatorId: null, absentAt: at(15) });
    const full = (await tickets().findOne({ where: { id: t.id }, relations: ['service', 'operator', 'client'] }))!;
    full.status = Status.CALLED;
    full.operatorId = betoId;
    full.calledAt = at(30);
    await tickets().save(full);
    // Beto empieza y termina (con relaciones cargadas, como en la app)
    const called = (await tickets().findOne({ where: { id: t.id }, relations: ['operator'] }))!;
    called.status = Status.IN_PROGRESS;
    called.startedAt = at(32);
    await tickets().save(called);
    const inProgress = (await tickets().findOne({ where: { id: t.id }, relations: ['operator'] }))!;
    inProgress.status = Status.COMPLETED;
    inProgress.completedAt = at(44);
    await tickets().save(inProgress);

    // otro ticket retomado que todavía no se atendió
    const u = await issue(at(1));
    await patch(u.id, { status: Status.CALLED, operatorId: anaId, calledAt: at(11) });
    await patch(u.id, { status: Status.ABSENT, operatorId: null, absentAt: at(16) });
    const fullU = (await tickets().findOne({ where: { id: u.id }, relations: ['service', 'operator', 'client'] }))!;
    fullU.status = Status.CALLED;
    fullU.operatorId = betoId;
    fullU.calledAt = at(31);
    await tickets().save(fullU);

    const r = await report.build(range, 50, at(60));
    const beto = r.byOperator.find((o) => o.name === 'Beto')!;
    expect(beto.retaken).toBe(2);
    expect(beto.retakenCompleted).toBe(1);
    expect(beto.avgRetakenAttentionSeconds).toBe(12 * 60);
    expect(beto.totalRetakenAttentionSeconds).toBe(12 * 60);
    expect(beto.maxRetakenAttentionSeconds).toBe(12 * 60);

    const done = r.details.find((d) => d.ticketId === t.id)!;
    expect(done).toMatchObject({ retakenCompleted: true, retakenAttentionSeconds: 12 * 60 });
    const pending = r.details.find((d) => d.ticketId === u.id)!;
    expect(pending).toMatchObject({ retakenCompleted: false, retakenAttentionSeconds: null });
  });

  it('ausente que vuelve a la fila y lo llama otro por "llamar siguiente" (UPDATE directo) queda como retomado', async () => {
    const t = await issue(at(0));
    await patch(t.id, { status: Status.CALLED, operatorId: anaId, calledAt: at(10) });
    await patch(t.id, { status: Status.ABSENT, operatorId: null, absentAt: at(15) });
    // reintegrar: vuelve a la fila
    await patch(t.id, { status: Status.WAITING, operatorId: null, calledAt: null, requeuedAt: at(20) });

    // OperatorsService.callNext: UPDATE por SQL directo + evento explícito
    await dataSource.query(`UPDATE tickets SET status = 'CALLED', operator_id = ?, called_at = ? WHERE id = ?`, [
      betoId,
      at(30).toISOString().replace('T', ' ').replace('Z', ''),
      t.id,
    ]);
    const after = (await tickets().findOneBy({ id: t.id }))!;
    await recordQueueCallEvent(dataSource.manager, after, betoId, at(30));

    const started = (await tickets().findOne({ where: { id: t.id }, relations: ['operator'] }))!;
    started.status = Status.IN_PROGRESS;
    started.startedAt = at(32);
    await tickets().save(started);
    const inProgress = (await tickets().findOne({ where: { id: t.id }, relations: ['operator'] }))!;
    inProgress.status = Status.COMPLETED;
    inProgress.completedAt = at(40);
    await tickets().save(inProgress);

    const r = await report.build(range, 50, at(60));
    expect(r.details[0]).toMatchObject({ markedByName: 'Ana', takenByName: 'Beto', retakenCompleted: true });
    expect(r.details[0].retakenAttentionSeconds).toBe(8 * 60);
    expect(r.absences.notRetaken).toBe(0);
    expect(r.byOperator.find((o) => o.name === 'Beto')).toMatchObject({ retaken: 1, retakenCompleted: 1 });
  });
});
