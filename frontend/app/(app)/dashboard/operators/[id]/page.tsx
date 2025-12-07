// app/(app)/dashboard/operators/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ArrowLeft, RotateCcw, Search } from "lucide-react";
import { Status } from "@/lib/types";
import { apiClient, ApiError, type OperatorAttentionMetrics, type OperatorShiftHistory } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return "—";
  const total = Math.max(0, Math.round(Number(seconds)));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}m ${String(secs).padStart(2, "0")}s`;
};

const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR", { hour12: false });
};

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { month: "short", day: "numeric" });
};

const formatShiftDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return "—";
  const total = Math.max(0, Math.round(Number(seconds)));
  if (total === 0) return "—";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m`;
};

const formatDateWithYear = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { year: "numeric", month: "short", day: "numeric" });
};

const STATUS_LABELS: Record<Status, string> = {
  [Status.WAITING]: "En espera",
  [Status.CALLED]: "Llamado",
  [Status.IN_PROGRESS]: "En atención",
  [Status.COMPLETED]: "Completado",
  [Status.CANCELLED]: "Anulado",
  [Status.ABSENT]: "Ausente",
};

const DEFAULT_HISTORY_STATUSES: Status[] = [
  Status.COMPLETED,
  Status.IN_PROGRESS,
  Status.CALLED,
  Status.CANCELLED,
];

const HISTORY_STATUS_OPTIONS: Array<{ key: Status; label: string }> = [
  { key: Status.COMPLETED, label: "Completados" },
  { key: Status.IN_PROGRESS, label: "En atención" },
  { key: Status.CALLED, label: "Llamados" },
  { key: Status.CANCELLED, label: "Anulados" },
  { key: Status.ABSENT, label: "Ausentes" },
];

const formatStatusLabel = (status: string): string => {
  const normalized = status as Status;
  return STATUS_LABELS[normalized] ?? status;
};

const getStatusBadgeVariant = (
  status: Status | string,
): "default" | "secondary" | "destructive" | "outline" | "muted" => {
  const normalized = status as Status;
  switch (normalized) {
    case Status.COMPLETED:
      return "secondary";
    case Status.CANCELLED:
      return "destructive";
    case Status.IN_PROGRESS:
      return "default";
    case Status.ABSENT:
      return "muted";
    case Status.CALLED:
      return "outline";
    default:
      return "outline";
  }
};

