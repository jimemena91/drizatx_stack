import type { LucideIcon } from "lucide-react"
import {
  Banknote,
  Briefcase,
  Building2,
  FileText,
  GraduationCap,
  Headset,
  HeartPulse,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react"

export type ServiceIconOption = {
  value: string
  label: string
  icon: LucideIcon
}

export const SERVICE_ICON_OPTIONS: ServiceIconOption[] = [
  { value: "headset", label: "Atención al cliente", icon: Headset },
  { value: "banknote", label: "Pagos y caja", icon: Banknote },
  { value: "file-text", label: "Documentación", icon: FileText },
  { value: "shield-check", label: "Seguridad", icon: ShieldCheck },
  { value: "heart-pulse", label: "Salud", icon: HeartPulse },
  { value: "graduation-cap", label: "Educación", icon: GraduationCap },
  { value: "briefcase", label: "Negocios", icon: Briefcase },
  { value: "building-2", label: "Atención presencial", icon: Building2 },
  { value: "users", label: "Servicios masivos", icon: Users },
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
