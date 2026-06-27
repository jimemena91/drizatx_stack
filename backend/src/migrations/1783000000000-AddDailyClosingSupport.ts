import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddDailyClosingSupport1783000000000 implements MigrationInterface {
  name = 'AddDailyClosingSupport1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const connectionType = String(queryRunner.connection.options.type ?? '').toLowerCase();
    const isMysql =
      connectionType.includes('mysql') ||
      connectionType.includes('mariadb') ||
      connectionType.includes('aurora-mysql');
    const isSqlite = connectionType === 'sqlite' || connectionType === 'better-sqlite3';

    const ticketsTable = await queryRunner.getTable('tickets');

    if (isMysql) {
      await queryRunner.query(`
        ALTER TABLE tickets
        MODIFY status ENUM(
          'WAITING',
          'CALLED',
          'IN_PROGRESS',
          'COMPLETED',
          'CANCELLED',
          'ABSENT',
          'DAILY_CLOSED'
        ) NOT NULL DEFAULT 'WAITING'
      `);
    }

    if (ticketsTable && !ticketsTable.columns.some((col) => col.name === 'closed_at')) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'closed_at',
          type: isSqlite ? 'datetime' : 'timestamp',
          isNullable: true,
        }),
      );
    }

    const ticketsAfterClosedAt = await queryRunner.getTable('tickets');
    if (ticketsAfterClosedAt && !ticketsAfterClosedAt.columns.some((col) => col.name === 'closed_reason')) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'closed_reason',
          type: 'varchar',
          length: '80',
          isNullable: true,
        }),
      );
    }

    const ticketsAfterReason = await queryRunner.getTable('tickets');
    if (ticketsAfterReason && !ticketsAfterReason.columns.some((col) => col.name === 'closed_by')) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'closed_by',
          type: 'varchar',
          length: '80',
          isNullable: true,
        }),
      );
    }

    const ticketsAfterColumns = await queryRunner.getTable('tickets');
    if (ticketsAfterColumns && !ticketsAfterColumns.indices.some((idx) => idx.name === 'idx_tickets_daily_closing')) {
      await queryRunner.createIndex(
        'tickets',
        new TableIndex({
          name: 'idx_tickets_daily_closing',
          columnNames: ['issued_for_date', 'status'],
        }),
      );
    }

    const hasClosureLogs = await queryRunner.hasTable('daily_closure_logs');
    if (!hasClosureLogs) {
      await queryRunner.createTable(
        new Table({
          name: 'daily_closure_logs',
          engine: isMysql ? 'InnoDB' : undefined,
          columns: [
            {
              name: 'id',
              type: isSqlite ? 'integer' : 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'closure_date',
              type: 'date',
              isNullable: false,
            },
            {
              name: 'status',
              type: 'varchar',
              length: '30',
              isNullable: false,
              default: "'COMPLETED'",
            },
            {
              name: 'tickets_closed',
              type: 'int',
              isNullable: false,
              default: 0,
            },
            {
              name: 'waiting_closed',
              type: 'int',
              isNullable: false,
              default: 0,
            },
            {
              name: 'called_closed',
              type: 'int',
              isNullable: false,
              default: 0,
            },
            {
              name: 'in_progress_closed',
              type: 'int',
              isNullable: false,
              default: 0,
            },
            {
              name: 'executed_at',
              type: isSqlite ? 'datetime' : 'timestamp',
              isNullable: false,
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'executed_by',
              type: 'varchar',
              length: '80',
              isNullable: false,
              default: "'system'",
            },
            {
              name: 'notes',
              type: 'text',
              isNullable: true,
            },
          ],
          indices: [
            {
              name: 'ux_daily_closure_logs_date',
              columnNames: ['closure_date'],
              isUnique: true,
            },
          ],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const connectionType = String(queryRunner.connection.options.type ?? '').toLowerCase();
    const isMysql =
      connectionType.includes('mysql') ||
      connectionType.includes('mariadb') ||
      connectionType.includes('aurora-mysql');

    const hasClosureLogs = await queryRunner.hasTable('daily_closure_logs');
    if (hasClosureLogs) {
      await queryRunner.dropTable('daily_closure_logs');
    }

    const ticketsTable = await queryRunner.getTable('tickets');

    if (ticketsTable?.indices.some((idx) => idx.name === 'idx_tickets_daily_closing')) {
      await queryRunner.dropIndex('tickets', 'idx_tickets_daily_closing');
    }

    const ticketsAfterIndex = await queryRunner.getTable('tickets');
    if (ticketsAfterIndex?.columns.some((col) => col.name === 'closed_by')) {
      await queryRunner.dropColumn('tickets', 'closed_by');
    }

    const ticketsAfterClosedBy = await queryRunner.getTable('tickets');
    if (ticketsAfterClosedBy?.columns.some((col) => col.name === 'closed_reason')) {
      await queryRunner.dropColumn('tickets', 'closed_reason');
    }

    const ticketsAfterReason = await queryRunner.getTable('tickets');
    if (ticketsAfterReason?.columns.some((col) => col.name === 'closed_at')) {
      await queryRunner.dropColumn('tickets', 'closed_at');
    }

    if (isMysql) {
      await queryRunner.query(`
        ALTER TABLE tickets
        MODIFY status ENUM(
          'WAITING',
          'CALLED',
          'IN_PROGRESS',
          'COMPLETED',
          'CANCELLED',
          'ABSENT'
        ) NOT NULL DEFAULT 'WAITING'
      `);
    }
  }
}
