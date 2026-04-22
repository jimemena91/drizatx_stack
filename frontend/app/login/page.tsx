"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Logo } from "@/components/logo"
import { DEFAULT_CREDENTIALS, getDefaultRouteForRole } from "@/lib/auth-utils"
import { useAuth } from "@/contexts/auth-context"

type LoginResponse = {
  access_token?: string
  token?: string
  user?: { role?: string } & Record<string, any>
  message?: string
}

export default function LoginPage() {
  const isDemoMode = false
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const u = username.trim()
    if (!u) {
      setError("Ingrese un usuario válido")
      return
    }

    setIsLoading(true)
    try {
const user = await login({ username: u, password })

if (!user) {
  setError("Credenciales incorrectas. Verifique su usuario y contraseña.")
  return
}

document.cookie = "drizatx-auth=1; path=/; secure; samesite=lax";
document.cookie = `drizatx-role=${user.role}; path=/; secure; samesite=lax`;

const target = getDefaultRouteForRole((user as any).role)
router.replace(target || "/")
router.refresh()
    } catch (err: any) {
      setError(err?.message ?? "No se pudo iniciar sesión. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = (role: keyof typeof DEFAULT_CREDENTIALS) => {
    const cred = DEFAULT_CREDENTIALS[role]
    const derivedUsername =
      (cred as any).username ?? ((cred as any).email ? String((cred as any).email).split("@")[0] : "")

    setUsername(derivedUsername || "")
    setPassword((cred as any).password || "")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Iniciar Sesión</CardTitle>
            <CardDescription>Ingrese su usuario y contraseña para acceder</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="ej: admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>

          {isDemoMode && (
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Cuentas de demo</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleDemoLogin("admin")} disabled={isLoading} className="text-xs">
                  Administrador
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleDemoLogin("supervisor")} disabled={isLoading} className="text-xs">
                  Supervisor
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleDemoLogin("operator")} disabled={isLoading} className="text-xs">
                  Operador
                </Button>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground">
            <p>Sistema de Gestión de Colas DrizaTx</p>
            <p>Versión 1.0.0</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
