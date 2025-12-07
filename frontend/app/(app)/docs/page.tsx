"use client"

import type React from "react"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BookOpen,
  LayoutDashboard,
  QrCode,
  Tv,
  Smartphone,
  BarChart3,
  Settings,
  Users,
  Cable,
  Database,
  Shield,
  Accessibility,
  Sparkles,
  FileText,
  FolderGit2,
} from "lucide-react"

export default function DocsPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documentación del Sistema — DrizaTx</h1>
          <p className="text-gray-600 mt-1">Guía funcional y técnica del Sistema Integral de Gestión de Colas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Frontend-first</Badge>
          <Badge variant="outline">LocalStorage</Badge>
          <Badge variant="outline">Next.js App Router</Badge>
        </div>
      </div>

      {/* Mapa rápido de módulos */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <DocCard title="Dashboard Operativo" href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
          Monitoreo en tiempo real de colas, operadores y próximos turnos.
        </DocCard>
        <DocCard title="Terminal Autoservicio" href="/terminal" icon={<QrCode className="h-4 w-4" />}>
          Emisión de turnos, verificación por DNI y QR simulado.
        </DocCard>
        <DocCard title="Cartelería Digital" href="/display" icon={<Tv className="h-4 w-4" />}>
          Pantallas para sala de espera: turno actual, próximos, métricas.
        </DocCard>
        <DocCard title="App Móvil" href="/mobile" icon={<Smartphone className="h-4 w-4" />}>
          Obtención y seguimiento del turno desde el teléfono.
        </DocCard>
        <DocCard title="Reportes y Analytics" href="/reports" icon={<BarChart3 className="h-4 w-4" />}>
          KPIs diarios/semanales y distribución por servicios/operadores.
        </DocCard>
        <DocCard title="Administración" href="/admin" icon={<Settings className="h-4 w-4" />}>
          Servicios, operadores, configuración y respaldos.
        </DocCard>
        <DocCard title="Clientes" href="/clients" icon={<Users className="h-4 w-4" />}>
          Alta/edición, búsqueda por DNI e importación CSV.
        </DocCard>
        <DocCard title="Inicio" href="/" icon={<BookOpen className="h-4 w-4" />}>
          Acceso a módulos y KPIs resumidos.
        </DocCard>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Accessibility className="h-4 w-4" />
            Guía rápida para administradores
          </CardTitle>
          <CardDescription>Checklist esencial para operar el sistema día a día.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <ol className="list-decimal ml-5 space-y-2">
            <li>Ingresar al panel y confirmar que los servicios, operadores y horarios estén actualizados.</li>
            <li>Revisar el Dashboard Operativo para validar colas activas, niveles de servicio y alertas.</li>
            <li>Verificar que la cartelería digital y la terminal autoservicio estén sincronizadas.</li>
            <li>Controlar respaldos recientes desde el módulo Administración antes de iniciar la jornada.</li>
          </ol>
          <p className="font-medium">Acciones críticas del rol administrador:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Crear, editar o pausar servicios según la demanda.</li>
            <li>Gestionar operadores: altas, bajas, turnos y estados de disponibilidad.</li>
            <li>Actualizar mensajes en pantallas y configurar reglas automáticas de atención.</li>
            <li>Exportar reportes para gerencia y compartir métricas relevantes.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Manual operativo por módulo
          </CardTitle>
          <CardDescription>Qué debe revisar el administrador en cada sección.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="dashboard-admin">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard Operativo
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                  <li>Controla en tiempo real tickets en espera, llamados y en atención.</li>
                  <li>Filtra por servicio para detectar cuellos de botella y reasignar operadores.</li>
                  <li>Accede a exportaciones rápidas (CSV/JSON) para respaldo manual.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="terminal-admin">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Terminal Autoservicio
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                  <li>Define servicios disponibles y mensajes mostrados al público.</li>
                  <li>Valida que la impresión o visualización de tickets funcione antes de abrir.</li>
                  <li>Reinicia el flujo si hay filas congeladas limpiando el estado desde Administración.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="display-admin">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <Tv className="h-4 w-4" />
                  Cartelería Digital
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                  <li>Comprueba que los últimos tickets llamados se sincronicen y rotulen correctamente.</li>
                  <li>Personaliza mensajes informativos o de espera para la sala.</li>
                  <li>Activa modo de emergencia mostrando avisos especiales cuando sea necesario.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="reports-admin">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Reportes y Analytics
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                  <li>Consulta KPIs diarios/semanales y compara desempeño por servicio.</li>
                  <li>Detecta desvíos de espera para ajustar dotación.</li>
                  <li>Programa envíos periódicos de reportes a stakeholders.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="admin-admin">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Administración
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                  <li>Gestiona catálogo de servicios, operadores y clientes especiales.</li>
                  <li>Configura reglas automáticas (llamado siguiente, pausas, límites de tickets).</li>
                  <li>Verifica y descarga respaldos para auditoría.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Procedimientos clave
          </CardTitle>
          <CardDescription>Secuencias sugeridas para situaciones frecuentes.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6 text-sm text-gray-700">
          <div className="space-y-2">
            <h3 className="font-semibold">Emisión y control de turnos</h3>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Validar datos del ciudadano desde la terminal o cargar manualmente en Administración.</li>
              <li>Confirmar asignación en el Dashboard y monitorear tiempos de espera.</li>
              <li>Comunicar cambios por cartelería o notificaciones móviles.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Escalamiento de incidencias</h3>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Registrar la incidencia (servicio, ticket, operador) en el libro de guardia.</li>
              <li>Intentar resolución operativa: reinicio de módulo, reasignación o edición manual.</li>
              <li>Si persiste, escalar al superadministrador adjuntando exportes y logs relevantes.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Documentación técnica para superadministrador
          </CardTitle>
          <CardDescription>Referencias de arquitectura, datos e integraciones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <p>
            Esta sección amplía la información necesaria para mantenimiento avanzado, despliegue e integración con
            infraestructura corporativa. Úsala para planificar evoluciones, auditorías y soporte de segundo nivel.
          </p>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="arquitectura">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4" />
                  Arquitectura y tecnologías
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Frontend</CardTitle>
                      <CardDescription>UI y estado</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-gray-700">
                      <ul className="list-disc ml-5 space-y-1">
                        <li>Next.js (App Router) con React 18 y componentes shadcn/ui.</li>
                        <li>Gestión de estado mediante Context API + useReducer + persistencia localStorage.</li>
                        <li>Visualizaciones con Recharts y timers para simulación en tiempo real.</li>
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Backend listo (opcional)</CardTitle>
                      <CardDescription>Integración futura</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-gray-700">
                      <ul className="list-disc ml-5 space-y-1">
                        <li>API Routes: /api/services, /api/tickets, /api/operators, /api/queue-status.</li>
                        <li>NestJS + TypeORM + MySQL para persistencia real (ver carpeta backend).</li>
                        <li>Configurar <code>DATABASE_URL</code> y ejecutar migraciones antes de habilitar producción.</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="datos-estado">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Modelo de datos y estado global
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Entidades principales</CardTitle>
                      <CardDescription>Relaciones clave</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-1">
                      <ul className="list-disc ml-5">
                        <li>Service, Operator, Client, Ticket, SystemSetting.</li>
                        <li>Ticket relaciona servicio, operador (opcional) y cliente (opcional).</li>
                        <li>Estados: WAITING, CALLED, IN_PROGRESS, COMPLETED, CANCELLED.</li>
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Persistencia y "tiempo real"</CardTitle>
                      <CardDescription>Simulación actual</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-1">
                      <ul className="list-disc ml-5">
                        <li>Serialización de fechas en localStorage y refrescos periódicos.</li>
                        <li>currentTime centralizado para calcular métricas dinámicas.</li>
                        <li>Preparado para reemplazar por eventos desde backend (WebSockets/SSE).</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="flujos">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <Cable className="h-4 w-4" />
                  Flujos del sistema
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Emisión de ticket</CardTitle>
                      <CardDescription>Terminal y clientes</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-2">
                      <ol className="list-decimal ml-5 space-y-1">
                        <li>Validación de DNI contra clientes y creación si no existe.</li>
                        <li>Selección de servicio, cálculo de número y tiempo estimado.</li>
                        <li>Generación de ticket con QR simulado y comunicación opcional.</li>
                      </ol>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Atención operativa</CardTitle>
                      <CardDescription>Panel de operadores</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-2">
                      <ol className="list-decimal ml-5 space-y-1">
                        <li>Llamado de tickets por prioridad + FIFO.</li>
                        <li>Registro de inicio/fin de atención y estados ausente/cancelado.</li>
                        <li>Sincronización con cartelería y métricas en dashboard.</li>
                      </ol>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="integraciones">
              <AccordionTrigger>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Integraciones y siguientes pasos
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Integración externa</CardTitle>
                      <CardDescription>Servicios corporativos</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-1">
                      <ul className="list-disc ml-5">
                        <li>SSO corporativo (OAuth2/SAML) y sincronización de roles.</li>
                        <li>APIs REST/GraphQL para consulta de clientes y reportes.</li>
                        <li>Webhooks para cartelería física o bots de mensajería.</li>
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Operación y calidad</CardTitle>
                      <CardDescription>Hardening y observabilidad</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-1">
                      <ul className="list-disc ml-5">
                        <li>Implementar monitoreo (APM, logs centralizados, alertas).</li>
                        <li>Pruebas automatizadas (unitarias, integración, e2e).</li>
                        <li>Planes de continuidad operativa y backups off-site.</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Accesos rápidos
          </CardTitle>
          <CardDescription>Enlaces útiles para continuar la gestión.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/admin">
            <Button variant="outline" className="bg-transparent">
              <Settings className="h-4 w-4 mr-2" />
              Ir a configuración general
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" className="bg-transparent">
              <BarChart3 className="h-4 w-4 mr-2" />
              Revisar indicadores
            </Button>
          </Link>
          <Link href="/docs/superadmin-api">
            <Button variant="outline" className="bg-transparent">
              <Shield className="h-4 w-4 mr-2" />
              Ver API para superadministrador
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function DocCard({
  title,
  href,
  icon,
  children,
}: {
  title: string
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-md border p-1">{icon}</span>
            {title}
          </CardTitle>
          <CardDescription>{children}</CardDescription>
        </CardHeader>
        <CardContent></CardContent>
      </Card>
    </Link>
  )
}
