import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

const TABLE = 'ticket_events';

/**
 * Crea el historial de eventos de cada ticket (emisión, llamados, ausentes,
 * reingresos, atención, cierre).
 *
 * Idempotente: si la tabla ya existe no hace nada. No siembra datos: del pasado
 * sólo se puede reconstruir lo que quedó en el propio ticket y en la auditoría,
 * y eso lo arma la consulta al vuelo.
 */
export class CreateTicketEvents1788000000000 implements MigrationInterface {
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
          { name: 'event_type', type: 'varchar', length: '30', isNullable: false },
          { name: 'previous_status', type: 'varchar', length: '20', isNullable: true },
          { name: 'new_status', type: 'varchar', length: '20', isNullable: true },
          { name: 'operator_id', type: 'int', isNullable: true },
          { name: 'operator_name', type: 'varchar', length: '100', isNullable: true },
          { name: 'operator_position', type: 'varchar', length: '50', isNullable: true },
          { name: 'source', type: 'varchar', length: '20', isNullable: true },
          { name: 'occurred_at', type: 'datetime', precision: 3, isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE,
      new TableIndex({ name: 'idx_ticket_events_ticket', columnNames: ['ticket_id', 'occurred_at'] }),
    );
    await queryRunner.createIndex(
      TABLE,
      new TableIndex({ name: 'idx_ticket_events_occurred', columnNames: ['occurred_at'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(TABLE)) {
      await queryRunner.dropTable(TABLE, true);
    }
  }
}
