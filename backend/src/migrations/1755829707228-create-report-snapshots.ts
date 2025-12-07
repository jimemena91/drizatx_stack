import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class CreateReportSnapshots1710000300000 implements MigrationInterface {
  name = 'CreateReportSnapshots1710000300000';

  public async up(q: QueryRunner): Promise<void> {
    const hasTable = await q.hasTable('report_snapshots');

    if (!hasTable) {
      // Crear tabla desde cero (snake_case)
      await q.createTable(new Table({
        name: 'report_snapshots',
        columns: [
          { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'type', type: 'varchar', length: '50', isNullable: false },
          { name: 'from', type: 'datetime', isNullable: true },
          { name: 'to', type: 'datetime', isNullable: true },
          { name: 'service_id', type: 'int', isNullable: true },
          { name: 'operator_id', type: 'int', isNullable: true },
          { name: 'granularity', type: 'varchar', length: '10', isNullable: true },
          { name: 'created_by_user_id', type: 'int', isNullable: true },
          { name: 'ticket_number_from', type: 'int', isNullable: true },
          { name: 'ticket_number_to', type: 'int', isNullable: true },
          { name: 'data', type: 'json', isNullable: false },
          { name: 'calc_version', type: 'varchar', length: '20', isNullable: false, default: "'v1'" },
          { name: 'created_at', type: 'timestamp', isNullable: true, default: 'CURRENT_TIMESTAMP' },
        ],
      }), true);
    } else {
      // Asegurar columnas (si existía creada a mano o con otro esquema)
      const ensure = async (col: TableColumn) => {
        const exists = await q.hasColumn('report_snapshots', col.name);
        if (!exists) await q.addColumn('report_snapshots', col);
      };

      await ensure(new TableColumn({ name: 'from', type: 'datetime', isNullable: true }));
      await ensure(new TableColumn({ name: 'to', type: 'datetime', isNullable: true }));
      await ensure(new TableColumn({ name: 'service_id', type: 'int', isNullable: true }));
      await ensure(new TableColumn({ name: 'operator_id', type: 'int', isNullable: true }));
      await ensure(new TableColumn({ name: 'granularity', type: 'varchar', length: '10', isNullable: true }));
      await ensure(new TableColumn({ name: 'created_by_user_id', type: 'int', isNullable: true }));
      await ensure(new TableColumn({ name: 'ticket_number_from', type: 'int', isNullable: true }));
      await ensure(new TableColumn({ name: 'ticket_number_to', type: 'int', isNullable: true }));
      await ensure(new TableColumn({ name: 'calc_version', type: 'varchar', length: '20', isNullable: false, default: "'v1'" }));
      await ensure(new TableColumn({ name: 'created_at', type: 'timestamp', isNullable: true, default: 'CURRENT_TIMESTAMP' }));
      // Nota: dejamos `data`/`type` tal cual; si no existieran, podrías asegurarlas igual con ensure(...)
    }

    // Índices (idempotentes)
    const idxExists = async (index: string) => {
      const rows: any[] = await q.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'report_snapshots' AND index_name = ? LIMIT 1`,
        [index],
      );
      return rows.length > 0;
    };

    if (!(await idxExists('idx_rs_type_created_at'))) {
      await q.createIndex('report_snapshots', new TableIndex({
        name: 'idx_rs_type_created_at',
        columnNames: ['type', 'created_at'],
      }));
    }

    if (!(await idxExists('idx_rs_type_from_to'))) {
      await q.createIndex('report_snapshots', new TableIndex({
        name: 'idx_rs_type_from_to',
        columnNames: ['type', 'from', 'to'],
      }));
    }

    if (!(await idxExists('idx_rs_service_operator_created_at'))) {
      await q.createIndex('report_snapshots', new TableIndex({
        name: 'idx_rs_service_operator_created_at',
        columnNames: ['service_id', 'operator_id', 'created_at'],
      }));
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const dropIdx = async (name: string) => {
      const rows: any[] = await q.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'report_snapshots' AND index_name = ? LIMIT 1`,
        [name]
      );
      if (rows.length > 0) await q.dropIndex('report_snapshots', name);
    };

    await dropIdx('idx_rs_service_operator_created_at');
    await dropIdx('idx_rs_type_from_to');
    await dropIdx('idx_rs_type_created_at');

    const hasTable = await q.hasTable('report_snapshots');
    if (hasTable) {
      await q.dropTable('report_snapshots');
    }
  }
}
