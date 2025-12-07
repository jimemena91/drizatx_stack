"use client"

import { useEffect, useMemo, useState, type ComponentProps } from "react"

import { PermissionGuard } from "@/components/permission-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useAuditLogs } from "@/hooks/use-audit-logs"
import { apiClient, ApiError } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import type { AuditLogRecord, AuditLogSeverity } from "@/lib/types"
import {
  AlertTriangle,
  Download,
  Filter,
  History,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

const severityMeta: Record<
  AuditLogSeverity,
  { label: string; badgeVariant: ComponentProps<typeof Badge>["variant"]; dotClass: string }
> = {
  low: {
    label: "Baja",
    badgeVariant: "muted",
    dotClass: "bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]",
  },
  medium: {
    label: "Media",
    badgeVariant: "secondary",
    dotClass: "bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.2)]",
  },
  high: {
    label: "Alta",
    badgeVariant: "default",
    dotClass: "bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.22)]",
  },
  critical: {
    label: "Crítica",
    badgeVariant: "destructive",
    dotClass: "bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.24)]",
  },
}

type SeverityFilter = "all" | AuditLogSeverity

const severityOptions: Array<{ value: SeverityFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "critical", label: "Crítica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
]

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
  })
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    dateStyle: "full",
  })
}

function formatChangeValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "Sin valor"
  if (typeof value === "boolean") return value ? "Sí" : "No"
  return String(value)
}

function buildActorLabel(event: AuditLogRecord): string {
  const identifier = typeof event.metadata?.identifier === "string" ? event.metadata.identifier : null
  if (event.actor?.name) {
    const parts = [event.actor.name]
    if (event.actor.email) parts.push(`(${event.actor.email})`)
    else if (event.actor.username) parts.push(`(${event.actor.username})`)
    return parts.join(" ")
  }
  if (identifier) return identifier
  return "Usuario no identificado"
}

