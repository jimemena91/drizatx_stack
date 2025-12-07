// app/(app)/dashboard/queues/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useQueueStatus } from "@/hooks/use-queue-status";
import { useOperators } from "@/hooks/use-operators";
import { Status } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

import {
  ArrowLeft,
  Sun,
  Moon,
  Users,
  Clock,
  Activity,
  UserCheck,
  AlertTriangle,
  Download,
} from "lucide-react";

/** Base de API SIEMPRE incluyendo /api */
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${String(process.env.NEXT_PUBLIC_API_URL).replace(/\/$/, "")}/api`
  : "/api";

type ServiceDTO = {
  id: number | string;
  name: string;
  slaTarget?: number | null; // opcional
};

type OperatorDTO = {
  id: number;
  name: string;
  position?: string | null;
  active: boolean | number;
  currentTicket?: { id: number; number: string; status: number | string } | null;
  derivedStatus?: "AVAILABLE" | "CALLING" | "BUSY" | "OFFLINE";
  derivedStatusLabel?: string;
};

type StatsDTO = {
  range: "today" | "7d" | "30d";
  attended?: number;
  avgWait?: number;    // en minutos
  serviceLevel?: number; // %
  inProgress?: number;
  absent?: number;
};

function normalizeBool(v: any): boolean {
  return v === true || v === 1 || v === "1";
}

function deriveStatusLocal(op: OperatorDTO): OperatorDTO {
  const active = normalizeBool(op.active);
  const st = op.currentTicket?.status;
  let derived: OperatorDTO["derivedStatus"] = "AVAILABLE";
  if (!active) derived = "OFFLINE";
  else if (st === Status.IN_PROGRESS || st === "IN_PROGRESS") derived = "BUSY";
  else if (st === Status.CALLED || st === "CALLED") derived = "CALLING";
  const label =
    derived === "AVAILABLE" ? "Disponible" :
    derived === "CALLING"  ? "Llamando"   :
    derived === "BUSY"     ? "Atendiendo" : "Inactivo";
  return { ...op, derivedStatus: derived, derivedStatusLabel: label };
}

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const serviceId = params.id;
  const { theme, setTheme, systemTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark");

  // Fuentes de datos base
  const { getQueueStatus, refetch: refetchQueue } = useQueueStatus();
  const { getOperatorsWithStats } = useOperators();

  // Estado local
  const [service, setService] = useState<ServiceDTO | null>(null);
  const [statsRange, setStatsRange] = useState<StatsDTO["range"]>("today");
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [operators, setOperators] = useState<OperatorDTO[]>([]);
  const [statusSnapshot, setStatusSnapshot] = useState(getQueueStatus());
  const [searchOp, setSearchOp] = useState("");

  const refreshing = useRef(false);

  // ==== Carga inicial de snapshot del dashboard ====
  useEffect(() => {
    (async () => {
      const fresh = await refetchQueue();
      if (fresh) setStatusSnapshot(fresh);
    })();
  }, [refetchQueue]);

  // ==== Fetch Details con fallbacks ====
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      // 1) Servicio
      let srv: ServiceDTO | null = null;
      try {
        const r = await fetch(`${API_BASE}/services/${serviceId}`, { cache: "no-store" });
        if (r.ok) srv = await r.json();
      } catch {}
      if (!srv) {
        // fallback: intentar encontrarlo por snapshot
        const q = (statusSnapshot?.queues ?? []).find((x: any) => String(x.id) === String(serviceId));
        if (q) srv = { id: q.id, name: q.name };
      }
      if (!cancelled) setService(srv);

      // 2) Operadores asociados
      let ops: OperatorDTO[] = [];
      // (a) mejor caso: endpoint dedicado
      try {
        const r = await fetch(`${API_BASE}/services/${serviceId}/operators`, { cache: "no-store" });
        if (r.ok) {
          const arr = await r.json();
          if (Array.isArray(arr)) ops = arr.map((o: any) => deriveStatusLocal(o));
        }
      } catch {}
      // (b) fallback: cargar todos y filtrar si el backend expone servicios por operador
      if (ops.length === 0) {
        try {
          // Si tuvieras un endpoint /operators?serviceId=...
          const maybe = await fetch(`${API_BASE}/operators?serviceId=${serviceId}`, { cache: "no-store" });
          if (maybe.ok) {
            const arr = await maybe.json();
            if (Array.isArray(arr)) ops = arr.map((o: any) => deriveStatusLocal(o));
          }
        } catch {}
      }
      // (c) super-fallback: usar el snapshot de operadores del hook (si existiera)
      if (ops.length === 0) {
        const all = (getOperatorsWithStats?.() ?? []).map((o: any) => deriveStatusLocal(o));
        // Si no tenemos relación servicio-operador disponible, mostramos todos como referencia
        ops = all;
      }
      if (!cancelled) setOperators(ops);

      // 3) Stats por rango
      await loadStats(statsRange, cancelled);
    }

    async function loadStats(range: StatsDTO["range"], isCancelled: boolean) {
      let s: StatsDTO | null = null;
      try {
        const r = await fetch(`${API_BASE}/services/${serviceId}/stats?range=${range}`, { cache: "no-store" });
        if (r.ok) s = await r.json();
      } catch {}
      if (!s) {
        // fallback: aproximación con datos del snapshot del dashboard
        const q = (statusSnapshot?.queues ?? []).find((x: any) => String(x.id) === String(serviceId));
        s = {
          range,
          attended: statusSnapshot?.todayMetrics?.attendedToday ?? undefined,
          avgWait: q ? Number(String(q.averageTime).replace(/[^\d.]/g, "")) : undefined,
          serviceLevel: statusSnapshot?.todayMetrics?.serviceLevel ?? undefined,
          inProgress: (statusSnapshot?.nextTickets ?? []).filter((t: any) =>
            t.status === Status.IN_PROGRESS &&
            String(t?.service?.id ?? t?.serviceId) === String(serviceId),
          ).length,
          absent: (statusSnapshot?.absentTickets ?? []).filter((t: any) =>
            String(t?.service?.id ?? t?.serviceId) === String(serviceId),
          ).length,
        };
      }
      if (!isCancelled) setStats(s);
    }

    loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // Refresco periódico (5s) de stats (si existe endpoint) y snapshot
  useEffect(() => {
    const id = setInterval(async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const fresh = await refetchQueue();
        if (fresh) setStatusSnapshot(fresh);
        // refrescar stats para el rango activo
        try {
          const r = await fetch(`${API_BASE}/services/${serviceId}/stats?range=${statsRange}`, { cache: "no-store" });
          if (r.ok) {
            const s = await r.json();
            setStats(s);
          }
        } catch {}
      } finally {
        refreshing.current = false;
      }
    }, 5000);
    return () => clearInterval(id);
  }, [refetchQueue, serviceId, statsRange]);

  // Derivaciones
  const queueRow = useMemo(() => {
    return (statusSnapshot?.queues ?? []).find((x: any) => String(x.id) === String(serviceId));
  }, [statusSnapshot, serviceId]);

  const filteredOps = useMemo(() => {
    if (!searchOp.trim()) return operators;
    const needle = searchOp.toLowerCase();
    return operators.filter((o) => `${o.name}`.toLowerCase().includes(needle) || `${o.position ?? ""}`.toLowerCase().includes(needle));
  }, [operators, searchOp]);

  // Export básico de operadores
  function exportOpsCSV() {
    const rows = [
      ["id", "name", "position", "status", "ticket"],
      ...filteredOps.map((o) => [
        String(o.id),
        (o.name ?? "").replaceAll(",", " "),
        (o.position ?? "").replaceAll(",", " "),
        o.derivedStatusLabel ?? "",
        o.currentTicket?.number ? String(o.currentTicket.number) : "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-${serviceId}-operators.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/queues">
            <Button variant="ghost" className="px-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            Servicio: {service?.name ?? queueRow?.name ?? `#${serviceId}`}
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-input-background px-2 py-1">
          <Sun className="size-4 opacity-60" />
          <Switch
            aria-label="Cambiar tema"
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background"
          />
          <Moon className="size-4 opacity-60" />
        </div>
      </div>

      {/* Resumen del servicio */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">En cola</CardTitle>
            <CardDescription>Esperando atención</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {queueRow?.waitingCount ?? "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tiempo prom.</CardTitle>
            <CardDescription>Promedio de espera</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {queueRow?.averageTime ? `${queueRow.averageTime}` : (stats?.avgWait ? `${stats.avgWait} min` : "—")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Atendidos</CardTitle>
            <CardDescription>{statsRange === "today" ? "Hoy" : (statsRange === "7d" ? "Últimos 7 días" : "Últimos 30 días")}</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {typeof stats?.attended === "number" ? stats.attended : "—"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SLA</CardTitle>
            <CardDescription>Meta {service?.slaTarget ? `${service.slaTarget}%` : "—"}</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {typeof stats?.serviceLevel === "number" ? `${stats.serviceLevel}%` : "—"}
          </CardContent>
        </Card>
      </div>

      {/* Controles de rango y export */}
      <Card className="glass card-elev-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Métricas del servicio
          </CardTitle>
          <CardDescription>Seleccioná rango para KPIs; exportá la lista de operadores.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant={statsRange === "today" ? "default" : "outline"}
              onClick={() => setStatsRange("today")}
            >
              Hoy
            </Button>
            <Button
              variant={statsRange === "7d" ? "default" : "outline"}
              onClick={() => setStatsRange("7d")}
            >
              7 días
            </Button>
            <Button
              variant={statsRange === "30d" ? "default" : "outline"}
              onClick={() => setStatsRange("30d")}
            >
              30 días
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={exportOpsCSV}>
              <Download className="h-4 w-4 mr-1" /> Operadores (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Operadores asociados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Operadores
          </CardTitle>
          <CardDescription>Estado actual y turno, filtrá por nombre/puesto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              className="min-w-[260px]"
              placeholder="Buscar operador…"
              value={searchOp}
              onChange={(e) => setSearchOp(e.target.value)}
            />
            <Badge variant="secondary" className="border-0">
              {filteredOps.length} visibles
            </Badge>
          </div>

          <div className="space-y-3">
            {filteredOps.map((op) => {
              const derived = op.derivedStatus ?? deriveStatusLocal(op).derivedStatus;
              const lbl = op.derivedStatusLabel ?? deriveStatusLocal(op).derivedStatusLabel;
              const services = Array.isArray(op.services) ? op.services.filter(Boolean) : [];
              const serviceIds = Array.isArray(op.serviceIds) ? op.serviceIds : [];
              return (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card/70 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ background: "var(--gradient-3)" }}
                      title={op.name}
                    >
                      {(op.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{op.name}</p>
                      <p className="text-xs text-muted-foreground">{op.position ?? "—"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {services.length > 0 ? (
                          services.map((svc) => (
                            <Badge
                              key={`${op.id}-svc-${svc?.id ?? 'unknown'}`}
                              variant="outline"
                              className="border-border/40 px-2 py-0.5 text-[11px] font-medium"
                            >
                              {svc?.name ?? `Servicio #${svc?.id ?? ''}`}
                            </Badge>
                          ))
                        ) : serviceIds.length > 0 ? (
                          <Badge variant="outline" className="border-border/40 px-2 py-0.5 text-[11px] font-medium">
                            {serviceIds.length} servicio{serviceIds.length === 1 ? "" : "s"}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Sin servicios asignados</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        derived === "AVAILABLE"
                          ? "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-200 border-0 font-medium px-3 py-1 rounded-lg"
                          : derived === "CALLING"
                          ? "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-200 border-0 font-medium px-3 py-1 rounded-lg"
                          : derived === "BUSY"
                          ? "bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-200 border-0 font-medium px-3 py-1 rounded-lg"
                          : "bg-zinc-400/20 text-zinc-700 dark:bg-zinc-500/30 dark:text-zinc-200 border-0 font-medium px-3 py-1 rounded-lg"
                      }
                    >
                      {lbl}
                    </Badge>

                    {op.currentTicket ? (
                      <Badge
                        variant="secondary"
                        className="border-0 font-medium px-3 py-1 rounded-lg"
                        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                      >
                        Turno {op.currentTicket.number}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="border-0 font-medium px-3 py-1 rounded-lg"
                        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                      >
                        Libre
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredOps.length === 0 && (
              <div className="text-sm text-muted-foreground">No hay operadores para el criterio actual.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actividad reciente del servicio */}
      <Card className="group relative">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Actividad reciente
          </CardTitle>
          <CardDescription>Últimos tickets del servicio (si el endpoint está disponible).</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder: si tenés /api/services/:id/tickets?limit=20, podés listarlos aquí */}
          <div className="text-sm text-muted-foreground">
            — Próximamente: listado de tickets por servicio con estado/tiempo.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
