import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeightColumnToOperatorServices1759257462264 implements MigrationInterface {
  name = 'AddWeightColumnToOperatorServices1759257462264';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasWeightColumn = await queryRunner.hasColumn('operator_services', 'weight');

    if (!hasWeightColumn) {
      await queryRunner.query(
        `ALTER TABLE operator_services ADD COLUMN weight int NOT NULL DEFAULT 1`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasWeightColumn = await queryRunner.hasColumn('operator_services', 'weight');

    if (hasWeightColumn) {
      await queryRunner.query(`ALTER TABLE operator_services DROP COLUMN weight`);
    }
  }
}
