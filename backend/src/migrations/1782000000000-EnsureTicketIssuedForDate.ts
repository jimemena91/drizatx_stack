import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class EnsureTicketIssuedForDate1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tickets');
    if (!table) return;

    const hasIssuedForDate =
      table.columns.some((column) => column.name === 'issued_for_date');

    if (!hasIssuedForDate) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'issued_for_date',
          type: 'date',
          isNullable: true,
        }),
      );

      await queryRunner.query(`
        UPDATE tickets
        SET issued_for_date = DATE(created_at)
        WHERE issued_for_date IS NULL
      `);

      await queryRunner.query(`
        ALTER TABLE tickets
        MODIFY issued_for_date DATE NOT NULL
      `);
    }

    const refreshedTable = await queryRunner.getTable('tickets');

    const hasOldIndex =
      refreshedTable?.indices.some(
        (index) => index.name === 'ux_tickets_service_number',
      ) ?? false;

    const hasNewIndex =
      refreshedTable?.indices.some(
        (index) => index.name === 'ux_tickets_service_date_number',
      ) ?? false;

    if (hasOldIndex) {
      await queryRunner.dropIndex(
        'tickets',
        'ux_tickets_service_number',
      );
    }

    if (!hasNewIndex) {
      await queryRunner.createIndex(
        'tickets',
        new TableIndex({
          name: 'ux_tickets_service_date_number',
          columnNames: ['service_id', 'issued_for_date', 'number'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tickets');
    if (!table) return;

    const hasNewIndex = table.indices.some(
      (index) => index.name === 'ux_tickets_service_date_number',
    );

    if (hasNewIndex) {
      await queryRunner.dropIndex(
        'tickets',
        'ux_tickets_service_date_number',
      );
    }

    const refreshedTable = await queryRunner.getTable('tickets');

    const hasOldIndex =
      refreshedTable?.indices.some(
        (index) => index.name === 'ux_tickets_service_number',
      ) ?? false;

    if (!hasOldIndex) {
      await queryRunner.createIndex(
        'tickets',
        new TableIndex({
          name: 'ux_tickets_service_number',
          columnNames: ['service_id', 'number'],
          isUnique: true,
        }),
      );
    }

    const latestTable = await queryRunner.getTable('tickets');

    const hasIssuedForDate =
      latestTable?.columns.some(
        (column) => column.name === 'issued_for_date',
      ) ?? false;

    if (hasIssuedForDate) {
      await queryRunner.dropColumn(
        'tickets',
        'issued_for_date',
      );
    }
  }
}
