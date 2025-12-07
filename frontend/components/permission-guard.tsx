"use client"

import type React from "react"
import { useAuth } from "@/contexts/auth-context"
import { hasPermission } from "@/lib/auth-utils"
import { Role, type Permission } from "@/lib/types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ShieldX } from "lucide-react"

interface PermissionGuardProps {
  permission: Permission
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
}

export function PermissionGuard({ permission, children, fallback, showError = false }: PermissionGuardProps) {
  const { state } = useAuth()
  const currentRole = state.user?.role

  // 1) Si no está autenticado, bloqueamos igual que antes
  if (!state.isAuthenticated) {
    if (showError) {
      return (
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>No tiene permisos para acceder a esta funcionalidad.</AlertDescription>
        </Alert>
      )
    }
    return fallback || null
  }

  // 2) Bypass total para SUPERADMIN y ADMIN
  if (currentRole === Role.SUPERADMIN || currentRole === Role.ADMIN) {
    return <>{children}</>
  }

  // 3) Para el resto de roles, se controla por permisos como siempre
  if (!hasPermission(state.permissions, permission)) {
    if (showError) {
      return (
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>No tiene permisos para acceder a esta funcionalidad.</AlertDescription>
        </Alert>
      )
    }
    return fallback || null
  }

  return <>{children}</>
}
