import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportSupportIndexes1755829707227 implements MigrationInterface {
  name = "ReportSupportIndexes1755829707227";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const idxExists = async (table: string, index: string) => {
      const rows: any[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
        [table, index],
      );
      return rows.length > 0;
    };

    if (!(await idxExists("tickets", "idx_tickets_created_status"))) {
      await queryRunner.query(
        "CREATE INDEX idx_tickets_created_status ON tickets (created_at, status)"
      );
    }
    if (!(await idxExists("tickets", "idx_tickets_service_created"))) {
      await queryRunner.query(
        "CREATE INDEX idx_tickets_service_created ON tickets (service_id, created_at)"
      );
    }
    if (!(await idxExists("tickets", "idx_tickets_operator_started"))) {
      await queryRunner.query(
        "CREATE INDEX idx_tickets_operator_started ON tickets (operator_id, started_at)"
      );
    }
    if (!(await idxExists("tickets", "idx_tickets_completed_at"))) {
      await queryRunner.query(
        "CREATE INDEX idx_tickets_completed_at ON tickets (completed_at)"
      );
    }
    if (!(await idxExists("tickets", "idx_tickets_number"))) {
      await queryRunner.query(
        "CREATE INDEX idx_tickets_number ON tickets (`number`)" // índice para rangos/búsquedas por número
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const idxExists = async (table: string, index: string) => {
      const rows: any[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
        [table, index],
      );
      return rows.length > 0;
    };

    const dropIfExists = async (table: string, index: string) => {
      if (await idxExists(table, index)) {
        await queryRunner.query(`DROP INDEX ${index} ON ${table}`);
      }
    };

    await dropIfExists("tickets", "idx_tickets_number");
    await dropIfExists("tickets", "idx_tickets_completed_at");
    await dropIfExists("tickets", "idx_tickets_operator_started");
    await dropIfExists("tickets", "idx_tickets_service_created");
    await dropIfExists("tickets", "idx_tickets_created_status");
  }
}
