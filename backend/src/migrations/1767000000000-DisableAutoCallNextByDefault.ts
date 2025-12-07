import { MigrationInterface, QueryRunner } from "typeorm";

export class DisableAutoCallNextByDefault1767000000000 implements MigrationInterface {
  name = "DisableAutoCallNextByDefault1767000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE system_settings SET value = 'false' WHERE `key` = 'autoCallNext'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE system_settings SET value = 'true' WHERE `key` = 'autoCallNext'",
    );
  }
}
