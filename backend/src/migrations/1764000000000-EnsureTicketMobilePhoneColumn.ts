import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class EnsureTicketMobilePhoneColumn1764000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("tickets");
    const column = table?.findColumnByName("mobile_phone") ?? null;

    if (!column) {
      await queryRunner.addColumn(
        "tickets",
        new TableColumn({
          name: "mobile_phone",
          type: "varchar",
          length: "20",
          isNullable: true,
        }),
      );
      return;
    }

    if (!column.isNullable || column.type !== "varchar" || column.length !== "20") {
      await queryRunner.changeColumn(
        "tickets",
        column,
        new TableColumn({
          name: "mobile_phone",
          type: "varchar",
          length: "20",
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("tickets");
    const column = table?.findColumnByName("mobile_phone") ?? null;
    if (!column) return;

    await queryRunner.dropColumn("tickets", column);
  }
}
