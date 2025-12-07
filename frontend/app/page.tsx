"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Monitor, Smartphone, Tv, Settings, BarChart3, Users, Clock, QrCode, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useQueueStatus } from "@/hooks/use-queue-status"
import { PermissionGuard } from "@/components/permission-guard"
import { useAuth } from "@/contexts/auth-context"
import { RoleBadge } from "@/components/role-badge"

export default function HomePage() {
  const { getQueueStatus } = useQueueStatus()
  const { state } = useAuth()
  const queueStatus = getQueueStatus()
  const isSuperAdmin = state.user?.role === "SUPERADMIN"

  const getWelcomeMessage = () => {
    if (!state.user) return "Bienvenido al Sistema"
    switch (state.user.role) {
      case "SUPERADMIN":
      case "ADMIN":
      case "SUPERVISOR":
      case "OPERATOR":
      default:
        return `Bienvenido, ${state.user.name}`
    }
  }

  const getDescription = () => {
    if (!state.user) return "Optimiza flujos de personas en entornos de atención masiva"
    switch (state.user.role) {
      case "SUPERADMIN":
        return "Acceso completo al ecosistema DrizaTX"
      case "ADMIN":
        return "Panel de control completo para administrar el sistema de colas"
      case "SUPERVISOR":
        return "Supervise las operaciones y analice el rendimiento del sistema"
      case "OPERATOR":
        return "Gestione la atención de turnos de manera eficiente"
      default:
        return "Optimiza flujos de personas en entornos de atención masiva"
    }
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="text-center px-2">
        <div className="flex flex-col gap-2 items-center justify-center mb-4 sm:flex-row sm:gap-3">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{getWelcomeMessage()}</h1>
          {state.user && <RoleBadge role={state.user.role} />}
        </div>
        <p className="text-base text-gray-600 max-w-3xl mx-auto sm:text-lg">
          {getDescription()}
        </p>
        <div className="mt-6 flex justify-center">
          {state.isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="lg">Ir al Dashboard</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="lg">Iniciar sesión</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <PermissionGuard permission="view_dashboard">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-6 w-6 text-blue-600" />
                Dashboard Operativo
              </CardTitle>
              <CardDescription>Monitoreo en tiempo real de filas y atención</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button className="w-full">Acceder al Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </PermissionGuard>

        <PermissionGuard permission="call_tickets">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-6 w-6 text-green-600" />
                Terminal Autoservicio
              </CardTitle>
              <CardDescription>Emisión de turnos físicos y digitales</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/terminal">
                <Button className="w-full bg-transparent" variant="outline">
                  Ver Terminal
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PermissionGuard>

        {/* Cartelería visible para todos, App Móvil solo para superadmins */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-6 w-6 text-purple-600" />
              Cartelería Digital
            </CardTitle>
            <CardDescription>Pantallas dinámicas con información en tiempo real</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/display">
              <Button className="w-full bg-transparent" variant="outline">
                Ver Cartelería
              </Button>
            </Link>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-6 w-6 text-orange-600" />
                App Móvil
              </CardTitle>
              <CardDescription>Turnos desde el celular sin instalación</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/mobile">
                <Button className="w-full bg-transparent" variant="outline">
                  Ver App Móvil
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <PermissionGuard permission="view_reports">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-red-600" />
                Reportes y Analytics
              </CardTitle>
              <CardDescription>Análisis históricos y toma de decisiones</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/reports">
                <Button className="w-full bg-transparent" variant="outline">
                  Ver Reportes
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PermissionGuard>

        <PermissionGuard permission="manage_clients">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-6 w-6 text-indigo-600" />
                Gestión de Clientes
              </CardTitle>
              <CardDescription>Administrar base de datos de clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/clients">
                <Button className="w-full bg-transparent" variant="outline">
                  Ver Clientes
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PermissionGuard>

        <PermissionGuard permission="manage_settings">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-gray-600" />
                Administración
              </CardTitle>
              <CardDescription>Configuración del sistema y usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin">
                <Button className="w-full bg-transparent" variant="outline">
                  Panel Admin
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PermissionGuard>

        <PermissionGuard permission="view_system_logs">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                Auditoría
              </CardTitle>
              <CardDescription>Historial detallado de cambios y accesos</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/audit">
                <Button className="w-full bg-transparent" variant="outline">
                  Ver Auditoría
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PermissionGuard>
      </div>

      {/* Métricas en tiempo real */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Clock className="h-5 w-5" />
              Tiempo de Espera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 sm:text-3xl">
              {typeof queueStatus.todayMetrics.averageWaitTime === "number"
                ? `${queueStatus.todayMetrics.averageWaitTime} min`
                : "—"}
            </div>
            <p className="text-sm text-blue-600">Promedio actual</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Users className="h-5 w-5" />
              Personas en Cola
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 sm:text-3xl">
              {typeof queueStatus.todayMetrics.totalInQueue === "number"
                ? queueStatus.todayMetrics.totalInQueue
                : "—"}
            </div>
            <p className="text-sm text-green-600">En todas las filas</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Monitor className="h-5 w-5" />
              Atendidos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 sm:text-3xl">
              {typeof queueStatus.todayMetrics.attendedToday === "number"
                ? queueStatus.todayMetrics.attendedToday
                : "—"}
            </div>
            <p className="text-sm text-purple-600">Tickets completados</p>
          </CardContent>
        </Card>
      </div>

      {state.user?.role === "OPERATOR" && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-700">Panel de Operador</CardTitle>
            <CardDescription>Acceso rápido a sus funciones principales</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link href="/terminal" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-green-600 hover:bg-green-700">
                <QrCode className="h-5 w-5 mr-2" />
                Llamar Siguiente Turno
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Monitor className="h-5 w-5 mr-2" />
                Ver Cola Actual
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
