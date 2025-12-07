"use client"
import { Badge } from "@/components/ui/badge"
import { Shield, ShieldCheck, Crown } from "lucide-react"
import type { Role } from "@/lib/types"

interface RoleBadgeProps {
  role: Role
  size?: "sm" | "md" | "lg"
}

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const roleConfig = {
    SUPERADMIN: {
      label: "Super Admin",
      variant: "destructive" as const,
      icon: Crown,
      description: "Acceso irrestricto",
    },
    ADMIN: {
      label: "Administrador",
      variant: "destructive" as const,
      icon: Crown,
      description: "Acceso completo al sistema",
    },
    SUPERVISOR: {
      label: "Supervisor",
      variant: "default" as const,
      icon: ShieldCheck,
      description: "Gestión de operaciones y reportes",
    },
    OPERATOR: {
      label: "Operador",
      variant: "secondary" as const,
      icon: Shield,
      description: "Atención de turnos",
    },
  }

  const defaultConfig = {
    label: "Rol desconocido",
    variant: "default" as const,
    icon: Shield,
  }

  const config = roleConfig[role] ?? defaultConfig
  const Icon = config.icon ?? defaultConfig.icon

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  return (
    <Badge variant={config.variant} className={sizeClasses[size]}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
