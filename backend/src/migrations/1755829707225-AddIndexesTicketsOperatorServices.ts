import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesTicketsOperatorServices1755829707225 implements MigrationInterface {
  name = 'AddIndexesTicketsOperatorServices1755829707225'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;

    // Crear idx_tickets_operator_status si no existe
    if (driver === 'mysql' || driver === 'mariadb') {
      const [row] = await queryRunner.query(`
        SELECT COUNT(1) AS cnt
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'tickets'
          AND index_name = 'idx_tickets_operator_status'
      `);
      if (!row || Number(row.cnt) === 0) {
        await queryRunner.query(
          `CREATE INDEX idx_tickets_operator_status ON tickets (operator_id, status)`
        );
      }
    } else {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_tickets_operator_status ON tickets (operator_id, status)`
      );
    }

    // NOTA: NO agregamos UNIQUE a operator_services porque la PK (operator_id, service_id)
    // ya garantiza unicidad. Evitamos choques/errores por índice duplicado.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;

    // Dropear idx_tickets_operator_status
    if (driver === 'mysql' || driver === 'mariadb') {
      // Verificamos existencia antes de dropear
      const [row] = await queryRunner.query(`
        SELECT COUNT(1) AS cnt
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'tickets'
          AND index_name = 'idx_tickets_operator_status'
      `);
      if (row && Number(row.cnt) > 0) {
        await queryRunner.query(`ALTER TABLE tickets DROP INDEX idx_tickets_operator_status`);
      }
    } else {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_operator_status`);
    }
  }
}
