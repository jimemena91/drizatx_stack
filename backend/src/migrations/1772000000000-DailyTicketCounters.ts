import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class DailyTicketCounters1772000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const connectionType = String(queryRunner.connection.options.type ?? '').toLowerCase();
    const isSqlite =
      connectionType === 'sqlite' || connectionType === 'better-sqlite3';
    const isMysql =
      connectionType.includes('mysql') ||
      connectionType.includes('mariadb') ||
      connectionType.includes('aurora-mysql');

    // Helper para current_date según motor
    const currentDateSql = isSqlite ? "date('now')" : 'CURRENT_DATE()';

    // ---------- service_counters ----------
    const hasServiceCounters = await queryRunner.hasTable('service_counters');
    if (!hasServiceCounters) {
      if (isSqlite) {
        await queryRunner.createTable(
          new Table({
            name: 'service_counters',
            columns: [
              { name: 'service_id', type: 'integer', isPrimary: true },
              { name: 'last_seq', type: 'integer', isNullable: false, default: 0 },
            ],
          }),
        );
      } else {
        await queryRunner.createTable(
          new Table({
            name: 'service_counters',
            engine: isMysql ? 'InnoDB' : undefined,
            columns: [
              {
                name: 'service_id',
                type: 'int',
                ...(isMysql ? { unsigned: true } : {}),
                isPrimary: true,
              },
              {
                name: 'last_seq',
                type: 'int',
                isNullable: false,
                default: 0,
              },
            ],
          }),
        );

        await queryRunner.createForeignKey(
          'service_counters',
          new TableForeignKey({
            name: 'FK_741cdd91d1bb4ba20ee65dd6a6c',
            columnNames: ['service_id'],
            referencedTableName: 'services',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          }),
        );
      }
    }

    // Asegurar columna counter_date
    const serviceCounters = await queryRunner.getTable('service_counters');
    const hasCounterDate =
      serviceCounters?.columns.some((col) => col.name === 'counter_date') ?? false;

    if (!hasCounterDate) {
      await queryRunner.addColumn(
        'service_counters',
        new TableColumn({
          name: 'counter_date',
          type: isSqlite ? 'date' : 'date',
          isNullable: false,
          default: "'1970-01-01'",
        }),
      );
    }

    await queryRunner.query(
      `UPDATE service_counters SET counter_date = ${currentDateSql} WHERE counter_date IS NULL OR counter_date = '1970-01-01'`,
    );

    // ---------- service_counter_history ----------
    const hasHistoryTable = await queryRunner.hasTable('service_counter_history');
    if (!hasHistoryTable) {
      await queryRunner.createTable(
        new Table({
          name: 'service_counter_history',
          engine: isMysql ? 'InnoDB' : undefined,
          columns: [
            {
              name: 'service_id',
              type: 'int',
              ...(isMysql ? { unsigned: true } : {}),
              isPrimary: true,
            },
            { name: 'counter_date', type: 'date', isPrimary: true },
            { name: 'total_issued', type: 'int', isNullable: false, default: 0 },
            {
              name: 'created_at',
              type: isSqlite ? 'datetime' : 'timestamp',
              isNullable: false,
              // Usamos un default simple que MySQL 8 acepte sin sintaxis rara
              default: 'CURRENT_TIMESTAMP',
            },
          ],
          indices: [
            {
              name: 'idx_sch_service_date',
              columnNames: ['service_id', 'counter_date'],
            },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'service_counter_history',
        new TableForeignKey({
          name: 'fk_sch_service',
          columnNames: ['service_id'],
          referencedTableName: 'services',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        }),
      );
    }

    // Seed histórico (si aplica)
    const hasTicketsTable = await queryRunner.hasTable('tickets');
    if (hasTicketsTable) {
      if (!isSqlite) {
        await queryRunner.query(`
          INSERT INTO service_counter_history (service_id, counter_date, total_issued, created_at)
          SELECT
            t.service_id,
            DATE(t.created_at) AS counter_date,
            COUNT(*) AS total_issued,
            NOW() as created_at
          FROM tickets t
          WHERE t.created_at IS NOT NULL
          GROUP BY t.service_id, DATE(t.created_at)
          ON DUPLICATE KEY UPDATE
            total_issued = VALUES(total_issued)
        `);
      } else {
        await queryRunner.query(`
          INSERT OR REPLACE INTO service_counter_history (service_id, counter_date, total_issued, created_at)
          SELECT
            t.service_id,
            date(t.created_at) AS counter_date,
            COUNT(*) AS total_issued,
            datetime('now') as created_at
          FROM tickets t
          WHERE t.created_at IS NOT NULL
          GROUP BY t.service_id, date(t.created_at)
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const connectionType = String(queryRunner.connection.options.type ?? '').toLowerCase();
    const isSqlite =
      connectionType === 'sqlite' || connectionType === 'better-sqlite3';
    const isMysql =
      connectionType.includes('mysql') ||
      connectionType.includes('mariadb') ||
      connectionType.includes('aurora-mysql');

    // Borrar histórico primero
    const hasHistory = await queryRunner.hasTable('service_counter_history');
    if (hasHistory) {
      if (!isSqlite) {
        try {
          await queryRunner.query(
            'ALTER TABLE service_counter_history DROP FOREIGN KEY fk_sch_service',
          );
        } catch {}
      } else {
        try {
          await queryRunner.query(
            'PRAGMA foreign_keys=off; ' +
              'DROP TABLE IF EXISTS service_counter_history; ' +
              'PRAGMA foreign_keys=on;',
          );
        } catch {}
      }

      try {
        await queryRunner.dropIndex('service_counter_history', 'idx_sch_service_date');
      } catch {}
      await queryRunner.dropTable('service_counter_history');
    }

    // Quitar counter_date si lo agregamos en service_counters
    const serviceCountersTable = await queryRunner.getTable('service_counters');
    if (serviceCountersTable) {
      const hasCounterDate = serviceCountersTable.columns.some(
        (col) => col.name === 'counter_date',
      );
      if (hasCounterDate) {
        await queryRunner.dropColumn('service_counters', 'counter_date');
      }
    }
  }
}
