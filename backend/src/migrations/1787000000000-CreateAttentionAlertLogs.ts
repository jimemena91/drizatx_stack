import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { BusinessDateService } from '../modules/business-date/business-date.service';

const TABLE = 'attention_alert_logs';
const BACKFILL_BATCH = 500;

type BackfillRow = {
  id: number;
  number: string;
  service_id: number;
  service_name: string | null;
  operator_id: number | null;
  operator_name: string | null;
  max_minutes: number;
  elapsed: number;
  started: Date | string | null;
  completed_at: Date | string | null;
};

const toDate = (value: Date | string | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Crea el historial de alertas de tiempo de atención excedido y lo siembra con
 * los tickets completados que ya habían superado el límite, para que el
 * historial no arranque vacío.
 *
 * Idempotente: si la tabla ya existe no hace nada, y el backfill usa
 * INSERT IGNORE sobre el índice único por ticket.
 */
export class CreateAttentionAlertLogs1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(TABLE)) return;

    await queryRunner.createTable(
      new Table({
        name: TABLE,
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'ticket_id', type: 'int', isNullable: false },
          { name: 'ticket_number', type: 'varchar', length: '20', isNullable: false },
          { name: 'service_id', type: 'int', isNullable: false },
          { name: 'service_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'operator_id', type: 'int', isNullable: true },
          { name: 'operator_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'max_attention_minutes', type: 'int', isNullable: false },
          { name: 'elapsed_seconds', type: 'int', isNullable: false },
          { name: 'exceeded_seconds', type: 'int', isNullable: false },
          { name: 'business_date', type: 'date', isNullable: false },
          { name: 'exceeded_at', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
          { name: 'resolved_at', type: 'datetime', isNullable: true },
          { name: 'final_status', type: 'varchar', length: '30', isNullable: true },
          { name: 'created_at', type: 'datetime', isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE,
      new TableIndex({
        name: 'ux_attention_alert_logs_ticket',
        columnNames: ['ticket_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      TABLE,
      new TableIndex({
        name: 'idx_attention_alert_logs_business_date',
        columnNames: ['business_date', 'exceeded_at'],
      }),
    );

    // El backfill usa funciones propias de MySQL (TIMESTAMPDIFF / INSERT IGNORE).
    const driver = queryRunner.connection.options.type;
    if (driver !== 'mysql' && driver !== 'mariadb') return;

    // El backfill es un extra (sembrar el historial): si falla no debe frenar
    // el despliegue. La tabla ya está creada y el registrador la llena desde ahora.
    try {
      await this.backfill(queryRunner);
    } catch (error) {
      console.warn(
        '[CreateAttentionAlertLogs] no se pudo sembrar el historial previo:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(TABLE)) {
      await queryRunner.dropTable(TABLE, true);
    }
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    const businessDate = new BusinessDateService();
    let lastId = 0;

    for (;;) {
      const rows: BackfillRow[] = await queryRunner.query(
        `
          SELECT
            t.id AS id,
            t.number AS number,
            t.service_id AS service_id,
            s.name AS service_name,
            t.operator_id AS operator_id,
            o.name AS operator_name,
            s.max_attention_time AS max_minutes,
            COALESCE(
              t.attention_duration,
              TIMESTAMPDIFF(SECOND, t.started_at, t.completed_at)
            ) AS elapsed,
            COALESCE(t.started_at, t.called_at) AS started,
            t.completed_at AS completed_at
          FROM tickets t
          INNER JOIN services s ON s.id = t.service_id
          LEFT JOIN operators o ON o.id = t.operator_id
          WHERE t.status = 'COMPLETED'
            AND t.id > ?
            AND s.max_attention_time IS NOT NULL
            AND s.max_attention_time > 0
            AND COALESCE(
              t.attention_duration,
              TIMESTAMPDIFF(SECOND, t.started_at, t.completed_at)
            ) > s.max_attention_time * 60
          ORDER BY t.id ASC
          LIMIT ${BACKFILL_BATCH}
        `,
        [lastId],
      );

      if (rows.length === 0) break;

      for (const row of rows) {
        lastId = Math.max(lastId, Number(row.id));

        const limitSeconds = Number(row.max_minutes) * 60;
        const elapsed = Number(row.elapsed);
        const completedAt = toDate(row.completed_at);
        const started = toDate(row.started);

        // Momento en que cruzó el límite: inicio + límite; si no hay inicio,
        // se reconstruye hacia atrás desde la finalización.
        const exceededAt = started
          ? new Date(started.getTime() + limitSeconds * 1000)
          : completedAt
            ? new Date(completedAt.getTime() - (elapsed - limitSeconds) * 1000)
            : null;

        if (!exceededAt) continue;

        await queryRunner.query(
          `
            INSERT IGNORE INTO ${TABLE} (
              ticket_id, ticket_number, service_id, service_name,
              operator_id, operator_name, max_attention_minutes,
              elapsed_seconds, exceeded_seconds, business_date,
              exceeded_at, resolved_at, final_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
          `,
          [
            row.id,
            row.number,
            row.service_id,
            row.service_name ?? '',
            row.operator_id,
            row.operator_name,
            row.max_minutes,
            elapsed,
            elapsed - limitSeconds,
            businessDate.getBusinessDate(exceededAt),
            exceededAt,
            completedAt,
          ],
        );
      }

      if (rows.length < BACKFILL_BATCH) break;
    }
  }
}
