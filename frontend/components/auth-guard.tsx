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

const DEMO_MODE = typeof window !== "undefined" && process.env.NEXT_PUBLIC_DEMO_MODE === "1"
const PUBLIC_PREFIXES = ["/terminal", "/display", "/mobile"]

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))
}

interface AuthGuardProps {
  children: React.ReactNode
  requiredPermissions?: Permission[]
}

export function AuthGuard({ children, requiredPermissions }: AuthGuardProps) {
  const { state } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Público: no se exige auth ni permisos
  if (DEMO_MODE || isPublicPath(pathname)) return <>{children}</>

  useEffect(() => {
    if (state.isLoading) return

    if (!state.isAuthenticated && pathname !== "/login") {
      router.push("/login")
      return
    }

    if (state.isAuthenticated && pathname === "/login") {
      const target = getDefaultRouteForRole(state.user?.role)
      router.push(target)
      return
    }

    if (state.isAuthenticated && state.user?.role === "OPERATOR") {
      const isOperatorPath = pathname?.startsWith("/operator")
      if (!isOperatorPath) router.replace("/operator")
      return
    }
  }, [state.isLoading, state.isAuthenticated, state.user?.role, pathname, router])

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (!state.isAuthenticated && pathname !== "/login") return null

  const lacksRoutePermission =
    state.isAuthenticated && !canAccessRoute(state.permissions, pathname, state.user?.role)

  const lacksRequiredPermission =
    state.isAuthenticated &&
    requiredPermissions?.some((permission) => !hasPermission(state.permissions, permission))

  if (lacksRoutePermission || lacksRequiredPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              No tiene permisos para acceder a esta página. Su rol actual ({state.user?.role ?? "desconocido"}) no
              permite el acceso a esta funcionalidad.
            </AlertDescription>
          </Alert>
          <div className="flex justify-center">
            <Button onClick={() => router.push(getDefaultRouteForRole(state.user?.role))} variant="outline">
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