export default function OperatorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [op, setOp] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<OperatorAttentionMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [shiftHistory, setShiftHistory] = useState<OperatorShiftHistory | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shiftRange, setShiftRange] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [historyPeriod, setHistoryPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('week');
  const [historyStatuses, setHistoryStatuses] = useState<Status[]>(DEFAULT_HISTORY_STATUSES);
  const [historyServiceId, setHistoryServiceId] = useState<number | null>(null);
  const [historyLimit, setHistoryLimit] = useState<number>(50);
  const [historySearch, setHistorySearch] = useState("");
  const [loading, setLoading] = useState(true);

  const shiftRangeOptions = [
    { key: 'day' as const, label: 'Hoy' },
    { key: 'week' as const, label: 'Semana' },
    { key: 'month' as const, label: 'Mes' },
    { key: 'all' as const, label: 'Todo' },
  ];

  const historyPeriodOptions = [
    { key: 'day' as const, label: 'Hoy' },
    { key: 'week' as const, label: 'Semana' },
    { key: 'month' as const, label: 'Mes' },
    { key: 'year' as const, label: 'Año' },
    { key: 'all' as const, label: 'Todo' },
  ];

  const historyLimitOptions = [20, 50, 100];

  const handleToggleHistoryStatus = (status: Status) => {
    setHistoryStatuses((prev) => {
      const exists = prev.includes(status);
      if (exists) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== status);
      }
      return [...prev, status];
    });
  };

  const handleSelectAllHistoryStatuses = () => {
    setHistoryStatuses(HISTORY_STATUS_OPTIONS.map((option) => option.key));
  };

  const resetHistoryFilters = () => {
    setHistoryPeriod('week');
    setHistoryStatuses(DEFAULT_HISTORY_STATUSES);
    setHistoryServiceId(null);
    setHistoryLimit(50);
    setHistorySearch("");
  };

  const serviceLookup = useMemo(() => {
    const map = new Map<number, string>();
    services.forEach((service: any) => {
      if (service && typeof service.id === "number") {
        map.set(service.id, service.name ?? `Servicio #${service.id}`);
      }
    });
    return map;
  }, [services]);

  const filteredHistory = useMemo(() => {
    if (!metrics) return [];
    const term = historySearch.trim().toLowerCase();
    if (!term) return metrics.history;
    return metrics.history.filter((item) => {
      const haystack = `${item.ticketNumber ?? ''} ${item.serviceName ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [metrics, historySearch]);

  const appliedStatuses = metrics?.statuses?.length ? metrics.statuses : historyStatuses;

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    (async () => {
      try {
        try {
          const data = await apiClient.getOperatorWithStatus(id);
          setOp(data);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) { notFound(); return; }
          if (error instanceof ApiError && error.status === 403) {
            console.error("[operator-detail] acceso no autorizado", error.message);
            notFound();
            return;
          }
          throw error;
        }

        try {
          const payload = await apiClient.getOperatorServices(id);
          setServices(Array.isArray(payload?.services) ? payload.services : []);
        } catch (error) {
          console.error("[operator-detail] servicios no disponibles", error);
          setServices([]);
        }

      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    setShiftLoading(true);
    setShiftError(null);
    (async () => {
      try {
        const payload = await apiClient.getOperatorShiftHistory(id, { period: shiftRange });
        if (cancelled) return;
        setShiftHistory(payload);
      } catch (error) {
        if (cancelled) return;
        console.error("[operator-detail] turnos no disponibles", error);
        setShiftHistory(null);
        setShiftError("No se pudo cargar el historial de jornadas");
      } finally {
        if (!cancelled) {
          setShiftLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, shiftRange]);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    setMetricsLoading(true);
    setMetricsError(null);
    (async () => {
      try {
        const payload = await apiClient.getOperatorAttentionMetrics(id, {
          period: historyPeriod,
          statuses: historyStatuses,
          serviceId: historyServiceId ?? undefined,
          limit: historyLimit,
        });
        if (cancelled) return;
        setMetrics(payload);
      } catch (error) {
        if (cancelled) return;
        console.error("[operator-detail] métricas no disponibles", error);
        setMetrics(null);
        setMetricsError("No se pudieron cargar las métricas de atención");
      } finally {
        if (!cancelled) {
          setMetricsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, historyPeriod, historyStatuses, historyServiceId, historyLimit]);

  if (!Number.isFinite(id)) return notFound();
  if (loading) return <div>Cargando…</div>;
  if (!op) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{op.name}</h1>
          <p className="text-sm text-muted-foreground">{op.position ?? "—"} · {op.email ?? "—"}</p>
        </div>
        <Link href="/dashboard/operators">
          <Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Resumen
          </CardTitle>
          <CardDescription>Estado y turno actual (si aplica)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Usuario:</span>
            <span className="font-medium">{op.username ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estado:</span>
            <Badge variant="secondary">
              {op?.currentTicket?.status === Status.IN_PROGRESS ? "Atendiendo"
              : op?.currentTicket?.status === Status.CALLED ? "Llamando"
              : (op?.active ? "Disponible" : "Inactivo")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Turno actual:</span>
            <span className="font-medium">{op?.currentTicket ? op.currentTicket.number : "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indicadores de atención</CardTitle>
          <CardDescription>Promedios y alertas históricas del operador</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="text-sm text-muted-foreground">Actualizando métricas…</div>
          ) : metricsError ? (
            <div className="text-sm text-muted-foreground">{metricsError}</div>
          ) : metrics ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs uppercase text-muted-foreground">Promedio de atención</p>
                <p className="text-lg font-semibold">{formatDuration(metrics.averageAttentionSeconds)}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs uppercase text-muted-foreground">Tickets completados</p>
                <p className="text-lg font-semibold">{metrics.totalCompleted}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs uppercase text-muted-foreground">Fuera de tiempo</p>
                <p className="text-lg font-semibold">{metrics.exceededCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs uppercase text-muted-foreground">Registros visibles</p>
                <p className="text-lg font-semibold">{metrics.history.length}</p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sin métricas registradas.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jornadas laborales</CardTitle>
          <CardDescription>Registros de inicio y fin de jornada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {shiftRangeOptions.map((option) => (
              <Button
                key={option.key}
                size="sm"
                variant={shiftRange === option.key ? "default" : "outline"}
                onClick={() => setShiftRange(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {shiftLoading ? (
            <div className="text-sm text-muted-foreground">Cargando jornadas…</div>
          ) : shiftError ? (
            <div className="text-sm text-muted-foreground">{shiftError}</div>
          ) : shiftHistory && shiftHistory.shifts.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Días trabajados</p>
                  <p className="text-lg font-semibold">{shiftHistory.daysWorked}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Jornadas registradas</p>
                  <p className="text-lg font-semibold">{shiftHistory.totalShifts}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Horas totales</p>
                  <p className="text-lg font-semibold">{formatShiftDuration(shiftHistory.totalDurationSeconds)}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Promedio jornada</p>
                  <p className="text-lg font-semibold">{formatShiftDuration(shiftHistory.averageDurationSeconds)}</p>
                </div>
              </div>

              {shiftHistory.from && shiftHistory.to && (
                <p className="text-xs text-muted-foreground">
                  Período: {formatDate(shiftHistory.from)} – {formatDate(shiftHistory.to)}
                </p>
              )}

              {shiftHistory.hasOpenShift && (
                <p className="text-xs text-amber-600">Hay una jornada en curso registrada.</p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Inicio</th>
                      <th className="py-2 pr-4">Fin</th>
                      <th className="py-2 pr-4">Duración</th>
                      <th className="py-2 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftHistory.shifts.map((shift) => {
                      const isOpen = shift.endedAt === null;
                      return (
                        <tr key={shift.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{formatDateTime(shift.startedAt)}</td>
                          <td className="py-2 pr-4">{shift.endedAt ? formatDateTime(shift.endedAt) : "En curso"}</td>
                          <td className="py-2 pr-4">{formatShiftDuration(shift.durationSeconds)}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={isOpen ? "default" : "secondary"}>
                              {isOpen ? "En curso" : "Finalizada"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No hay jornadas registradas para el período seleccionado.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Servicios asignados</CardTitle>
          <CardDescription>Servicios activos/inactivos del operador</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {services.length === 0 && <div className="text-sm text-muted-foreground">Sin servicios asignados</div>}
          {services.map((s: any) => (
            <Badge key={s.id} className={s.active ? "bg-green-500/20" : "bg-zinc-400/20"}>
              {s.name} {s.active ? "(Activo)" : "(Inactivo)"}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial reciente</CardTitle>
          <CardDescription>Últimos tickets atendidos y tiempos registrados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {historyPeriodOptions.map((option) => (
              <Button
                key={option.key}
                size="sm"
                variant={historyPeriod === option.key ? "default" : "outline"}
                onClick={() => setHistoryPeriod(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {HISTORY_STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.key}
                  size="sm"
                  variant={historyStatuses.includes(option.key) ? "default" : "outline"}
                  onClick={() => handleToggleHistoryStatus(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={handleSelectAllHistoryStatuses}>
              Todos
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={historyServiceId !== null ? String(historyServiceId) : "all"}
              onValueChange={(value) => setHistoryServiceId(value === "all" ? null : Number(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar servicio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los servicios</SelectItem>
                {services.map((service: any) => (
                  <SelectItem key={service.id} value={String(service.id)}>
                    {service.name ?? `Servicio #${service.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(historyLimit)}
              onValueChange={(value) => setHistoryLimit(Number(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Cantidad" />
              </SelectTrigger>
              <SelectContent>
                {historyLimitOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} registros
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Buscar turno o servicio"
                className="w-[220px] pl-8"
              />
            </div>

            <Button size="sm" variant="ghost" onClick={resetHistoryFilters}>
              <RotateCcw className="mr-1 h-4 w-4" /> Restablecer
            </Button>
          </div>

          {metrics && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {metrics.period === 'all' ? (
                <p>Período: Todo el historial</p>
              ) : (
                <p>
                  Período: {metrics.from ? formatDateWithYear(metrics.from) : "—"} – {metrics.to ? formatDateWithYear(metrics.to) : "—"}
                </p>
              )}
              {appliedStatuses.length > 0 && (
                <p>Estados: {appliedStatuses.map((status) => formatStatusLabel(status)).join(', ')}</p>
              )}
              {metrics.serviceId !== null && (
                <p>Servicio: {serviceLookup.get(metrics.serviceId) ?? `Servicio #${metrics.serviceId}`}</p>
              )}
            </div>
          )}

          {metricsLoading ? (
            <div className="text-sm text-muted-foreground">Actualizando historial…</div>
          ) : metricsError ? (
            <div className="text-sm text-muted-foreground">{metricsError}</div>
          ) : metrics ? (
            filteredHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Turno</th>
                      <th className="py-2 pr-4">Servicio</th>
                      <th className="py-2 pr-4">Estado</th>
                      <th className="py-2 pr-4">Duración</th>
                      <th className="py-2 pr-4">Máx.</th>
                      <th className="py-2 pr-4">Exceso</th>
                      <th className="py-2 pr-4">Inicio</th>
                      <th className="py-2 pr-4">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item) => {
                      const exceeded = (item.exceededSeconds ?? 0) > 0;
                      const rowClasses = cn(
                        "border-b last:border-0 transition-colors hover:bg-muted/40",
                        exceeded && "bg-destructive/10 hover:bg-destructive/20",
                        !exceeded && item.status === Status.CANCELLED && "bg-destructive/5",
                        !exceeded && item.status === Status.ABSENT && "bg-muted/30",
                      );
                      return (
                        <tr
                          key={`${item.ticketId}-${item.startedAt ?? item.completedAt ?? "current"}`}
                          className={rowClasses}
                        >
                          <td className="py-2 pr-4 font-medium">{item.ticketNumber}</td>
                          <td className="py-2 pr-4">{item.serviceName}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={getStatusBadgeVariant(item.status)}>
                              {formatStatusLabel(item.status)}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">{formatDuration(item.attentionSeconds)}</td>
                          <td className="py-2 pr-4">{item.maxAttentionTime ? `${item.maxAttentionTime} min` : "—"}</td>
                          <td className="py-2 pr-4">{exceeded ? formatDuration(item.exceededSeconds) : "—"}</td>
                          <td className="py-2 pr-4">{formatDateTime(item.startedAt)}</td>
                          <td className="py-2 pr-4">{formatDateTime(item.completedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No hay registros que coincidan con los filtros aplicados.
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">Sin historial reciente.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
