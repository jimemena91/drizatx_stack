import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAttentionStartSource1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('tickets', 'attention_start_source'))) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'attention_start_source',
          type: 'varchar',
          length: '20',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('tickets', 'attention_start_source')) {
      await queryRunner.dropColumn('tickets', 'attention_start_source');
    }
  }
}
