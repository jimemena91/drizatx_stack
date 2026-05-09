"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRoute, getDefaultRouteForRole, hasPermission } from "@/lib/auth-utils"
import type { Permission } from "@/lib/types"
import { Loader2, ShieldX } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const DEMO_MODE =false

const PUBLIC_PREFIXES = ["/terminal", "/display", "/mobile"]

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  )
}

interface AuthGuardProps {
  children: React.ReactNode
  requiredPermissions?: Permission[]
}

export function AuthGuard({
  children,
  requiredPermissions,
}: AuthGuardProps) {
  const { state } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // 🌍 Rutas públicas o demo
  if (DEMO_MODE || isPublicPath(pathname)) {
    return <>{children}</>
  }

  // ⏳ Mientras carga el estado de auth
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">
            Verificando autenticación...
          </p>
        </div>
      </div>
    )
  }

  // 🚪 No autenticado → login
  // Esperamos hidratación completa antes de redirigir.
  const hasBrowserSession =
    typeof window !== "undefined" &&
    (localStorage.getItem("drizatx-user") ||
      localStorage.getItem("drizatx-token"))

  if (
    !state.isLoading &&
    !state.isAuthenticated &&
    !hasBrowserSession &&
    pathname !== "/login"
  ) {
    router.push("/login")
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">
            Redirigiendo al login...
          </p>
        </div>
      </div>
    )
  }

  // 🔁 Logueado y entra a /login
  if (state.isAuthenticated && pathname === "/login") {
    const target = getDefaultRouteForRole(state.user?.role)
    router.replace(target)
    return null
  }

  // 👷 OPERATOR siempre a /operator
  if (state.isAuthenticated && state.user?.role === "OPERATOR") {
    if (!pathname.startsWith("/operator")) {
      router.replace("/operator")
      return null
    }
  }

  // 🔐 Permisos por ruta
  const lacksRoutePermission =
    state.isAuthenticated &&
    !canAccessRoute(
      state.permissions,
      pathname,
      state.user?.role
    )

  const lacksRequiredPermission =
    state.isAuthenticated &&
    requiredPermissions?.some(
      (permission) =>
        !hasPermission(state.permissions, permission)
    )

  if (lacksRoutePermission || lacksRequiredPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              No tiene permisos para acceder a esta página.
              <br />
              Rol actual:{" "}
              <strong>{state.user?.role ?? "desconocido"}</strong>
            </AlertDescription>
          </Alert>

          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  getDefaultRouteForRole(state.user?.role)
                )
              }
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ✅ Autorizado
  return <>{children}</>
}
