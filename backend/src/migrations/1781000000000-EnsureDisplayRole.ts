import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureDisplayRole1781000000000 implements MigrationInterface {
  name = 'EnsureDisplayRole1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = (await queryRunner.query(
      `SELECT id FROM roles WHERE UPPER(TRIM(slug)) = 'DISPLAY' LIMIT 1`,
    )) as Array<{ id: number }>;

    if (existing.length === 0) {
      await queryRunner.query(
        `INSERT INTO roles (slug, name, description) VALUES (?, ?, ?)`,
        ['DISPLAY', 'Display', 'Acceso restringido a cartelería digital'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM roles WHERE UPPER(TRIM(slug)) = 'DISPLAY'`);
  }
}
