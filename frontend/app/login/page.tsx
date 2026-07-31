"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { useAuth } from "@/contexts/auth-context"
import {
  DEFAULT_CREDENTIALS,
  getDefaultRouteForRole,
} from "@/lib/auth-utils"

export default function LoginPage() {
  const isDemoMode = false
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    const normalizedUsername = username.trim()

    if (!normalizedUsername) {
      setError("Ingrese un usuario válido")
      return
    }

    setIsLoading(true)

    try {
      const user = await login({
        username: normalizedUsername,
        password,
      })

      if (!user) {
        setError(
          "Credenciales incorrectas. Verifique su usuario y contraseña.",
        )
        return
      }

      const target = getDefaultRouteForRole((user as any).role)
      router.replace(target || "/dashboard")
    } catch (loginError: any) {
      setError(
        loginError?.message ??
          "No se pudo iniciar sesión. Intente nuevamente.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = (role: keyof typeof DEFAULT_CREDENTIALS) => {
    const credentials = DEFAULT_CREDENTIALS[role]

    const derivedUsername =
      (credentials as any).username ??
      ((credentials as any).email
        ? String((credentials as any).email).split("@")[0]
        : "")

    setUsername(derivedUsername || "")
    setPassword((credentials as any).password || "")
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#080512] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(124,58,237,0.34),transparent_31%),radial-gradient(circle_at_86%_20%,rgba(217,70,239,0.24),transparent_29%),radial-gradient(circle_at_52%_88%,rgba(6,182,212,0.21),transparent_36%),linear-gradient(135deg,#090516_0%,#15082d_48%,#071326_100%)]" />

        <div className="absolute -left-28 top-[4%] h-96 w-96 rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="absolute -right-24 top-[10%] h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-400/15 blur-[150px]" />

        <div className="absolute left-[11%] top-[14%] size-2 rounded-full bg-white/40 shadow-[0_0_24px_rgba(255,255,255,0.75)]" />
        <div className="absolute right-[15%] top-[24%] size-1.5 rounded-full bg-fuchsia-200/50 shadow-[0_0_20px_rgba(244,114,182,0.8)]" />
        <div className="absolute bottom-[17%] left-[17%] size-1 rounded-full bg-cyan-100/50 shadow-[0_0_18px_rgba(103,232,249,0.8)]" />
        <div className="absolute bottom-[28%] right-[12%] size-1.5 rounded-full bg-violet-200/40 shadow-[0_0_20px_rgba(196,181,253,0.75)]" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />

        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/10 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[100svh] items-center justify-center px-4 py-8 sm:px-6">
        <section className="relative w-full max-w-[31rem]">
          <div
            aria-hidden="true"
            className="absolute -inset-8 rounded-[3rem] bg-violet-500/10 blur-3xl"
          />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.12] bg-white/[0.065] px-5 py-8 shadow-[0_40px_110px_rgba(3,2,12,0.60),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:px-9 sm:py-10">
            <div
              aria-hidden="true"
              className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />

            <div
              aria-hidden="true"
              className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-[80px]"
            />

            <div
              aria-hidden="true"
              className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-[90px]"
            />

            <div className="relative">
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 scale-[1.55] rounded-full bg-violet-500/20 blur-3xl"
                  />

                  <div className="relative">
                    <Logo
                      size="lg"
                      display="full"
                      variant="dark"
                      priority
                    />
                  </div>
                </div>
              </div>

              <div className="mb-8 text-center">
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.45rem]">
                  Bienvenido a DrizaTx
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/55 sm:text-base">
                  Inicie sesión para continuar
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2.5">
                  <Label
                    htmlFor="username"
                    className="text-sm font-medium text-white/78"
                  >
                    Usuario
                  </Label>

                  <div className="group relative">
                    <UserRound
                      aria-hidden="true"
                      className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-violet-300"
                    />

                    <Input
                      id="username"
                      type="text"
                      placeholder="Ingrese su usuario"
                      value={username}
                      onChange={(event) =>
                        setUsername(event.target.value)
                      }
                      required
                      disabled={isLoading}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-14 rounded-2xl border-white/[0.11] bg-black/[0.14] pl-12 pr-4 text-base text-white shadow-none outline-none placeholder:text-white/28 hover:border-white/20 hover:bg-white/[0.06] focus-visible:border-violet-400/70 focus-visible:ring-4 focus-visible:ring-violet-500/15 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-white/78"
                  >
                    Contraseña
                  </Label>

                  <div className="group relative">
                    <LockKeyhole
                      aria-hidden="true"
                      className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-violet-300"
                    />

                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingrese su contraseña"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="h-14 rounded-2xl border-white/[0.11] bg-black/[0.14] pl-12 pr-12 text-base text-white shadow-none outline-none placeholder:text-white/28 hover:border-white/20 hover:bg-white/[0.06] focus-visible:border-violet-400/70 focus-visible:ring-4 focus-visible:ring-violet-500/15 disabled:opacity-60"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 size-10 -translate-y-1/2 rounded-xl text-white/42 hover:bg-white/10 hover:text-white"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      disabled={isLoading}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff className="size-5" />
                      ) : (
                        <Eye className="size-5" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert
                    variant="destructive"
                    role="alert"
                    className="rounded-2xl border-red-300/20 bg-red-500/10 text-red-100"
                  >
                    <AlertDescription className="leading-5">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="group relative h-14 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-base font-semibold text-white shadow-[0_18px_45px_rgba(124,58,237,0.30)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_22px_55px_rgba(124,58,237,0.42)] focus-visible:ring-4 focus-visible:ring-violet-300/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />

                  <span className="relative flex items-center justify-center">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-5 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        Ingresar
                        <ArrowRight className="ml-2 size-5 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </Button>
              </form>

              {isDemoMode && (
                <div className="mt-6 space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>

                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#161023] px-3 text-white/40">
                        Cuentas de demo
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDemoLogin("admin")}
                      disabled={isLoading}
                      className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 hover:text-white"
                    >
                      Administrador
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDemoLogin("supervisor")}
                      disabled={isLoading}
                      className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 hover:text-white"
                    >
                      Supervisor
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDemoLogin("operator")}
                      disabled={isLoading}
                      className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 hover:text-white"
                    >
                      Operador
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-white/38">
                <ShieldCheck className="size-4 text-cyan-300/65" />
                <span>Acceso protegido · DrizaTx 1.0.0</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
