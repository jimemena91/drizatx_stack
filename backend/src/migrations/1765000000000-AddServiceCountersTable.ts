import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class AddServiceCountersTable1765000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1️⃣ Crear la tabla service_counters si no existe
    const exists = await queryRunner.hasTable("service_counters");
    if (!exists) {
      await queryRunner.createTable(
        new Table({
          name: "service_counters",
          columns: [
            {
              name: "service_id",
              type: "int",
              unsigned: true,
              isPrimary: true,
            },
            {
              name: "last_seq",
              type: "int",
              isNullable: false,
              default: 0,
            },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        "service_counters",
        new TableForeignKey({
          columnNames: ["service_id"],
          referencedTableName: "services",
          referencedColumnNames: ["id"],
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        }),
      );
    }

    // 2️⃣ Crear índice único en tickets(service_id, number)
    const table = await queryRunner.getTable("tickets");
    const hasIndex = table?.indices.some((idx) =>
      idx.columnNames.includes("service_id") && idx.columnNames.includes("number")
    );
    if (!hasIndex) {
      await queryRunner.createIndex(
        "tickets",
        new TableIndex({
          name: "ux_tickets_service_number",
          columnNames: ["service_id", "number"],
          isUnique: true,
        }),
      );
    }

    // 3️⃣ Inicializar service_counters con los máximos actuales
    await queryRunner.query(`
      INSERT INTO service_counters (service_id, last_seq)
      SELECT s.id,
             COALESCE(
               MAX(CAST(REGEXP_REPLACE(t.number, '[^0-9]', '') AS UNSIGNED)),
             0) AS last_seq
      FROM services s
      LEFT JOIN tickets t ON t.service_id = s.id
      GROUP BY s.id
      ON DUPLICATE KEY UPDATE last_seq = VALUES(last_seq);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir índice y tabla
    const table = await queryRunner.getTable("tickets");
    const idx = table?.indices.find((i) => i.name === "ux_tickets_service_number");
    if (idx) {
      await queryRunner.dropIndex("tickets", "ux_tickets_service_number");
    }

    const exists = await queryRunner.hasTable("service_counters");
    if (exists) {
      await queryRunner.dropTable("service_counters");
    }
  }
}
