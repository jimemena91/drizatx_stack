import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceNextTicketNumber1755829707229 implements MigrationInterface {
  name = 'AddServiceNextTicketNumber1755829707229';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `services` ADD `next_ticket_number` int UNSIGNED NOT NULL DEFAULT '1'",
    );

    await queryRunner.query(`
      UPDATE services s
      SET s.next_ticket_number = (
        SELECT COALESCE(
          MAX(CAST(SUBSTRING(t.number, CHAR_LENGTH(s.prefix) + 1) AS UNSIGNED)),
          0
        ) + 1
        FROM tickets t
        WHERE t.service_id = s.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `services` DROP COLUMN `next_ticket_number`');
  }
}
