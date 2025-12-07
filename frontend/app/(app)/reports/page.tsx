"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Users, Clock, Target, Download, Calendar, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// === NUEVO: hook conectado a backend /reports
import { useReports, type ReportsFilters } from "@/hooks/use-reports";

// Conservamos tus hooks actuales para otras tabs (los cableamos en el próximo paso)
import { useQueueStatus } from "@/hooks/use-queue-status";
import { useTickets } from "@/hooks/use-tickets";
import { useServices } from "@/hooks/use-services";
import { useOperators } from "@/hooks/use-operators";

const DEFAULT_TZ: ReportsFilters["tz"] = "America/Argentina/Mendoza";

const TIMEZONE_OPTIONS: Array<{ value: Exclude<ReportsFilters["tz"], undefined>; label: string }> = [
  { value: "America/Argentina/Mendoza", label: "Argentina (GMT-3)" },
  { value: "UTC", label: "UTC" },
];

function parseBucketDate(bucket: string) {
  const parsed = new Date(bucket);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function prettifyLabel(label: string) {
  if (!label) return label;
  const cleaned = label.replace(/\.$/, "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function createDefaultFilters(
  granularity: ReportsFilters["granularity"] = "hour",
  tz: ReportsFilters["tz"] = DEFAULT_TZ,
): ReportsFilters {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return {
    from: start.toISOString(),
    to: now.toISOString(),
    granularity,
    tz,
  };
}

function formatDateForInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function parseDateInput(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export default function ReportsPage() {
  // ===== Filtros globales del reporte (período / granularidad)
  const [filters, setFilters] = useState<ReportsFilters>(() => createDefaultFilters("hour"));
  const [showFilters, setShowFilters] = useState(false);

  // ===== API real de reportes
  const { getSummary, getThroughput, exportCsv, exportXlsx } = useReports();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getSummary>> | null>(null);
  const [throughput, setThroughput] = useState<Awaited<ReturnType<typeof getThroughput>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("es-AR"), []);
  const percentFormatter = useMemo(
    () => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }),
    [],
  );
  const decimalFormatter = useMemo(
    () => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }),
    [],
  );
  const hourFormatter = useMemo(
    () => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }),
    [],
  );
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
    [],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [],
  );

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [s, t] = await Promise.all([getSummary(filters), getThroughput(filters)]);
        if (!aborted) {
          setSummary(s);
          setThroughput(t);
        }
      } catch (e: any) {
        if (!aborted) setError(e?.message ?? "Error al cargar reportes");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [getSummary, getThroughput, filters]);

  const chartData = useMemo(() => {
    return throughput.map((row) => {
      const date = parseBucketDate(row.bucket);
      const label =
        filters.granularity === "hour"
          ? date
            ? prettifyLabel(hourFormatter.format(date))
            : row.bucket.slice(11, 16)
          : date
            ? prettifyLabel(dayFormatter.format(date))
            : row.bucket.slice(0, 10);

      return {
        label,
        tickets: row.attended,
        avgWaitMin:
          row.avgWaitSec != null
            ? Number((row.avgWaitSec / 60).toFixed(1))
            : null,
        date,
        waitSumSec: row.avgWaitSec != null ? row.avgWaitSec * row.attended : 0,
        waitSamples: row.avgWaitSec != null ? row.attended : 0,
      };
    });
  }, [throughput, filters.granularity, hourFormatter, dayFormatter]);

  const hasChartData = chartData.length > 0;

  const dailyAggregates = useMemo(() => {
    const map = new Map<
      string,
      { date: Date | null; tickets: number; waitSumSec: number; waitSamples: number }
    >();

    chartData.forEach((item) => {
      const date = item.date;
      const key = date ? date.toISOString().slice(0, 10) : item.label;
      const current =
        map.get(key) ??
        { date, tickets: 0, waitSumSec: 0, waitSamples: 0 };

      current.tickets += item.tickets;
      current.waitSumSec += item.waitSumSec;
      current.waitSamples += item.waitSamples;
      if (!current.date && date) current.date = date;

      map.set(key, current);
    });

    return Array.from(map.entries())
      .map(([key, value]) => ({
        key,
        date: value.date,
        tickets: value.tickets,
        waitSumSec: value.waitSumSec,
        waitSamples: value.waitSamples,
        avgWaitMin:
          value.waitSamples > 0
            ? Number(((value.waitSumSec / value.waitSamples) / 60).toFixed(1))
            : null,
      }))
      .sort((a, b) => {
        const aTime = a.date?.getTime() ?? 0;
        const bTime = b.date?.getTime() ?? 0;
        return aTime - bTime;
      });
  }, [chartData]);

  const weeklySeries = useMemo(() => {
    const lastSeven = dailyAggregates.slice(-7);
    return lastSeven.map((item) => {
      const label = item.date ? prettifyLabel(dayFormatter.format(item.date)) : item.key;
      return {
        label,
        tickets: item.tickets,
        avgWaitMin: item.avgWaitMin,
        waitSumSec: item.waitSumSec,
        waitSamples: item.waitSamples,
      };
    });
  }, [dailyAggregates, dayFormatter]);

  const weeklyStats = useMemo(() => {
    if (!weeklySeries.length) return null;
    return weeklySeries.reduce(
      (acc, item) => {
        acc.totalTickets += item.tickets;
        acc.waitSumSec += item.waitSumSec;
        acc.waitSamples += item.waitSamples;
        if (!acc.peakDay || item.tickets > acc.peakDay.tickets) acc.peakDay = item;
        return acc;
      },
      {
        totalTickets: 0,
        waitSumSec: 0,
        waitSamples: 0,
        peakDay: null as (typeof weeklySeries)[number] | null,
      },
    );
  }, [weeklySeries]);

  const weeklyAverageWait =
    weeklyStats && weeklyStats.waitSamples > 0
      ? Number(((weeklyStats.waitSumSec / weeklyStats.waitSamples) / 60).toFixed(1))
      : null;

  const peakDayLabel = weeklyStats?.peakDay?.label ?? null;
  const peakDayTickets = weeklyStats?.peakDay?.tickets ?? 0;
  const peakDayAvgWait = weeklyStats?.peakDay?.avgWaitMin ?? null;
  const hasWeeklyData = weeklySeries.length > 0;

  // ===== KPIs desde summary
  const kpis = {
    attended: summary?.totals.attended ?? 0,
    total: summary?.totals.total ?? 0,
    averageWaitMin:
      summary?.kpis.tmeSec != null
        ? Math.round(summary.kpis.tmeSec / 60)
        : null,
    serviceLevel: summary?.kpis.slaPct ?? null,
    totalInQueue: summary?.kpis.totalInQueue ?? null,
    peakBucket: summary?.kpis.peakBucket ?? null,
  };

  const peakTimeLabel = useMemo(() => {
    if (!kpis.peakBucket) return "-";
    const parsed = parseBucketDate(kpis.peakBucket);
    if (!parsed) return "-";
    return prettifyLabel(hourFormatter.format(parsed));
  }, [kpis.peakBucket, hourFormatter]);

  const operatorMetrics = summary?.operators ?? [];
  const formatSecondsAsDuration = (seconds: number | null | undefined) => {
    if (seconds == null) return "N/D";
    const minutes = seconds / 60;
    if (minutes >= 1) return `${decimalFormatter.format(minutes)} min`;
    return `${decimalFormatter.format(seconds)} s`;
  };
  const formatPercentage = (value: number | null | undefined) => {
    if (value == null) return "N/D";
    return `${percentFormatter.format(value)}%`;
  };
  const formatTicketsPerHour = (value: number | null | undefined) => {
    if (value == null) return "N/D";
    return decimalFormatter.format(value);
  };
  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "Sin datos";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Sin datos";
    return dateTimeFormatter.format(parsed);
  };
  const hasOperatorMetrics = operatorMetrics.length > 0;

  // ===== Export (usa los mismos filtros visibles)
  const handleExportCsv = () => exportCsv(filters);
  const handleExportXlsx = () => exportXlsx(filters);

  // ===== Legacy (mantenemos para tabs Semanal/Servicios/Operadores y los cableamos luego)
  const { getQueueStatus } = useQueueStatus();
  const { getTicketsWithRelations } = useTickets();
  const { services } = useServices({ requireAuth: true });
  const { operators } = useOperators();

  const [queueStatus, setQueueStatus] = useState(getQueueStatus());
  const [allTickets, setAllTickets] = useState(getTicketsWithRelations());

  useEffect(() => {
    const initialStatus = getQueueStatus();
    const initialTickets = getTicketsWithRelations();
    setQueueStatus(initialStatus);
    setAllTickets(initialTickets);

    const interval = setInterval(() => {
      const qs = getQueueStatus();
      const tk = getTicketsWithRelations();
      setQueueStatus(qs);
      setAllTickets(tk);
    }, 30000);
    return () => clearInterval(interval);
  }, [getQueueStatus, getTicketsWithRelations]);

  const serviceData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTickets = allTickets.filter((t) => new Date(t.createdAt) >= today);
    const total = todayTickets.length;
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

    return services
      .map((service, index) => {
        const count = todayTickets.filter((t) => t.serviceId === service.id).length;
        if (count === 0) return null;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        return {
          name: service.name,
          value: Math.round(percentage),
          count,
          color: colors[index % colors.length],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [allTickets, services]);

  const hasServiceData = serviceData.length > 0;

  const activeServices = useMemo(() => services.filter((service) => service.active), [services]);

  return (
    <div className="flex-1 space-y-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reportes y Analytics</h1>
            <p className="text-gray-600">Análisis de desempeño y métricas operativas</p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-end w-full md:w-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-from-inline" className="text-xs uppercase text-muted-foreground">
                  Desde
                </Label>
                <Input
                  id="report-from-inline"
                  type="datetime-local"
                  value={formatDateForInput(filters.from)}
                  max={formatDateForInput(filters.to)}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      from: parseDateInput(event.target.value),
                    }))
                  }
                  className="sm:w-52"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-to-inline" className="text-xs uppercase text-muted-foreground">
                  Hasta
                </Label>
                <Input
                  id="report-to-inline"
                  type="datetime-local"
                  value={formatDateForInput(filters.to)}
                  min={formatDateForInput(filters.from)}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      to: parseDateInput(event.target.value),
                    }))
                  }
                  className="sm:w-52"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters((value) => !value)}>
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? "Ocultar filtros" : "Filtros"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setFilters((prev) =>
                    createDefaultFilters(prev.granularity ?? "hour", prev.tz ?? DEFAULT_TZ),
                  )
                }
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters((f) => ({
                    ...f,
                    granularity: f.granularity === "hour" ? "day" : "hour",
                  }));
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Período ({filters.granularity === "hour" ? "Hora" : "Día"})
              </Button>

              <Button variant="outline" onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button onClick={handleExportXlsx}>
                <Download className="h-4 w-4 mr-2" />
                XLSX
              </Button>
            </div>
          </div>
        </div>

        {showFilters && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle>Filtros avanzados</CardTitle>
              <CardDescription>Segmentá el análisis por servicio, operador o zona horaria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="report-service">Servicio</Label>
                  <Select
                    value={filters.serviceId ? String(filters.serviceId) : "all"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        serviceId: value === "all" ? undefined : Number(value),
                      }))
                    }
                  >
                    <SelectTrigger id="report-service">
                      <SelectValue placeholder="Todos los servicios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {activeServices.map((service) => (
                        <SelectItem key={service.id} value={String(service.id)}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-operator">Operador</Label>
                  <Select
                    value={filters.operatorId ? String(filters.operatorId) : "all"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        operatorId: value === "all" ? undefined : Number(value),
                      }))
                    }
                  >
                    <SelectTrigger id="report-operator">
                      <SelectValue placeholder="Todos los operadores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {operators.map((operator) => (
                        <SelectItem key={operator.id} value={String(operator.id)}>
                          {operator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-tz">Zona horaria</Label>
                  <Select
                    value={(filters.tz ?? DEFAULT_TZ) as string}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        tz: value as ReportsFilters["tz"],
                      }))
                    }
                  >
                    <SelectTrigger id="report-tz">
                      <SelectValue placeholder="Zona horaria" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="report-ticket-from">Ticket desde</Label>
                  <Input
                    id="report-ticket-from"
                    type="number"
                    placeholder="Número mínimo"
                    value={filters.ticketNumberFrom ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        ticketNumberFrom:
                          event.target.value === ""
                            ? undefined
                            : Number.isNaN(Number(event.target.value))
                              ? prev.ticketNumberFrom
                              : Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-ticket-to">Ticket hasta</Label>
                  <Input
                    id="report-ticket-to"
                    type="number"
                    placeholder="Número máximo"
                    value={filters.ticketNumberTo ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        ticketNumberTo:
                          event.target.value === ""
                            ? undefined
                            : Number.isNaN(Number(event.target.value))
                              ? prev.ticketNumberTo
                              : Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="self-end flex gap-2 md:col-span-2 lg:col-span-4 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setFilters((prev) =>
                        createDefaultFilters(prev.granularity ?? "hour", prev.tz ?? DEFAULT_TZ),
                      )
                    }
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado */}
        {loading && <div className="text-sm text-muted-foreground">Cargando reportes…</div>}
        {error && <div className="text-sm text-red-600">Error: {error}</div>}

        {/* KPIs principales (desde backend) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Procesados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{numberFormatter.format(kpis.attended)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                Completados en el período
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpis.averageWaitMin != null ? `${kpis.averageWaitMin} min` : "N/D"}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                Espera promedio
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nivel de Servicio</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpis.serviceLevel != null
                  ? `${percentFormatter.format(kpis.serviceLevel)}%`
                  : "N/D"}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Badge
                  variant={kpis.serviceLevel != null && kpis.serviceLevel >= 90 ? "default" : "secondary"}
                  className="text-xs"
                >
                  Meta: 90%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Cola Ahora</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpis.totalInQueue != null ? numberFormatter.format(kpis.totalInQueue) : "N/D"}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Esperando atención</span>
                <span className="font-medium text-gray-500">Pico: {peakTimeLabel}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList>
            <TabsTrigger value="daily">Análisis Diario</TabsTrigger>
            <TabsTrigger value="weekly">Análisis Semanal</TabsTrigger>
            <TabsTrigger value="services">Por Servicios</TabsTrigger>
            <TabsTrigger value="operators">Operadores</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tickets por {filters.granularity === "hour" ? "Hora" : "Día"}</CardTitle>
                  <CardDescription>Distribución de turnos durante el período</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasChartData ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RBarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          formatter={(value: any, name) => {
                            if (name === "tickets") {
                              return [`${numberFormatter.format(value as number)} tickets`, "Tickets"];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label) => `Período: ${label}`}
                        />
                        <Bar dataKey="tickets" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </RBarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No hay datos para el período seleccionado.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tiempo de Espera por {filters.granularity === "hour" ? "Hora" : "Día"}</CardTitle>
                  <CardDescription>Evolución del tiempo promedio</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasChartData ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis allowDecimals />
                        <Tooltip
                          formatter={(value: any, name) => {
                            if (name === "avgWaitMin") {
                              return [
                                value != null ? `${value as number} min` : "Sin datos",
                                "Espera promedio",
                              ];
                            }
                            if (name === "tickets") {
                              return [`${numberFormatter.format(value as number)} tickets`, "Tickets"];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label) => `Período: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="avgWaitMin"
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No hay datos para el período seleccionado.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resumen del Período</CardTitle>
                <CardDescription>Métricas principales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {numberFormatter.format(kpis.total)}
                    </div>
                    <p className="text-gray-600">Total de Turnos</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">{peakTimeLabel}</div>
                    <p className="text-gray-600">Hora Pico</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {numberFormatter.format(kpis.attended)}
                    </div>
                    <p className="text-gray-600">Atendidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-6">
            {hasWeeklyData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Tickets completados (7 días)</CardTitle>
                      <CardDescription>Suma de atenciones cerradas en la última semana</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {numberFormatter.format(weeklyStats?.totalTickets ?? 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">Incluye todos los servicios</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Espera promedio semanal</CardTitle>
                      <CardDescription>Tiempo desde la creación hasta la atención</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {weeklyAverageWait != null ? `${weeklyAverageWait} min` : "N/D"}
                      </div>
                      <p className="text-xs text-muted-foreground">Promedio ponderado por tickets atendidos</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Día con mayor demanda</CardTitle>
                      <CardDescription>Balde de tiempo con más tickets completados</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{peakDayLabel ?? "Sin datos"}</div>
                      <p className="text-xs text-muted-foreground">
                        {peakDayTickets > 0
                          ? `${numberFormatter.format(peakDayTickets)} tickets${
                              peakDayAvgWait != null ? ` · ${peakDayAvgWait} min promedio` : ""
                            }`
                          : "Aún no hay suficientes datos"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tickets completados por día</CardTitle>
                      <CardDescription>Comparativo de los últimos 7 días</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <RBarChart data={weeklySeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <Tooltip
                            formatter={(value: any, name) => {
                              if (name === "tickets") {
                                return [`${numberFormatter.format(value as number)} tickets`, "Tickets"];
                              }
                              return [value, name];
                            }}
                            labelFormatter={(label) => `Día: ${label}`}
                          />
                          <Bar dataKey="tickets" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </RBarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Espera promedio por día</CardTitle>
                      <CardDescription>Evolución diaria del tiempo de espera</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={weeklySeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals />
                          <Tooltip
                            formatter={(value: any, name) => {
                              if (name === "avgWaitMin") {
                                return [
                                  value != null ? `${value as number} min` : "Sin datos",
                                  "Espera promedio",
                                ];
                              }
                              return [value, name];
                            }}
                            labelFormatter={(label) => `Día: ${label}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="avgWaitMin"
                            stroke="#6366F1"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <p className="text-sm text-muted-foreground text-center">
                    No se registran tickets completados en los últimos días para generar estadísticas semanales.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Servicios</CardTitle>
                  <CardDescription>Porcentaje de tickets por tipo de servicio</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasServiceData ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={serviceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name} ${value}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {serviceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name) => {
                            if (name === "value") {
                              return [`${value as number}%`, "Participación"];
                            }
                            if (name === "count") {
                              return [`${numberFormatter.format(value as number)} tickets`, "Tickets"];
                            }
                            return [value, name];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      No hay tickets registrados para los servicios seleccionados.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Métricas por Servicio</CardTitle>
                  <CardDescription>Desempeño detallado por tipo de atención</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasServiceData ? (
                    <div className="space-y-4">
                      {serviceData.map((service) => {
                        const serviceInfo = services.find((s) => s.name === service.name);
                        const serviceStats = queueStatus.queues.find((q) => q.name === service.name);
                        const averageTimeRaw =
                          serviceStats?.averageTime ?? serviceInfo?.estimatedTime ?? null;
                        const averageTime =
                          typeof averageTimeRaw === "number" && !Number.isNaN(averageTimeRaw)
                            ? averageTimeRaw
                            : null;

                        return (
                          <div
                            key={service.name}
                            className="flex flex-col gap-4 border rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: service.color }} />
                              <div>
                                <h3 className="font-medium">{service.name}</h3>
                                <p className="text-sm text-gray-600">{service.value}% del total</p>
                              </div>
                            </div>
                            <div className="text-left sm:text-right">
                              <div className="font-bold">
                                {numberFormatter.format(service.count)} tickets
                              </div>
                              <div className="text-sm text-gray-600">
                                {averageTime != null ? `${averageTime} min promedio` : "Sin datos de tiempo"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay servicios con actividad en el período.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="operators" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Desempeño de Operadores</CardTitle>
                <CardDescription>Métricas individuales de productividad</CardDescription>
              </CardHeader>
              <CardContent>
                {hasOperatorMetrics ? (
                  <div className="space-y-4">
                    {operatorMetrics.map((operator) => {
                      const roleLabel =
                        operator.role === "SUPERVISOR"
                          ? "Supervisor"
                          : operator.role === "ADMIN"
                            ? "Administrador"
                            : operator.role === "SUPERADMIN"
                              ? "Superadmin"
                              : "Operador";
                      const badgeVariant = operator.role === "SUPERVISOR" ? "default" : "secondary";
                      const firstActivityLabel = operator.firstActivityAt ? formatDateTime(operator.firstActivityAt) : null;
                      const lastActivityLabel = operator.lastActivityAt ? formatDateTime(operator.lastActivityAt) : null;
                      const periodLabel = firstActivityLabel && lastActivityLabel
                        ? `${firstActivityLabel} → ${lastActivityLabel}`
                        : lastActivityLabel ?? firstActivityLabel ?? "Sin datos";

                      return (
                        <div
                          key={operator.operatorId}
                          className="flex flex-col gap-4 border rounded-lg p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${operator.active ? "bg-green-500" : "bg-gray-400"}`} />
                              <div>
                                <h3 className="font-medium">{operator.name}</h3>
                                <p className="text-sm text-gray-600">{operator.position ?? "Sin cargo"}</p>
                                <Badge variant={badgeVariant} className="text-xs mt-1 uppercase">
                                  {roleLabel}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>
                                Asignados: {" "}
                                <span className="font-medium text-gray-900">
                                  {numberFormatter.format(operator.totalTickets)}
                                </span>
                              </span>
                              <span>
                                Completados: {" "}
                                <span className="font-medium text-gray-900">
                                  {numberFormatter.format(operator.completedTickets)}
                                </span>
                              </span>
                              <span>
                                Servicios: {" "}
                                <span className="font-medium text-gray-900">
                                  {numberFormatter.format(operator.serviceCount)}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-3 xl:grid-cols-6">
                            <div>
                              <div className="font-bold">{formatPercentage(operator.attendanceRatePct)}</div>
                              <div className="text-xs text-gray-600">Tasa finalización</div>
                            </div>
                            <div>
                              <div className="font-bold">{formatSecondsAsDuration(operator.avgWaitSec)}</div>
                              <div className="text-xs text-gray-600">Espera prom.</div>
                            </div>
                            <div>
                              <div className="font-bold">{formatSecondsAsDuration(operator.avgHandleSec)}</div>
                              <div className="text-xs text-gray-600">Atención prom.</div>
                            </div>
                            <div>
                              <div className="font-bold">{formatSecondsAsDuration(operator.avgLeadSec)}</div>
                              <div className="text-xs text-gray-600">Ciclo total</div>
                            </div>
                            <div>
                              <div className="font-bold">{formatTicketsPerHour(operator.throughputPerHour)}</div>
                              <div className="text-xs text-gray-600">Tickets por hora</div>
                            </div>
                            <div>
                              <div className="font-bold">{formatPercentage(operator.occupancyPct)}</div>
                              <div className="text-xs text-gray-600">Ocupación</div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                            <span>Período: {periodLabel}</span>
                            <span>
                              Cancelados: {" "}
                              <span className="font-medium text-gray-900">
                                {numberFormatter.format(operator.cancelledTickets)}
                              </span>
                              {" · "}
                              Abandonados: {" "}
                              <span className="font-medium text-gray-900">
                                {numberFormatter.format(operator.abandonedTickets)}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No hay operadores con actividad durante el período seleccionado.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
