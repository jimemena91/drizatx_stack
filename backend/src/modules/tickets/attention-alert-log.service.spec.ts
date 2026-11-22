import { DataSource } from 'typeorm';

import { AttentionAlertLogService } from '@/modules/tickets/attention-alert-log.service';
import { BusinessDateService } from '@/modules/business-date/business-date.service';
import { AttentionAlertLog } from '@/entities/attention-alert-log.entity';
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
 * Prueba de integración contra una base en memoria (sql.js, sin binarios
 * nativos). Si `sql.js` no está instalado el bloque se saltea: no es una
 * dependencia del proyecto, se instala sólo para correr esta suite
 * (`npm i --no-save sql.js`).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
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

// Operator se relaciona con roles, turnos, etc.: hay que registrar también esas entidades.
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
  AttentionAlertLog,
];

const minutes = (n: number) => n * 60 * 1000;

// Mendoza = UTC-3 (sin horario de verano). 12:00Z = 09:00 locales.
const NOON = new Date('2026-11-22T12:00:00Z');

(hasSqlJs ? describe : describe.skip)('AttentionAlertLogService', () => {
  let dataSource: DataSource;
  let service: AttentionAlertLogService;
  let serviceId: number;
  let operatorId: number;
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

    // Las entidades usan tipos de MySQL (timestamp, enum, json) que SQLite no
    // conoce. Se habilitan para pasar la validación y se traducen a su
    // equivalente SQLite al armar los metadatos, antes de crear el esquema.
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
          // SQLite no admite precisión en datetime ni CURRENT_TIMESTAMP(6).
          column.precision = undefined;
          if (typeof column.default === 'function') {
            const expr = String((column.default as () => string)());
            if (expr.startsWith('CURRENT_TIMESTAMP(')) {
              column.default = () => 'CURRENT_TIMESTAMP';
            }
          }
        }
      }
    };

    await dataSource.initialize();

    service = new AttentionAlertLogService(
      dataSource.getRepository(AttentionAlertLog),
      dataSource.getRepository(Ticket),
      new BusinessDateService(),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(AttentionAlertLog).clear();
    await dataSource.getRepository(Ticket).clear();
    await dataSource.getRepository(Operator).clear();
    await dataSource.getRepository(ServiceEntity).clear();

    const svc = await dataSource.getRepository(ServiceEntity).save({
      name: 'Caja',
      prefix: 'C',
      active: true,
      maxAttentionTime: 10,
    } as any);
    serviceId = svc.id;

    const op = await dataSource.getRepository(Operator).save({
      name: 'Ana',
      username: `ana${++seq}`,
      email: `ana${seq}@test.local`,
      password: 'x',
      active: true,
    } as any);
    operatorId = op.id;
  });

  const createTicket = (overrides: Partial<Ticket>) =>
    dataSource.getRepository(Ticket).save({
      number: `C-${++seq}`,
      serviceId,
      operatorId,
      issuedForDate: '2026-11-22' as any,
      status: Status.IN_PROGRESS,
      ...overrides,
    } as any) as Promise<Ticket>;

  const logs = () => dataSource.getRepository(AttentionAlertLog).find();

  it('registra una sola vez un ticket en atención que excedió el límite (idempotente)', async () => {
    await createTicket({ startedAt: new Date(NOON.getTime() - minutes(12)) });

    const first = await service.recordCycle(NOON);
    const second = await service.recordCycle(new Date(NOON.getTime() + minutes(1)));

    expect(first.inserted).toBe(1);
    expect(second.inserted).toBe(0);

    const rows = await logs();
    expect(rows).toHaveLength(1);
    expect(rows[0].ticketNumber).toMatch(/^C-/);
    expect(rows[0].operatorName).toBe('Ana');
    expect(rows[0].serviceName).toBe('Caja');
    expect(rows[0].maxAttentionMinutes).toBe(10);
    expect(rows[0].resolvedAt).toBeNull();
    // el segundo ciclo refresca el tiempo transcurrido: 13 min
    expect(rows[0].elapsedSeconds).toBe(13 * 60);
    expect(rows[0].exceededSeconds).toBe(3 * 60);
  });

  it('no registra tickets que no excedieron el límite ni servicios sin límite', async () => {
    await createTicket({ startedAt: new Date(NOON.getTime() - minutes(5)) });

    const sinLimite = await dataSource.getRepository(ServiceEntity).save({
      name: 'Consultas',
      prefix: 'Q',
      active: true,
      maxAttentionTime: null,
    } as any);
    await createTicket({
      serviceId: sinLimite.id,
      startedAt: new Date(NOON.getTime() - minutes(90)),
    });

    await service.recordCycle(NOON);
    expect(await logs()).toHaveLength(0);
  });

  it('cierra la alerta con la duración final cuando el ticket se completa', async () => {
    const ticket = await createTicket({ startedAt: new Date(NOON.getTime() - minutes(12)) });
    await service.recordCycle(NOON);

    await dataSource.getRepository(Ticket).update(
      { id: ticket.id },
      {
        status: Status.COMPLETED,
        completedAt: new Date(NOON.getTime() + minutes(3)),
        attentionDuration: 15 * 60,
      } as any,
    );
    const result = await service.recordCycle(new Date(NOON.getTime() + minutes(4)));

    expect(result.finalized).toBe(1);
    const [row] = await logs();
    expect(row.finalStatus).toBe(Status.COMPLETED);
    expect(row.elapsedSeconds).toBe(15 * 60);
    expect(row.exceededSeconds).toBe(5 * 60);
    expect(row.resolvedAt).not.toBeNull();
  });

  it('conserva la alerta si el cierre diario cierra el ticket y borra el operador', async () => {
    const ticket = await createTicket({ startedAt: new Date(NOON.getTime() - minutes(12)) });
    await service.recordCycle(NOON);

    const closedAt = new Date(NOON.getTime() + minutes(600));
    await dataSource.getRepository(Ticket).update(
      { id: ticket.id },
      { status: Status.DAILY_CLOSED, operatorId: null, closedAt } as any,
    );
    await service.recordCycle(new Date(closedAt.getTime() + minutes(1)));

    const [row] = await logs();
    expect(row.finalStatus).toBe(Status.DAILY_CLOSED);
    expect(row.operatorName).toBe('Ana'); // el snapshot no se pierde
    expect(row.resolvedAt?.getTime()).toBe(closedAt.getTime());
    expect(row.elapsedSeconds).toBeGreaterThanOrEqual(12 * 60);
  });

  it('el historial no cambia si después se modifica el límite o el nombre del servicio', async () => {
    await createTicket({ startedAt: new Date(NOON.getTime() - minutes(12)) });
    await service.recordCycle(NOON);

    await dataSource.getRepository(ServiceEntity).update(
      { id: serviceId },
      { maxAttentionTime: 60, name: 'Caja (renombrada)' } as any,
    );
    await service.recordCycle(new Date(NOON.getTime() + minutes(1)));

    const [row] = await logs();
    expect(row.maxAttentionMinutes).toBe(10);
    expect(row.serviceName).toBe('Caja');
  });

  it('registra un ticket completado que excedió y nunca se vio (backend caído)', async () => {
    await createTicket({
      status: Status.COMPLETED,
      startedAt: new Date(NOON.getTime() - minutes(40)),
      completedAt: new Date(NOON.getTime() - minutes(10)),
      attentionDuration: 30 * 60,
    });
    // completado hace 3 horas: fuera de la ventana de 15 min
    await createTicket({
      status: Status.COMPLETED,
      startedAt: new Date(NOON.getTime() - minutes(260)),
      completedAt: new Date(NOON.getTime() - minutes(180)),
      attentionDuration: 80 * 60,
    });

    await service.recordCycle(NOON, minutes(15));
    expect(await logs()).toHaveLength(1);

    // un ciclo de arranque con ventana amplia lo recupera
    await service.recordCycle(NOON, 48 * 60 * minutes(1));
    const rows = await logs();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.resolvedAt !== null && r.finalStatus === Status.COMPLETED)).toBe(true);
  });

  describe('día comercial (Mendoza) e historial', () => {
    it('cuenta por día comercial: el contador se renueva y el historial se conserva', async () => {
      // 23:30 locales del 21/11 -> cruza el límite 23:40 (día 21)
      await createTicket({
        startedAt: new Date('2026-11-22T02:30:00Z'),
        issuedForDate: '2026-11-21' as any,
      });
      // 00:55 locales del 22/11 -> cruza el límite 01:05 (día 22)
      await createTicket({ startedAt: new Date('2026-11-22T03:55:00Z') });

      await service.recordCycle(new Date('2026-11-22T05:00:00Z')); // 02:00 locales del 22

      const day1 = await service.getSummary(new Date('2026-11-22T05:00:00Z'));
      expect(day1).toEqual({ businessDate: '2026-11-22', todayCount: 1 });

      // al día siguiente el contador arranca de cero pero el historial sigue
      const day2Now = new Date('2026-11-23T15:00:00Z');
      const summary = await service.getSummary(day2Now);
      expect(summary).toEqual({ businessDate: '2026-11-23', todayCount: 0 });

      const history = await service.getHistory(30, day2Now);
      expect(history.todayCount).toBe(0);
      expect(history.days.map((d) => [d.businessDate, d.count])).toEqual([
        ['2026-11-22', 1],
        ['2026-11-21', 1],
      ]);
      expect(history.days[0].alerts[0].ongoing).toBe(true);
    });

    it('limita la ventana del historial a los días pedidos', async () => {
      await createTicket({
        startedAt: new Date('2026-11-22T02:30:00Z'),
        issuedForDate: '2026-11-21' as any,
      });
      await service.recordCycle(new Date('2026-11-22T05:00:00Z'));

      const now = new Date('2026-11-23T15:00:00Z');
      expect((await service.getHistory(1, now)).days).toHaveLength(0);
      expect((await service.getHistory(3, now)).days).toHaveLength(1);
      // valores inválidos caen en el default sin romper
      expect((await service.getHistory(Number.NaN, now)).days).toHaveLength(1);
    });
  });
});
