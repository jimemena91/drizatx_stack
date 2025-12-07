import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddAttentionTimingColumns1759257462265 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasServiceColumn = await queryRunner.hasColumn("services", "max_attention_time")
    if (!hasServiceColumn) {
      await queryRunner.addColumn(
        "services",
        new TableColumn({ name: "max_attention_time", type: "int", isNullable: true }),
      )
    }

    const hasTicketColumn = await queryRunner.hasColumn("tickets", "attention_duration")
    if (!hasTicketColumn) {
      await queryRunner.addColumn(
        "tickets",
        new TableColumn({ name: "attention_duration", type: "int", isNullable: true }),
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTicketColumn = await queryRunner.hasColumn("tickets", "attention_duration")
    if (hasTicketColumn) {
      await queryRunner.dropColumn("tickets", "attention_duration")
    }

    const hasServiceColumn = await queryRunner.hasColumn("services", "max_attention_time")
    if (hasServiceColumn) {
      await queryRunner.dropColumn("services", "max_attention_time")
    }
  }
}
