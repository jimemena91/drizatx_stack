import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreatePrintJobsTable1780000001000 implements MigrationInterface {
  name = 'CreatePrintJobsTable1780000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`print_jobs\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`source\` varchar(50) NOT NULL DEFAULT 'terminal',
        \`source_reference\` varchar(100) NULL,
        \`ticket_id\` bigint NULL,
        \`service_id\` bigint NULL,
        \`ticket_number\` varchar(50) NOT NULL,
        \`service_name\` varchar(150) NOT NULL,
        \`client_name\` varchar(150) NULL,
        \`payload_json\` json NULL,
        \`status\` varchar(30) NOT NULL DEFAULT 'pending',
        \`attempts\` int NOT NULL DEFAULT 0,
        \`last_error\` text NULL,
        \`locked_at\` datetime NULL,
        \`printed_at\` datetime NULL,
        \`last_attempt_at\` datetime NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_print_jobs_status_created_at\` (\`status\`, \`created_at\`),
        INDEX \`IDX_print_jobs_ticket_id\` (\`ticket_id\`),
        INDEX \`IDX_print_jobs_service_id\` (\`service_id\`),
        INDEX \`IDX_print_jobs_source_reference\` (\`source_reference\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`print_jobs\``)
  }
}
