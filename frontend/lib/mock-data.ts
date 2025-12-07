import { type Service, type Operator, type Ticket, type SystemSetting, Status, Role, type Client } from "./types"

// Servicios iniciales
export const mockServices: Service[] = [
  {
    id: 1,
    name: "Atención General",
    icon: "headset",
    prefix: "A",
    active: true,
    priority: 1,
    estimatedTime: 8,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 2,
    name: "Caja",
    icon: "banknote",
    prefix: "B",
    active: true,
    priority: 2,
    estimatedTime: 5,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 3,
    name: "Consultas",
    icon: "file-text",
    prefix: "C",
    active: true,
    priority: 3,
    estimatedTime: 15,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 4,
    name: "Reclamos",
    icon: "shield-check",
    prefix: "R",
    active: true,
    priority: 4,
    estimatedTime: 12,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
]

// Operadores iniciales
export const mockOperators: Operator[] = [
  {
    id: 1,
    name: "Super Admin",
    email: "superadmin@drizatx.com",
    position: "Seguridad",
    role: Role.SUPERADMIN,
    active: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 2,
    name: "Juan Pérez",
    email: "juan@drizatx.com",
    position: "Puesto 1",
    role: Role.OPERATOR,
    active: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 3,
    name: "María García",
    email: "maria@drizatx.com",
    position: "Puesto 2",
    role: Role.OPERATOR,
    active: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 4,
    name: "Carlos López",
    email: "carlos@drizatx.com",
    position: "Puesto 3",
    role: Role.SUPERVISOR,
    active: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: 5,
    name: "Ana Martín",
    email: "ana@drizatx.com",
    position: "Puesto 4",
    role: Role.OPERATOR,
    active: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
]

// Clientes simulados
export const mockClients: Client[] = [
  {
    id: 1,
    dni: "30123456",
    name: "Pedro Alvarez",
    email: "pedro@example.com",
    phone: "+5491112345678",
    vip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    dni: "28987654",
    name: "Lucía Fernández",
    email: "lucia@example.com",
    phone: "+5491198765432",
    vip: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    dni: "40111222",
    name: "Martín Rossi",
    email: "martin@example.com",
    phone: "+5491177711122",
    vip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 4,
    dni: "34555666",
    name: "Sofía Díaz",
    email: "sofia@example.com",
    phone: "+5491166611122",
    vip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 5,
    dni: "22333444",
    name: "Gustavo Pérez",
    email: "gustavo@example.com",
    phone: "+5491155511122",
    vip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Configuraciones del sistema
export const mockSettings: SystemSetting[] = [
  {
    id: 1,
    key: "maxWaitTime",
    value: "15",
    description: "Tiempo máximo de espera en minutos",
    updatedAt: new Date(),
  },
  {
    id: 2,
    key: "autoCallNext",
    value: "false",
    description: "Llamado automático del siguiente turno",
    updatedAt: new Date(),
  },
  {
    id: 3,
    key: "soundEnabled",
    value: "true",
    description: "Sonido habilitado para llamados",
    updatedAt: new Date(),
  },
  {
    id: 4,
    key: "displayTimeout",
    value: "30",
    description: "Tiempo de rotación de pantallas en segundos",
    updatedAt: new Date(),
  },
  {
    id: 5,
    key: "mobileEnabled",
    value: "true",
    description: "App móvil habilitada",
    updatedAt: new Date(),
  },
  {
    id: 6,
    key: "qrEnabled",
    value: "true",
    description: "Códigos QR habilitados",
    updatedAt: new Date(),
  },
  {
    id: 7,
    key: "notificationsEnabled",
    value: "true",
    description: "Notificaciones habilitadas",
    updatedAt: new Date(),
  },
  {
    id: 8,
    key: "showWaitTimes",
    value: "true",
    description: "Mostrar tiempos estimados de espera en pantallas y apps",
    updatedAt: new Date(),
  },
  {
    id: 9,
    key: "kioskRequireDni",
    value: "false",
    description: "Solicitar DNI obligatorio en terminales de autoservicio",
    updatedAt: new Date(),
  },
  {
    id: 10,
    key: "kioskAllowSms",
    value: "true",
    description: "Permitir registro de celular para notificaciones SMS",
    updatedAt: new Date(),
  },
  {
    id: 11,
    key: "kioskShowQueueStats",
    value: "true",
    description: "Mostrar métricas de espera en la terminal",
    updatedAt: new Date(),
  },
  {
    id: 111,
    key: "kioskPrintingEnabled",
    value: "false",
    description: "Habilitar impresión silenciosa directamente desde el navegador",
    updatedAt: new Date(),
  },
  {
    id: 12,
    key: "kioskWelcomeMessage",
    value: "Bienvenido a DrizaTX. Sacá tu turno en segundos",
    description: "Mensaje principal en la terminal de autoservicio",
    updatedAt: new Date(),
  },
  {
    id: 120,
    key: "kioskLocationName",
    value: "Sucursal Central",
    description: "Nombre de la sede que se imprime en el ticket",
    updatedAt: new Date(),
  },
  {
    id: 121,
    key: "terminal.printWebhookUrl",
    value: "",
    description: "Webhook para imprimir tickets desde la terminal",
    updatedAt: new Date(),
  },
  {
    id: 122,
    key: "terminal.printWebhookToken",
    value: "",
    description: "Token para autenticar el webhook de impresión",
    updatedAt: new Date(),
  },
  {
    id: 13,
    key: "signageTheme",
    value: "corporate",
    description: "Tema visual por defecto para pantallas y cartelería",
    updatedAt: new Date(),
  },
  {
    id: 14,
    key: "signageShowNews",
    value: "false",
    description: "Mostrar carrusel de noticias en las pantallas",
    updatedAt: new Date(),
  },
  {
    id: 15,
    key: "signageShowWeather",
    value: "true",
    description: "Mostrar pronóstico meteorológico en las pantallas",
    updatedAt: new Date(),
  },
  {
    id: 16,
    key: "signageShowWaitingList",
    value: "true",
    description: "Mostrar lista de espera de tickets en cartelería",
    updatedAt: new Date(),
  },
  {
    id: 17,
    key: "signageShowFlowSummary",
    value: "true",
    description: "Mostrar resumen de flujo en las pantallas",
    updatedAt: new Date(),
  },
  {
    id: 18,
    key: "signageShowKeyIndicators",
    value: "true",
    description: "Mostrar indicadores clave en las pantallas",
    updatedAt: new Date(),
  },
  {
    id: 19,
    key: "signageCurrencySource",
    value: "oficial",
    description: "Fuente de cotizaciones para cartelería digital",
    updatedAt: new Date(),
  },
  {
    id: 20,
    key: "alertsEscalationMinutes",
    value: "15",
    description: "Minutos para escalar una alerta de atención prolongada",
    updatedAt: new Date(),
  },
  {
    id: 21,
    key: "analyticsEmail",
    value: "reportes@drizatx.com",
    description: "Casilla que recibe reportes automáticos",
    updatedAt: new Date(),
  },
  {
    id: 22,
    key: "webhookUrl",
    value: "",
    description: "Webhook para integraciones externas",
    updatedAt: new Date(),
  },
  {
    id: 23,
    key: "brandPrimaryColor",
    value: "#0f172a",
    description: "Color primario para aplicaciones y pantallas",
    updatedAt: new Date(),
  },
  {
    id: 24,
    key: "brandSecondaryColor",
    value: "#22d3ee",
    description: "Color secundario para elementos destacados",
    updatedAt: new Date(),
  },
  {
    id: 25,
    key: "brandLogoUrl",
    value: "",
    description: "URL del logotipo institucional",
    updatedAt: new Date(),
  },
  {
    id: 26,
    key: "brandDisplayName",
    value: "DrizaTx",
    description: "Nombre visible en las pantallas y aplicaciones",
    updatedAt: new Date(),
  },
  {
    id: 27,
    key: "displayTitle",
    value: "Centro de Atención al Cliente",
    description: "Título principal para la cartelería de sala",
    updatedAt: new Date(),
  },
  {
    id: 28,
    key: "displaySlogan",
    value: "Sistema de Gestión de Colas DrizaTx",
    description: "Texto descriptivo mostrado en las pantallas de atención",
    updatedAt: new Date(),
  },
  {
    id: 29,
    key: "signageWeatherLocation",
    value: "Buenos Aires, AR",
    description: "Ubicación utilizada para el widget de clima",
    updatedAt: new Date(),
  },
  {
    id: 30,
    key: "signageWeatherLatitude",
    value: "-34.6037",
    description: "Latitud en grados decimales para el clima",
    updatedAt: new Date(),
  },
  {
    id: 31,
    key: "signageWeatherLongitude",
    value: "-58.3816",
    description: "Longitud en grados decimales para el clima",
    updatedAt: new Date(),
  },
  {
    id: 32,
    key: "backup.enabled",
    value: "true",
    description: "Habilitar respaldos automáticos diarios",
    updatedAt: new Date(),
  },
  {
    id: 33,
    key: "backup.directory",
    value: "storage/backups",
    description: "Directorio donde se guardan los respaldos",
    updatedAt: new Date(),
  },
  {
    id: 34,
    key: "backup.mysqldumpPath",
    value: "",
    description: "Ruta del ejecutable mysqldump para generar respaldos",
    updatedAt: new Date(),
  },
  {
    id: 35,
    key: "backup.time",
    value: "02:00",
    description: "Horario diario para ejecutar el respaldo automático",
    updatedAt: new Date(),
  },
  {
    id: 36,
    key: "backup.lastGeneratedAt",
    value: "",
    description: "Fecha del último respaldo generado",
    updatedAt: new Date(),
  },
  {
    id: 37,
    key: "backup.lastAutomaticAt",
    value: "",
    description: "Fecha del último respaldo automático",
    updatedAt: new Date(),
  },
  {
    id: 38,
    key: "backup.lastManualAt",
    value: "",
    description: "Fecha del último respaldo manual",
    updatedAt: new Date(),
  },
  {
    id: 39,
    key: "backup.lastGeneratedFile",
    value: "",
    description: "Nombre del último archivo de respaldo",
    updatedAt: new Date(),
  },
  {
    id: 40,
    key: "backup.lastDirectory",
    value: "storage/backups",
    description: "Directorio del último respaldo",
    updatedAt: new Date(),
  },
  {
    id: 41,
    key: "backup.lastSize",
    value: "0",
    description: "Tamaño del último respaldo en bytes",
    updatedAt: new Date(),
  },
  {
    id: 42,
    key: "backup.lastError",
    value: "",
    description: "Último error registrado en respaldos",
    updatedAt: new Date(),
  },
  {
    id: 43,
    key: "backup.lastFailureAt",
    value: "",
    description: "Fecha del último error en respaldos",
    updatedAt: new Date(),
  },
]

// Función para generar tickets simulados
export function generateMockTickets(): Ticket[] {
  const tickets: Ticket[] = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Generar tickets del día
  for (let i = 0; i < 50; i++) {
    const serviceId = Math.floor(Math.random() * 4) + 1
    const service = mockServices.find((s) => s.id === serviceId)!
    const createdAt = new Date(today.getTime() + Math.random() * (now.getTime() - today.getTime()))

    let status = Status.COMPLETED
    let calledAt: Date | null = null
    let startedAt: Date | null = null
    let completedAt: Date | null = null
    let operatorId: number | null = null

    // Determinar estado basado en la hora de creación
    const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)

    if (hoursSinceCreated < 0.1) {
      // Últimos 6 minutos
      status = Status.WAITING
    } else if (hoursSinceCreated < 0.2) {
      // Entre 6-12 minutos
      status = Math.random() > 0.5 ? Status.CALLED : Status.IN_PROGRESS
      calledAt = new Date(createdAt.getTime() + Math.random() * 300000) // +5 min max
      operatorId = Math.floor(Math.random() * 3) + 1

      if (status === Status.IN_PROGRESS) {
        startedAt = new Date(calledAt.getTime() + Math.random() * 120000) // +2 min max
      }
    } else {
      status = Status.COMPLETED
      calledAt = new Date(createdAt.getTime() + Math.random() * 600000) // +10 min max
      startedAt = new Date(calledAt.getTime() + Math.random() * 120000)
      completedAt = new Date(startedAt.getTime() + service.estimatedTime * 60000 + Math.random() * 300000)
      operatorId = Math.floor(Math.random() * 3) + 1
    }

    const ticketNumber = `${service.prefix}${(i + 1).toString().padStart(3, "0")}`

    // Asignar cliente aleatorio en ~40% de los casos
    const clientId = Math.random() < 0.4 ? mockClients[Math.floor(Math.random() * mockClients.length)].id : null

    tickets.push({
      id: i + 1,
      number: ticketNumber,
      serviceId,
      status,
      priority: 1,
      createdAt,
      calledAt,
      startedAt,
      completedAt,
      operatorId,
      estimatedWaitTime: service.estimatedTime,
      actualWaitTime: completedAt ? Math.round((completedAt.getTime() - createdAt.getTime()) / 60000) : null,
      mobilePhone: Math.random() > 0.7 ? `+54911${Math.floor(Math.random() * 90000000) + 10000000}` : null,
      notificationSent: false,
      almostReadyNotificationSentAt: null,
      clientId,
      qrScannedAt: null,
    })
  }

  return tickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
