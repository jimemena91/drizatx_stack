import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOperatorServices1755829707224 implements MigrationInterface {
  name = 'CreateOperatorServices1755829707224';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE operator_services (
        operator_id int NOT NULL,
        service_id int UNSIGNED NOT NULL,
        active tinyint(1) NOT NULL DEFAULT 1,
        weight int NOT NULL DEFAULT 1,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (operator_id, service_id),
        CONSTRAINT fk_os_operator FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
        CONSTRAINT fk_os_service  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX ix_os_operator ON operator_services(operator_id)`);
    await queryRunner.query(`CREATE INDEX ix_os_service  ON operator_services(service_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE operator_services`);
  }
}
