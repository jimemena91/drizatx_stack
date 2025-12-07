import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddQrScannedAtToTickets1765000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("tickets");
    if (!hasTable) return;

    const table = await queryRunner.getTable("tickets");
    const already = table?.columns.some(c => c.name === "qr_scanned_at");
    if (already) return;

    await queryRunner.addColumn(
      "tickets",
      new TableColumn({
        name: "qr_scanned_at",
        type: "timestamp",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("tickets");
    if (!hasTable) return;

    const table = await queryRunner.getTable("tickets");
    const exists = table?.columns.some(c => c.name === "qr_scanned_at");
    if (!exists) return;

    await queryRunner.dropColumn("tickets", "qr_scanned_at");
  }
}