export default function AuditPage() {
  const [severity, setSeverity] = useState<SeverityFilter>("all")
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [exporting, setExporting] = useState(false)

  const { toast } = useToast()

  const { apiEnabled, records, meta, loading, error, fetch } = useAuditLogs({ auto: false })

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [severity, debouncedQuery])

  useEffect(() => {
    if (!apiEnabled) return
    const controller = new AbortController()
    fetch(
      {
        page,
        limit: pageSize,
        severity: severity === "all" ? undefined : severity,
        search: debouncedQuery || undefined,
      },
      { signal: controller.signal },
    ).catch(err => {
      if (err instanceof ApiError) {
        toast({
          title: "No se pudieron cargar los registros",
          description: err.message,
          variant: "destructive",
        })
      }
    })
    return () => controller.abort()
  }, [apiEnabled, fetch, page, pageSize, severity, debouncedQuery, toast])

  useEffect(() => {
    if (!meta) return
    if (page > meta.pageCount) {
      setPage(meta.pageCount)
    }
  }, [meta, page])

  const totals = useMemo(() => {
    const base: Record<AuditLogSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    return {
      total: meta?.total ?? 0,
      filtered: meta?.filtered ?? records.length,
      visible: records.length,
      actorsTotal: meta?.actorTotals?.total ?? 0,
      actorsFiltered: meta?.actorTotals?.filtered ?? 0,
      bySeverityAll: { ...base, ...(meta?.severityTotalsAll ?? {}) },
      bySeverityFiltered: { ...base, ...(meta?.severityTotals ?? {}) },
    }
  }, [meta, records.length])

  const sortedEvents = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [records],
  )

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, AuditLogRecord[]>()
    for (const event of sortedEvents) {
      const key = formatDay(event.timestamp)
      const bucket = groups.get(key)
      if (bucket) {
        bucket.push(event)
      } else {
        groups.set(key, [event])
      }
    }
    return Array.from(groups.entries())
  }, [sortedEvents])

  const handleResetFilters = () => {
    setSeverity("all")
    setQuery("")
    setPage(1)
  }

  const handleExportCsv = async () => {
    if (!apiEnabled) {
      toast({
        title: "Modo sin API",
        description: "Activá la API para poder exportar los registros de auditoría.",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      const aggregated: AuditLogRecord[] = []
      let nextPage = 1
      let hasNext = true

      while (hasNext) {
        const response = await apiClient.getAuditLogs(
          {
            page: nextPage,
            limit: 250,
            severity: severity === "all" ? undefined : severity,
            search: debouncedQuery || undefined,
          },
          { timeoutMs: 60000 },
        )
        aggregated.push(...response.data)
        hasNext = response.meta.hasNext
        nextPage += 1
        if (nextPage > 200) {
          hasNext = false
        }
      }

      if (aggregated.length === 0) {
        toast({
          title: "Sin datos para exportar",
          description: "No hay registros que coincidan con los filtros actuales.",
        })
        return
      }

      const headers = [
        "timestamp",
        "actor",
        "role",
        "action",
        "target",
        "description",
        "severity",
        "ip",
        "source",
        "tags",
      ]
      const rows = aggregated.map(event => {
        const actorLabel = buildActorLabel(event)
        const role = event.actor?.role ?? ""
        const tags = (event.tags ?? []).join("|")
        const description = (event.description ?? "").replace(/\n+/g, " ").trim()
        const cells = [
          event.timestamp,
          actorLabel,
          role,
          event.action,
          event.target ?? "",
          description,
          event.severity,
          event.ip ?? "",
          event.source ?? "",
          tags,
        ]
        return cells.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      })

      const csvContent = [headers.join(","), ...rows].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)

      toast({
        title: "CSV generado",
        description: `Se exportaron ${aggregated.length} eventos de auditoría.`,
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo exportar la auditoría."
      toast({ title: "Error al exportar", description: message, variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const criticalCount = totals.bySeverityFiltered.critical ?? 0
  const highCount = totals.bySeverityFiltered.high ?? 0
  const actorsCount = totals.actorsFiltered || totals.actorsTotal

  return (
    <div className="flex-1 space-y-6">
      <PermissionGuard permission="view_system_logs" showError>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">Auditoría del sistema</h1>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Usá este panel para seguir qué cambios se realizaron, por quién y desde dónde, y así reaccionar rápido ante
                    incidentes o validar tareas críticas.
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportCsv}
              disabled={!apiEnabled || exporting || loading}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Generando CSV..." : "Exportar CSV"}
            </Button>
          </div>

          {!apiEnabled && (
            <Alert variant="accent">
              <AlertTitle>API deshabilitada</AlertTitle>
              <AlertDescription>
                Configurá las variables <code className="font-mono text-xs">NEXT_PUBLIC_API_MODE</code> y <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> para obtener los registros en tiempo real.
              </AlertDescription>
            </Alert>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error al cargar la auditoría</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="glass card-elev-1 border border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Eventos registrados</p>
                    <p className="text-2xl font-semibold text-foreground">{totals.total}</p>
                  </div>
                  <History className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {apiEnabled
                    ? `Hay ${totals.filtered} eventos que coinciden con los filtros. Estás viendo ${totals.visible} en esta página.`
                    : "Activá la API para sincronizar los registros de auditoría."}
                </p>
              </CardContent>
            </Card>

            <Card className="glass card-elev-1 border border-destructive/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Alta criticidad</p>
                    <p className="text-2xl font-semibold text-foreground">{criticalCount + highCount}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {criticalCount} críticos · {highCount} alta prioridad. Priorizá estos sucesos para validar acciones urgentes o sospechosas.
                </p>
              </CardContent>
            </Card>

            <Card className="glass card-elev-1 border border-secondary/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Usuarios involucrados</p>
                    <p className="text-2xl font-semibold text-foreground">{actorsCount}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-secondary-foreground" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Identificá rápidamente quién intervino para poder contactarlo o seguir el flujo de trabajo.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass card-elev-1">
            <CardHeader>
              <CardTitle>Filtros y búsqueda</CardTitle>
              <CardDescription>Combiná la búsqueda libre con la severidad para localizar en segundos el registro que necesitás.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="audit-search">Buscar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="audit-search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={'Ej.: "Laura", "TOKEN", "10.10.0.9"'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audit-severity">Severidad</Label>
                <Select
                  value={severity}
                  onValueChange={value => setSeverity(value as SeverityFilter)}
                  disabled={loading}
                >
                  <SelectTrigger id="audit-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2 md:col-span-3">
                <Button type="button" variant="outline" className="gap-2" onClick={handleResetFilters} disabled={loading}>
                  <Filter className="h-4 w-4" />
                  Limpiar filtros
                </Button>
                <Badge variant="outline" className="ml-auto">
                  Mostrando {totals.visible} de {totals.filtered} eventos
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="glass card-elev-2">
            <CardHeader>
              <CardTitle>Línea de tiempo de auditoría</CardTitle>
              <CardDescription>Revisá los eventos ordenados por día para entender el contexto y seguir el hilo de cada cambio.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Spinner label="Cargando eventos de auditoría..." className="h-48" />
              ) : groupedEvents.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <History className="h-5 w-5" />
                  No se encontraron eventos para los filtros seleccionados.
                </div>
              ) : (
                <ScrollArea className="h-[520px] pr-4">
                  <div className="space-y-6">
                    {groupedEvents.map(([day, events]) => (
                      <div key={day} className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <History className="h-3.5 w-3.5" />
                          {day}
                        </div>
                        <div className="space-y-3">
                          {events.map(event => {
                            const metaInfo = severityMeta[event.severity]
                            const actorLabel = buildActorLabel(event)
                            const actorRole = event.actor?.role ?? null
                            const identifier = typeof event.metadata?.identifier === "string" ? event.metadata.identifier : null

                            return (
                              <div
                                key={`${event.id}-${event.timestamp}`}
                                className="relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur"
                              >
                                <span className={cn("absolute left-4 top-4 h-2.5 w-2.5 rounded-full", metaInfo.dotClass)} />
                                <div className="flex flex-wrap items-center gap-2 pl-6">
                                  <Badge variant={metaInfo.badgeVariant}>{metaInfo.label}</Badge>
                                  <span className="text-sm font-semibold text-foreground">{event.action}</span>
                                  <span className="text-xs text-muted-foreground">· {formatDateTime(event.timestamp)}</span>
                                </div>

                                <div className="mt-3 space-y-2 pl-6 text-sm text-muted-foreground">
                                  {event.description ? (
                                    <p className="leading-relaxed">{event.description}</p>
                                  ) : (
                                    <p className="leading-relaxed text-muted-foreground/80">
                                      Sin descripción registrada para este evento.
                                    </p>
                                  )}

                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                    <span className="font-medium text-foreground">{actorLabel}</span>
                                    {actorRole ? <span>Rol: {actorRole}</span> : null}
                                    {event.source ? <span>Origen: {event.source}</span> : null}
                                    {event.ip ? <span>IP: {event.ip}</span> : null}
                                    {event.target ? <span>Recurso: {event.target}</span> : null}
                                    {!event.actor?.name && identifier ? <span>Identificador: {identifier}</span> : null}
                                  </div>

                                  {event.tags && event.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {event.tags.map(tag => (
                                        <Badge key={`${event.id}-${tag}`} variant="outline" className="uppercase tracking-wide">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  {event.changes && event.changes.length > 0 && (
                                    <div className="rounded-lg border border-dashed border-border/60 bg-background/60 p-3 text-xs">
                                      <p className="mb-2 font-semibold text-foreground">Cambios registrados</p>
                                      <div className="space-y-2">
                                        {event.changes.map((change, index) => (
                                          <div
                                            key={`${event.id}-change-${index}`}
                                            className="flex flex-wrap items-center gap-2"
                                          >
                                            <span className="font-medium text-foreground">{change.field}:</span>
                                            {change.before !== undefined && change.before !== null && change.before !== "" ? (
                                              <>
                                                <span className="text-muted-foreground line-through decoration-destructive/60">
                                                  {formatChangeValue(change.before)}
                                                </span>
                                                <span className="text-muted-foreground">→</span>
                                              </>
                                            ) : (
                                              <span className="text-muted-foreground">Nuevo valor</span>
                                            )}
                                            <span className="font-medium text-foreground">{formatChangeValue(change.after)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Página {meta?.page ?? page} de {meta?.pageCount ?? 1}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={loading || !meta?.hasPrevious || page <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(prev => prev + 1)}
                    disabled={loading || !meta?.hasNext}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PermissionGuard>
    </div>
  )
}
