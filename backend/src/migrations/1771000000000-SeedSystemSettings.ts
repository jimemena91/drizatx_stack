import { MigrationInterface, QueryRunner } from "typeorm";

interface SettingSeed {
  key: string;
  value: string;
  description: string | null;
}

const SETTINGS: SettingSeed[] = [
  { key: "maxWaitTime", value: "15", description: "Tiempo máximo de espera en minutos" },
  { key: "autoCallNext", value: "false", description: "Llamado automático del siguiente turno" },
  { key: "soundEnabled", value: "true", description: "Sonido habilitado para llamados" },
  { key: "displayTimeout", value: "30", description: "Tiempo de rotación de pantallas en segundos" },
  { key: "mobileEnabled", value: "true", description: "App móvil habilitada" },
  { key: "qrEnabled", value: "true", description: "Códigos QR habilitados" },
  { key: "notificationsEnabled", value: "true", description: "Notificaciones habilitadas" },
  { key: "showWaitTimes", value: "true", description: "Mostrar tiempos estimados de espera" },
  { key: "kioskRequireDni", value: "false", description: "Solicitar DNI obligatorio en terminales" },
  { key: "kioskAllowSms", value: "true", description: "Permitir registro de celular para SMS" },
  { key: "kioskShowQueueStats", value: "true", description: "Mostrar métricas en la terminal" },
  {
    key: "kioskWelcomeMessage",
    value: "Bienvenido a DrizaTX. Sacá tu turno en segundos",
    description: "Mensaje principal en la terminal",
  },
  {
    key: "kioskLocationName",
    value: "Sucursal Central",
    description: "Nombre de la sede impreso en los tickets",
  },
  { key: "signageTheme", value: "corporate", description: "Tema visual por defecto para cartelería" },
  { key: "signageShowNews", value: "false", description: "Mostrar carrusel de noticias" },
  { key: "signageShowWeather", value: "true", description: "Mostrar pronóstico del clima" },
  {
    key: "signageShowWaitingList",
    value: "true",
    description: "Mostrar lista de espera de tickets en cartelería",
  },
  {
    key: "signageShowFlowSummary",
    value: "true",
    description: "Mostrar resumen de flujo en cartelería",
  },
  {
    key: "signageShowKeyIndicators",
    value: "true",
    description: "Mostrar indicadores clave en cartelería",
  },
  { key: "signageCurrencySource", value: "oficial", description: "Fuente de cotizaciones para cartelería" },
  {
    key: "signageIndicatorsRefreshMinutes",
    value: "5",
    description: "Minutos entre actualizaciones de indicadores y cotizaciones",
  },
  { key: "alertsEscalationMinutes", value: "15", description: "Minutos para escalar alertas" },
  { key: "analyticsEmail", value: "reportes@drizatx.com", description: "Casilla que recibe reportes automáticos" },
  { key: "webhookUrl", value: "", description: "Webhook para integraciones externas" },
  { key: "brandDisplayName", value: "DrizaTx", description: "Nombre visible en pantallas y apps" },
  { key: "brandPrimaryColor", value: "#0f172a", description: "Color primario institucional" },
  { key: "brandSecondaryColor", value: "#22d3ee", description: "Color secundario institucional" },
  { key: "brandLogoUrl", value: "", description: "URL del logotipo" },
  { key: "displayTitle", value: "Centro de Atención al Cliente", description: "Título principal en cartelería" },
  { key: "displaySlogan", value: "Sistema de Gestión de Colas DrizaTx", description: "Slogan mostrado en pantallas" },
  { key: "signageWeatherLocation", value: "Buenos Aires, AR", description: "Ubicación para el widget de clima" },
  { key: "signageWeatherLatitude", value: "-34.6037", description: "Latitud para obtener el clima" },
  { key: "signageWeatherLongitude", value: "-58.3816", description: "Longitud para obtener el clima" },
  { key: "backup.enabled", value: "true", description: "Habilitar respaldos automáticos diarios" },
  { key: "backup.directory", value: "storage/backups", description: "Directorio donde se guardan los respaldos" },
  {
    key: "backup.mysqldumpPath",
    value: "",
    description: "Ruta del ejecutable mysqldump para generar respaldos automáticos",
  },
  { key: "backup.time", value: "02:00", description: "Horario diario para el respaldo automático" },
  { key: "backup.lastGeneratedAt", value: "", description: "Fecha del último respaldo generado" },
  { key: "backup.lastAutomaticAt", value: "", description: "Fecha del último respaldo automático" },
  { key: "backup.lastManualAt", value: "", description: "Fecha del último respaldo manual" },
  { key: "backup.lastGeneratedFile", value: "", description: "Nombre del último archivo de respaldo" },
  { key: "backup.lastDirectory", value: "", description: "Directorio del último respaldo" },
  { key: "backup.lastSize", value: "0", description: "Tamaño del último respaldo en bytes" },
  { key: "backup.lastError", value: "", description: "Último error registrado en respaldos" },
  { key: "backup.lastFailureAt", value: "", description: "Fecha del último error en respaldos" },
];

export class SeedSystemSettings1771000000000 implements MigrationInterface {
  name = "SeedSystemSettings1771000000000";

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
