import { MigrationInterface, QueryRunner, TableColumn } from "typeorm"

export class AddServiceIconColumn1773000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("services", "icon")
    if (!hasColumn) {
      await queryRunner.addColumn(
        "services",
        new TableColumn({
          name: "icon",
          type: "varchar",
          length: "100",
          isNullable: true,
        }),
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("services", "icon")
    if (hasColumn) {
      await queryRunner.dropColumn("services", "icon")
    }
  }
}
