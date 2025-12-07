import { MigrationInterface, QueryRunner } from "typeorm";

interface SettingSeed {
  key: string;
  value: string;
  description: string | null;
}

const SETTINGS: SettingSeed[] = [
  {
    key: "terminal.printWebhookUrl",
    value: "",
    description: "URL del webhook que recibe las solicitudes de impresión de tickets",
  },
  {
    key: "terminal.printWebhookToken",
    value: "",
    description: "Token Bearer para autenticar las solicitudes de impresión",
  },
];

export class AddTerminalPrintWebhookSettings1766000001000 implements MigrationInterface {
  name = "AddTerminalPrintWebhookSettings1766000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const setting of SETTINGS) {
      await queryRunner.query(
        "INSERT INTO system_settings (`key`, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = value",
        [setting.key, setting.value, setting.description],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const keys = SETTINGS.map((setting) => setting.key);
    if (keys.length === 0) return;
    const placeholders = keys.map(() => "?").join(",");
    await queryRunner.query(`DELETE FROM system_settings WHERE \`key\` IN (${placeholders})`, keys);
  }
}
