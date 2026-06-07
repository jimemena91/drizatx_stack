import type { LucideIcon } from "lucide-react"
import {
  Ambulance,
  Banknote,
  Briefcase,
  Building2,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Droplets,
  FileCheck2,
  FileText,
  FlaskConical,
  GraduationCap,
  Hammer,
  HardHat,
  Headset,
  HeartHandshake,
  HeartPulse,
  Hospital,
  Info,
  Landmark,
  PackageCheck,
  PaintBucket,
  Pill,
  ReceiptText,
  Scale,
  Send,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Syringe,
  Ticket,
  Truck,
  UserCheck,
  Users,
  Wrench,
  Zap,
} from "lucide-react"

export type ServiceIconCategory =
  | "Atención"
  | "Farmacia y salud"
  | "Ferretería y corralón"
  | "Comercio y caja"
  | "Trámites y gobierno"
  | "Educación y servicios"
  | "Logística"

export type ServiceIconOption = {
  value: string
  label: string
  category: ServiceIconCategory
  icon: LucideIcon
}

export const SERVICE_ICON_OPTIONS: ServiceIconOption[] = [
  { value: "headset", label: "Atención al cliente", category: "Atención", icon: Headset },
  { value: "user-check", label: "Atención personalizada", category: "Atención", icon: UserCheck },
  { value: "circle-help", label: "Consultas", category: "Atención", icon: CircleHelp },
  { value: "info", label: "Información", category: "Atención", icon: Info },
  { value: "users", label: "Servicios masivos", category: "Atención", icon: Users },

  { value: "pill", label: "Farmacia", category: "Farmacia y salud", icon: Pill },
  { value: "receipt-text", label: "Caja farmacia", category: "Farmacia y salud", icon: ReceiptText },
  { value: "file-check-2", label: "Recetas", category: "Farmacia y salud", icon: FileCheck2 },
  { value: "heart-handshake", label: "Obras sociales", category: "Farmacia y salud", icon: HeartHandshake },
  { value: "syringe", label: "Vacunación", category: "Farmacia y salud", icon: Syringe },
  { value: "flask-conical", label: "Laboratorio", category: "Farmacia y salud", icon: FlaskConical },
  { value: "stethoscope", label: "Consulta médica", category: "Farmacia y salud", icon: Stethoscope },
  { value: "heart-pulse", label: "Salud", category: "Farmacia y salud", icon: HeartPulse },
  { value: "hospital", label: "Clínica / Hospital", category: "Farmacia y salud", icon: Hospital },
  { value: "ambulance", label: "Emergencias", category: "Farmacia y salud", icon: Ambulance },
  { value: "package-check", label: "Entrega medicamentos", category: "Farmacia y salud", icon: PackageCheck },

  { value: "hammer", label: "Ferretería", category: "Ferretería y corralón", icon: Hammer },
  { value: "wrench", label: "Herramientas", category: "Ferretería y corralón", icon: Wrench },
  { value: "paint-bucket", label: "Pinturería", category: "Ferretería y corralón", icon: PaintBucket },
  { value: "zap", label: "Electricidad", category: "Ferretería y corralón", icon: Zap },
  { value: "droplets", label: "Sanitarios / Plomería", category: "Ferretería y corralón", icon: Droplets },
  { value: "hard-hat", label: "Corralón / Construcción", category: "Ferretería y corralón", icon: HardHat },
  { value: "clipboard-list", label: "Presupuestos", category: "Ferretería y corralón", icon: ClipboardList },

  { value: "banknote", label: "Pagos y caja", category: "Comercio y caja", icon: Banknote },
  { value: "credit-card", label: "Tarjetas y cobros", category: "Comercio y caja", icon: CreditCard },
  { value: "shopping-cart", label: "Comercio / Supermercado", category: "Comercio y caja", icon: ShoppingCart },

  { value: "file-text", label: "Documentación", category: "Trámites y gobierno", icon: FileText },
  { value: "landmark", label: "Municipalidad / Gobierno", category: "Trámites y gobierno", icon: Landmark },
  { value: "scale", label: "Legal / Reclamos", category: "Trámites y gobierno", icon: Scale },
  { value: "shield-check", label: "Seguridad", category: "Trámites y gobierno", icon: ShieldCheck },

  { value: "graduation-cap", label: "Educación", category: "Educación y servicios", icon: GraduationCap },
  { value: "briefcase", label: "Negocios", category: "Educación y servicios", icon: Briefcase },
  { value: "building-2", label: "Atención presencial", category: "Educación y servicios", icon: Building2 },

  { value: "truck", label: "Envíos / Logística", category: "Logística", icon: Truck },
  { value: "send", label: "Despacho", category: "Logística", icon: Send },
]

const SERVICE_ICON_MAP = new Map<string, LucideIcon>(
  SERVICE_ICON_OPTIONS.map((option) => [option.value, option.icon]),
)

export const DEFAULT_SERVICE_ICON = Ticket

export function getServiceIcon(value?: string | null): LucideIcon {
  if (!value) return DEFAULT_SERVICE_ICON
  const normalized = value.trim().toLowerCase()
  return SERVICE_ICON_MAP.get(normalized) ?? DEFAULT_SERVICE_ICON
}
