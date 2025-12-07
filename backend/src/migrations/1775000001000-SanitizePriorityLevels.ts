import { MigrationInterface, QueryRunner } from "typeorm";

export class SanitizePriorityLevels1775000001000 implements MigrationInterface {
  name = "SanitizePriorityLevels1775000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const ticketsHasPriority = await queryRunner.hasColumn("tickets", "priority");
    const servicesHasPriority = await queryRunner.hasColumn("services", "priority");

    const ticketsSource = ticketsHasPriority
      ? "COALESCE(priority_level, priority, 3)"
      : "COALESCE(priority_level, 3)";
    const servicesSource = servicesHasPriority
      ? "COALESCE(priority_level, priority, 3)"
      : "COALESCE(priority_level, 3)";

    await queryRunner.query(
      `UPDATE tickets SET priority_level = LEAST(6, GREATEST(1, ${ticketsSource}))`,
    );
    await queryRunner.query(
      `UPDATE services SET priority_level = LEAST(6, GREATEST(1, ${servicesSource}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: mantener los datos saneados (no revertimos a estados inconsistentes).
  }
}
