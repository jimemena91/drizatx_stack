import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPriorityLevelsAndAlternateQueue1774000000000 implements MigrationInterface {
  name = "AddPriorityLevelsAndAlternateQueue1774000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `services` CHANGE COLUMN `priority` `priority_level` TINYINT NOT NULL DEFAULT 3",
    );

    const hasSystemLocked = await queryRunner.hasColumn("services", "system_locked");
    if (!hasSystemLocked) {
      await queryRunner.query(
        "ALTER TABLE `services` ADD COLUMN `system_locked` TINYINT(1) NOT NULL DEFAULT 0",
      );
    }

    await queryRunner.query(
      "ALTER TABLE `tickets` CHANGE COLUMN `priority` `priority_level` TINYINT NOT NULL DEFAULT 1",
    );

    const ticketsTable = await queryRunner.getTable("tickets");
    const hasIndex = ticketsTable?.indices.some((idx) => idx.name === "idx_tickets_status_priority_created");
    if (!hasIndex) {
      await queryRunner.query(
        "CREATE INDEX `idx_tickets_status_priority_created` ON `tickets` (`status`, `priority_level`, `created_at`)",
      );
    }

    const hasTicketAudit = await queryRunner.hasTable("ticket_audit");
    if (hasTicketAudit) {
      const hasPrioritySixColumn = await queryRunner.hasColumn("ticket_audit", "was_priority_six");
      if (!hasPrioritySixColumn) {
        await queryRunner.query(
          "ALTER TABLE `ticket_audit` ADD COLUMN `was_priority_six` TINYINT(1) NOT NULL DEFAULT 0 AFTER `metadata`",
        );
      }
    }

    await queryRunner.query(
      "INSERT INTO system_settings (`key`, `value`, `description`) VALUES ('queue.alternate_priority_every', '3', 'Cantidad de atenciones consecutivas antes de priorizar al ticket más urgente (1-6).') ON DUPLICATE KEY UPDATE `value` = `value`",
    );

    const existingPriorityService = await queryRunner.query(
      "SELECT id FROM services WHERE name = ?",
      ["Atención prioritaria"],
    );

    if (!Array.isArray(existingPriorityService) || existingPriorityService.length === 0) {
      await queryRunner.query(
        "INSERT INTO services (name, prefix, active, priority_level, estimated_time, next_ticket_number, system_locked, created_at, updated_at) VALUES (?, ?, 1, 6, 10, 1, 1, NOW(), NOW())",
        ["Atención prioritaria", "AP6"],
      );

      const [serviceRow] = (await queryRunner.query(
        "SELECT id FROM services WHERE name = ?",
        ["Atención prioritaria"],
      )) as Array<{ id: number }>;

      if (serviceRow && serviceRow.id) {
        await queryRunner.query(
          "INSERT INTO service_counters (service_id, last_seq) VALUES (?, 0) ON DUPLICATE KEY UPDATE last_seq = last_seq",
          [serviceRow.id],
        );
      }
    } else {
      await queryRunner.query(
        "UPDATE services SET system_locked = 1, priority_level = 6 WHERE name = ?",
        ["Atención prioritaria"],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ticketsTable = await queryRunner.getTable("tickets");
    const hasIndex = ticketsTable?.indices.some((idx) => idx.name === "idx_tickets_status_priority_created");
    if (hasIndex) {
      await queryRunner.query("DROP INDEX `idx_tickets_status_priority_created` ON `tickets`");
    }

    await queryRunner.query(
      "ALTER TABLE `tickets` CHANGE COLUMN `priority_level` `priority` INT NOT NULL DEFAULT 1",
    );

    const hasSystemLocked = await queryRunner.hasColumn("services", "system_locked");
    if (hasSystemLocked) {
      await queryRunner.query("ALTER TABLE `services` DROP COLUMN `system_locked`");
    }

    await queryRunner.query(
      "ALTER TABLE `services` CHANGE COLUMN `priority_level` `priority` INT NOT NULL DEFAULT 1",
    );

    const hasTicketAudit = await queryRunner.hasTable("ticket_audit");
    if (hasTicketAudit) {
      const hasPrioritySixColumn = await queryRunner.hasColumn("ticket_audit", "was_priority_six");
      if (hasPrioritySixColumn) {
        await queryRunner.query("ALTER TABLE `ticket_audit` DROP COLUMN `was_priority_six`");
      }
    }

    await queryRunner.query(
      "DELETE FROM system_settings WHERE `key` = 'queue.alternate_priority_every'",
    );

    await queryRunner.query(
      "DELETE FROM services WHERE name = ? AND system_locked = 1",
      ["Atención prioritaria"],
    );
  }
}
