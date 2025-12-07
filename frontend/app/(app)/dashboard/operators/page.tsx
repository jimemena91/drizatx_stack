// app/(app)/dashboard/operators/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useOperators } from "@/hooks/use-operators";
import { useTickets } from "@/hooks/use-tickets";
import { useAttentionAlerts } from "@/hooks/use-attention-alerts";
import { useToast } from "@/components/toast-provider";
import { Status } from "@/lib/types";
import { apiClient, ApiError, type OperatorWithStatus, type AttentionAlert } from "@/lib/api-client";
import {
  Users,
  Search,
  Filter,
  Play,
  Square,
  UserX,
  RotateCcw,
  ArrowUpDown,
  Sun,
  Moon,
  Clock,
  AlertTriangle,
} from "lucide-react";

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
};

type OperatorDTO = {
  id: number;
  name: string;
  username?: string | null;
  email?: string | null;
  position?: string | null;
  role: string;
  active: boolean | number;
  currentTicket?: {
    id: number;
    number: string;
    status: number | string;
    startedAt?: string | null;
    calledAt?: string | null;
    service?: { id: number; name: string; maxAttentionTime?: number | null } | null;
    attentionDuration?: number | null;
  } | null;
  derivedStatus?: "AVAILABLE" | "CALLING" | "BUSY" | "OFFLINE";
  derivedStatusLabel?: string;
};

