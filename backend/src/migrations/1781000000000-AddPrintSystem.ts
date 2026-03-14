import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrintSystem1781000000000 implements MigrationInterface {
  name = "AddPrintSystem1781000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE print_bridges (
        id char(36) NOT NULL,
        client_id char(36) NOT NULL,
        branch_id char(36) NOT NULL,
        name varchar(120) NOT NULL,
        secret_token varchar(255) NOT NULL,
        status ENUM('ONLINE','OFFLINE','DEGRADED') NOT NULL DEFAULT 'OFFLINE',
        last_seen_at datetime NULL,
        printer_name varchar(255) NULL,
        app_version varchar(50) NULL,
        local_ip varchar(50) NULL,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_bridge_client_branch_name (client_id, branch_id, name)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE print_jobs (
        id char(36) NOT NULL,
        client_id char(36) NOT NULL,
        branch_id char(36) NOT NULL,
        bridge_id char(36) NULL,
        source_type ENUM('TERMINAL','DASHBOARD','ADMIN','SYSTEM') NOT NULL,
        source_reference varchar(120) NULL,
        status ENUM(
          'PENDING',
          'SENT',
          'ACKED',
          'PRINTING',
          'PRINTED',
          'FAILED',
          'CANCELLED'
        ) NOT NULL DEFAULT 'PENDING',
        payload_json JSON NOT NULL,
        error_message TEXT NULL,
        attempts INT NOT NULL DEFAULT 0,
        sent_at datetime NULL,
        acked_at datetime NULL,
        printed_at datetime NULL,
        failed_at datetime NULL,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_print_jobs_status_branch (branch_id, status),
        KEY idx_print_jobs_created_at (created_at),
        KEY idx_print_jobs_bridge_id (bridge_id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE print_job_events (
        id BIGINT NOT NULL AUTO_INCREMENT,
        print_job_id char(36) NOT NULL,
        event_type varchar(50) NOT NULL,
        event_payload JSON NULL,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_print_job_events_job (print_job_id)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE print_job_events`);
    await queryRunner.query(`DROP TABLE print_jobs`);
    await queryRunner.query(`DROP TABLE print_bridges`);
  }
}
