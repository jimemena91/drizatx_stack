import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1763000000000 implements MigrationInterface {
  name = 'CreateAuditLogs1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`audit_logs\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`event_type\` varchar(120) NOT NULL,
        \`action\` varchar(150) NOT NULL,
        \`target\` varchar(255) NULL,
        \`description\` text NULL,
        \`severity\` varchar(20) NOT NULL DEFAULT 'low',
        \`actor_id\` int NULL,
        \`actor_name\` varchar(255) NULL,
        \`actor_role\` varchar(100) NULL,
        \`actor_snapshot\` json NULL,
        \`ip\` varchar(100) NULL,
        \`source\` varchar(150) NULL,
        \`tags\` json NULL,
        \`changes\` json NULL,
        \`metadata\` json NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`CREATE INDEX \`idx_audit_logs_created_at\` ON \`audit_logs\` (\`created_at\`)`);
    await queryRunner.query(`CREATE INDEX \`idx_audit_logs_severity\` ON \`audit_logs\` (\`severity\`)`);
    await queryRunner.query(`CREATE INDEX \`idx_audit_logs_actor\` ON \`audit_logs\` (\`actor_id\`)`);
    await queryRunner.query(`CREATE INDEX \`idx_audit_logs_event_type\` ON \`audit_logs\` (\`event_type\`)`);
    await queryRunner.query(`
      ALTER TABLE \`audit_logs\`
      ADD CONSTRAINT \`FK_audit_logs_actor\`
      FOREIGN KEY (\`actor_id\`) REFERENCES \`operators\`(\`id\`)
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`audit_logs\` DROP FOREIGN KEY \`FK_audit_logs_actor\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_logs_event_type\` ON \`audit_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_logs_actor\` ON \`audit_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_logs_severity\` ON \`audit_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_logs_created_at\` ON \`audit_logs\``);
    await queryRunner.query(`DROP TABLE \`audit_logs\``);
  }
}