function deriveStatusLocal(op: OperatorDTO): OperatorDTO {
  const active = op.active === true || op.active === 1 || (op as any).active === "1";
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

export default function OperatorsIndexPage() {
  const { getOperatorsWithStats } = useOperators();
  const { callNextTicket, updateTicketStatus } = useTickets();

  // Tema
  const { theme, setTheme, systemTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark");

  // Estado
  const [operators, setOperators] = useState<OperatorDTO[]>(getOperatorsWithStats() ?? []);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<OperatorDTO["derivedStatus"] | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "status" | "position">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loadingOpId, setLoadingOpId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { addToast } = useToast();
  const refreshing = useRef(false);

  const handleNewAlert = useCallback(
    (alert: AttentionAlert) => {
      addToast({
        type: "warning",
        title: `Tiempo excedido en ${alert.serviceName}`,
        description: `Turno ${alert.ticketNumber} lleva ${formatDuration(alert.elapsedSeconds)} en atención`,
        duration: 8000,
      });
    },
    [addToast],
  );

  const {
    alerts: attentionAlerts,
    alertsByTicketId,
    refresh: refreshAttentionAlerts,
  } = useAttentionAlerts({ onNewAlert: handleNewAlert });

  const topAlert = attentionAlerts[0] ?? null;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void refreshAttentionAlerts();
  }, [refreshAttentionAlerts]);

  async function loadOperatorsNow() {
    try {
      const enriched = await apiClient.getOperatorsWithStatus();
      if (enriched.length > 0) {
        setOperators(enriched as OperatorWithStatus[]);
      } else {
        const fallback = await apiClient.getOperators();
        setOperators((fallback ?? []).map(o => deriveStatusLocal({ ...o, active: Boolean((o as any).active) })));
      }
      await refreshAttentionAlerts();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        console.error("[operators] loadOperatorsNow auth error:", e.message);
      } else {
        console.error("[operators] loadOperatorsNow error:", e);
      }
    }
  }

  useEffect(() => { void loadOperatorsNow(); }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (refreshing.current) return;
      refreshing.current = true;
      loadOperatorsNow().finally(() => { refreshing.current = false; });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const byText = (op: OperatorDTO) => {
      const hay = `${op.name ?? ""} ${op.username ?? ""} ${op.email ?? ""} ${op.position ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase().trim());
    };
    const byStatus = (op: OperatorDTO) => {
      if (statusFilter === "ALL") return true;
      const derived = op.derivedStatus ?? deriveStatusLocal(op).derivedStatus;
      return derived === statusFilter;
    };
    const sorted = [...operators].sort((a, b) => {
      const A = (a as any), B = (b as any);
      let va: string, vb: string;
      if (sortBy === "name") { va = (A.name ?? "").toLowerCase(); vb = (B.name ?? "").toLowerCase(); }
      else if (sortBy === "position") { va = (A.position ?? "").toLowerCase(); vb = (B.position ?? "").toLowerCase(); }
      else { // status
        va = (a.derivedStatus ?? deriveStatusLocal(a).derivedStatus ?? "").toString();
        vb = (b.derivedStatus ?? deriveStatusLocal(b).derivedStatus ?? "").toString();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted.filter(op => byText(op) && byStatus(op));
  }, [operators, q, statusFilter, sortBy, sortDir]);

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("asc"); }
  }

  async function fetchTicketStatus(ticketId: number) {
    try {
      const t = await apiClient.getTicket(ticketId);
      return (t?.status ?? null) as Status | null;
    } catch (error) {
      console.error("[operators] fetchTicketStatus error:", error);
      return null;
    }
  }

  async function handleCallNext(op: OperatorDTO) {
    const derived = op.derivedStatus ?? deriveStatusLocal(op).derivedStatus;
    if (derived !== "AVAILABLE") return;
    setLoadingOpId(op.id);
    try {
      // Si tenés un picker de servicio por operador, podés consultarlo aquí:
      const payload = await apiClient.getOperatorServices(op.id);
      const actives = (payload?.services ?? []).filter((s: any) => s.active === true || s.active === 1);
      const svcId = actives[0]?.id;
      if (!svcId) throw new Error("Operador sin servicios activos");

      await callNextTicket(op.id, Number(svcId));
      await loadOperatorsNow();
    } finally {
      setLoadingOpId(null);
    }
  }

  async function handleStartAttention(ticketId: number) {
    const serverStatus = await fetchTicketStatus(ticketId);
    if (serverStatus !== Status.CALLED) return;
    await updateTicketStatus(ticketId, Status.IN_PROGRESS);
    await loadOperatorsNow();
  }

  async function handleComplete(ticketId: number) {
    const serverStatus = await fetchTicketStatus(ticketId);
    if (serverStatus !== Status.IN_PROGRESS) return;
    await updateTicketStatus(ticketId, Status.COMPLETED);
    await loadOperatorsNow();
  }

  async function handleAbsent(ticketId: number) {
    const serverStatus = await fetchTicketStatus(ticketId);
    if (serverStatus !== Status.CALLED) return;
    await updateTicketStatus(ticketId, Status.ABSENT);
    await loadOperatorsNow();
  }

  async function handleReintegrate(ticketId: number) {
    const serverStatus = await fetchTicketStatus(ticketId);
    if (serverStatus !== Status.ABSENT) return;
    await updateTicketStatus(ticketId, Status.WAITING);
    await loadOperatorsNow();
  }

  type ActionTone = "primary" | "neutral" | "danger";

  const toneStyles: Record<ActionTone, { wrapper: string; icon: string }> = {
    primary: {
      wrapper:
        "border-primary/50 bg-primary/10 text-primary-foreground/90 hover:bg-primary/15 focus-visible:ring-primary/40",
      icon: "bg-primary text-primary-foreground",
    },
    neutral: {
      wrapper: "border-border/60 hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-primary/30",
      icon: "bg-muted text-muted-foreground",
    },
    danger: {
      wrapper:
        "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive/30",
      icon: "bg-destructive text-destructive-foreground",
    },
  };

  return (
    <div className="space-y-6">
      {topAlert && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Tiempo excedido en turno <span className="font-semibold">{topAlert.ticketNumber}</span>
            {topAlert.operatorName ? ` (${topAlert.operatorName})` : ""} · {formatDuration(topAlert.elapsedSeconds)}
            {topAlert.maxAttentionTime ? ` / ${topAlert.maxAttentionTime}m` : ""}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Operadores</h1>
          <p className="text-sm text-muted-foreground">
            Gestioná el estado y las acciones principales de cada operador en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-input-background/80 px-3 py-1.5 shadow-sm">
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

      <Card className="glass card-elev-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Listado de operadores
          </CardTitle>
          <CardDescription>Buscá por nombre, usuario, email o cargo. Filtrá por estado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 min-w-[260px]"
                placeholder="Buscar…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <Button variant="outline" onClick={() => setStatusFilter("ALL")} className={statusFilter==="ALL" ? "border-primary" : ""}>
              <Filter className="h-4 w-4 mr-1" /> Todos
            </Button>
            <Button variant="outline" onClick={() => setStatusFilter("AVAILABLE")} className={statusFilter==="AVAILABLE" ? "border-primary" : ""}>
              Disponibles
            </Button>
            <Button variant="outline" onClick={() => setStatusFilter("CALLING")} className={statusFilter==="CALLING" ? "border-primary" : ""}>
              Llamando
            </Button>
            <Button variant="outline" onClick={() => setStatusFilter("BUSY")} className={statusFilter==="BUSY" ? "border-primary" : ""}>
              Atendiendo
            </Button>
            <Button variant="outline" onClick={() => setStatusFilter("OFFLINE")} className={statusFilter==="OFFLINE" ? "border-primary" : ""}>
              Inactivos
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={() => toggleSort("name")}>
                <ArrowUpDown className="h-4 w-4 mr-1" /> Nombre
              </Button>
              <Button variant="ghost" onClick={() => toggleSort("position")}>
                <ArrowUpDown className="h-4 w-4 mr-1" /> Puesto
              </Button>
              <Button variant="ghost" onClick={() => toggleSort("status")}>
                <ArrowUpDown className="h-4 w-4 mr-1" /> Estado
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map(op => {
              const d = op.derivedStatus ?? deriveStatusLocal(op).derivedStatus;
              const label = op.derivedStatusLabel ?? deriveStatusLocal(op).derivedStatusLabel;

              const statusClass =
                d === "AVAILABLE"
                  ? "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-200"
                  : d === "CALLING"
                  ? "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-200"
                  : d === "BUSY"
                  ? "bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-200"
                  : "bg-zinc-400/20 text-zinc-700 dark:bg-zinc-500/30 dark:text-zinc-200";

              const ticketId = op.currentTicket?.id ? Number(op.currentTicket.id) : null;
              const alert = ticketId ? alertsByTicketId.get(ticketId) : undefined;
              const startIso = op.currentTicket?.startedAt ?? op.currentTicket?.calledAt ?? null;
              const startDate = startIso ? new Date(startIso) : null;

              let elapsedSeconds: number | null = null;
              if (alert) {
                elapsedSeconds = alert.elapsedSeconds;
              } else if (startDate) {
                elapsedSeconds = Math.max(0, Math.floor((now - startDate.getTime()) / 1000));
              }

              const maxAttentionTime = alert?.maxAttentionTime ?? op.currentTicket?.service?.maxAttentionTime ?? null;
              const limitSeconds = maxAttentionTime ? maxAttentionTime * 60 : null;
              const overLimit = Boolean(alert) || (limitSeconds !== null && elapsedSeconds !== null && elapsedSeconds > limitSeconds);
              const timerLabel = elapsedSeconds !== null ? formatDuration(elapsedSeconds) : null;

              const cardClass = [
                "rounded-xl border p-4 transition shadow-sm",
                overLimit
                  ? "border-destructive/60 bg-destructive/10 shadow-destructive/20"
                  : "border-border/50 bg-card/80 hover:border-primary/40",
              ].join(" ");

              type ActionItem =
                | {
                    key: string;
                    label: string;
                    description: string;
                    icon: ReactNode;
                    tone: ActionTone;
                    disabled?: boolean;
                    onClick: () => void;
                    type: "action";
                  }
                | {
                    key: string;
                    label: string;
                    description: string;
                    icon: ReactNode;
                    tone: ActionTone;
                    href: string;
                    type: "link";
                  };

              const actionItems: ActionItem[] = [
                {
                  key: "profile",
                  label: "Ver perfil",
                  description: "Detalles y métricas del operador",
                  icon: <Users className="h-4 w-4" />,
                  tone: "neutral",
                  href: `/dashboard/operators/${op.id}`,
                  type: "link",
                },
              ];

              if (!op.currentTicket && d === "AVAILABLE") {
                actionItems.push({
                  key: "call",
                  label: loadingOpId === op.id ? "Llamando..." : "Llamar siguiente",
                  description: "Asigná el próximo turno disponible",
                  icon: <Play className="h-4 w-4" />,
                  tone: "primary",
                  disabled: loadingOpId === op.id,
                  onClick: () => handleCallNext(op),
                  type: "action",
                });
              }

              if (op.currentTicket && op.currentTicket.status === Status.CALLED) {
                actionItems.push(
                  {
                    key: "start",
                    label: "Iniciar atención",
                    description: "Marcá el turno como en progreso",
                    icon: <Play className="h-4 w-4" />,
                    tone: "primary",
                    onClick: () => handleStartAttention(Number(op.currentTicket!.id)),
                    type: "action",
                  },
                  {
                    key: "absent",
                    label: "Marcar ausente",
                    description: "Registrar que la persona no se presentó",
                    icon: <UserX className="h-4 w-4" />,
                    tone: "danger",
                    onClick: () => handleAbsent(Number(op.currentTicket!.id)),
                    type: "action",
                  },
                );
              }

              if (op.currentTicket && op.currentTicket.status === Status.IN_PROGRESS) {
                actionItems.push({
                  key: "complete",
                  label: "Finalizar turno",
                  description: "Cerrá la atención en curso",
                  icon: <Square className="h-4 w-4" />,
                  tone: "neutral",
                  onClick: () => handleComplete(Number(op.currentTicket!.id)),
                  type: "action",
                });
              }

              if (op.currentTicket && op.currentTicket.status === Status.ABSENT) {
                actionItems.push({
                  key: "reintegrate",
                  label: "Reintegrar",
                  description: "Volvé a poner el turno en espera",
                  icon: <RotateCcw className="h-4 w-4" />,
                  tone: "neutral",
                  onClick: () => handleReintegrate(Number(op.currentTicket!.id)),
                  type: "action",
                });
              }

              return (
                <div key={op.id} className={cardClass}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground font-bold">
                      {(op.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-[160px] space-y-1">
                      <div className="font-semibold leading-tight">{op.name}</div>
                      <div className="text-xs text-muted-foreground leading-tight">
                        {op.position ?? "—"}
                        <span className="mx-1 text-border">•</span>
                        {op.email ?? "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`border-0 font-medium px-3 py-1 rounded-lg ${statusClass}`}>{label}</Badge>
                      {op.currentTicket ? (
                        <Badge variant="secondary" className="border-0 font-medium px-3 py-1 rounded-lg">
                          Turno {op.currentTicket.number}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border-0 font-medium px-3 py-1 rounded-lg">
                          Libre
                        </Badge>
                      )}

                      {timerLabel && (
                        <Badge
                          variant="secondary"
                          className={`flex items-center gap-1 font-medium px-3 py-1 rounded-lg ${
                            overLimit
                              ? "bg-destructive/20 text-destructive border border-destructive/40"
                              : "bg-muted text-muted-foreground border-0"
                          }`}
                        >
                          {overLimit ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {timerLabel}
                          {maxAttentionTime ? ` / ${maxAttentionTime}m` : ""}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {actionItems.map(item => {
                      const tone = toneStyles[item.tone];
                      const baseClasses =
                        "group flex h-full w-full items-start gap-3 rounded-lg border bg-background/70 p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
                      const content = (
                        <>
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${tone.icon} group-hover:scale-105`}
                          >
                            {item.icon}
                          </span>
                          <span className="flex flex-col">
                            <span className="font-medium leading-tight">{item.label}</span>
                            <span className="text-xs text-muted-foreground leading-tight">{item.description}</span>
                          </span>
                        </>
                      );

                      if (item.type === "link") {
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            className={`${baseClasses} ${tone.wrapper}`}
                          >
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={item.onClick}
                          disabled={item.disabled}
                          className={`${baseClasses} ${tone.wrapper} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground">No hay operadores que cumplan el criterio.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
