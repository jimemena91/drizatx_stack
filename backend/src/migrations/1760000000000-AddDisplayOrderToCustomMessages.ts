import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisplayOrderToCustomMessages1760000000000 implements MigrationInterface {
  name = 'AddDisplayOrderToCustomMessages1760000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`custom_messages\`
      ADD COLUMN \`display_order\` int NOT NULL DEFAULT 0 AFTER \`priority\`
    `);

    await queryRunner.query(`
      UPDATE \`custom_messages\`
      SET \`display_order\` = \`id\`
      WHERE \`display_order\` = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`custom_messages\`
      DROP COLUMN \`display_order\`
    `);
  }
}
