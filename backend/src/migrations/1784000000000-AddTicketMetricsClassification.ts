import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddTicketMetricsClassification1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCountsColumn = await queryRunner.hasColumn('tickets', 'counts_for_metrics');
    if (!hasCountsColumn) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'counts_for_metrics',
          type: 'tinyint',
          width: 1,
          isNullable: false,
          default: 1,
        }),
      );
    }

    const hasReasonColumn = await queryRunner.hasColumn('tickets', 'metrics_exclusion_reason');
    if (!hasReasonColumn) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'metrics_exclusion_reason',
          type: 'varchar',
          length: '80',
          isNullable: true,
        }),
      );
    }

    const indexes = await queryRunner.getTable('tickets');
    const hasIndex = indexes?.indices.some((idx) => idx.name === 'idx_tickets_metrics_productivity') ?? false;

    if (!hasIndex) {
      await queryRunner.createIndex(
        'tickets',
        new TableIndex({
          name: 'idx_tickets_metrics_productivity',
          columnNames: ['status', 'counts_for_metrics', 'completed_at'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tickets');
    const hasIndex = table?.indices.some((idx) => idx.name === 'idx_tickets_metrics_productivity') ?? false;

    if (hasIndex) {
      await queryRunner.dropIndex('tickets', 'idx_tickets_metrics_productivity');
    }

    if (await queryRunner.hasColumn('tickets', 'metrics_exclusion_reason')) {
      await queryRunner.dropColumn('tickets', 'metrics_exclusion_reason');
    }

    if (await queryRunner.hasColumn('tickets', 'counts_for_metrics')) {
      await queryRunner.dropColumn('tickets', 'counts_for_metrics');
    }
  }
}
