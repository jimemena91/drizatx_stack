import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAbsentStatusAndQueueTimestamps1755834100000 implements MigrationInterface {
  name = "AddAbsentStatusAndQueueTimestamps1755834100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Ampliar el ENUM con ABSENT
    await queryRunner.query(`
      ALTER TABLE tickets
      MODIFY status ENUM('WAITING','CALLED','IN_PROGRESS','COMPLETED','CANCELLED','ABSENT')
      NOT NULL DEFAULT 'WAITING'
    `);

    // 2) Trazabilidad para ausentes y reintegros
    await queryRunner.query(`ALTER TABLE tickets ADD COLUMN absent_at TIMESTAMP NULL`);
    await queryRunner.query(`ALTER TABLE tickets ADD COLUMN requeued_at TIMESTAMP NULL`);

    // 3) Índice para consultas de cola (orden por requeued_at/created_at)
    await queryRunner.query(`
      CREATE INDEX idx_tickets_queue_v1
        ON tickets (service_id, status, requeued_at, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_tickets_queue_v1 ON tickets`);
    await queryRunner.query(`ALTER TABLE tickets DROP COLUMN requeued_at`);
    await queryRunner.query(`ALTER TABLE tickets DROP COLUMN absent_at`);
    await queryRunner.query(`
      ALTER TABLE tickets
      MODIFY status ENUM('WAITING','CALLED','IN_PROGRESS','COMPLETED','CANCELLED')
      NOT NULL DEFAULT 'WAITING'
    `);
  }
}
