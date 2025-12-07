"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useQueueStatus } from "@/hooks/use-queue-status";
import { compareByPriorityDescAndDateAsc, normalizePriorityLevel } from "@/lib/priority";
import {
  Clock,
  Filter,
  Search,
  ArrowUpDown,
  Activity,
  BellRing,
  Download,
  Sun,
  Moon,
  Users,
  ArrowLeft,
  Maximize2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Estructura esperada de cada queue desde useQueueStatus():
 * {
 *   id: number | string;
 *   name: string;
 *   waitingCount: number;
 *   averageTime: string | number; // "10 min" o 10 → normalizamos
 * }
 */

type QueueItem = {
  id: number | string;
  name: string;
  waitingCount: number;
  averageTime: string | number;
};

type FlowTicket = {
  id: number | string;
  number: string;
  serviceId: string;
  serviceName: string;
  priority: number;
  since: string;
  position?: number;
};

type RealTimeFlowGridProps = {
  inProgress: FlowTicket[];
  called: FlowTicket[];
  waiting: FlowTicket[];
  className?: string;
  scrollAreaClassName?: string;
};

type FlowColumnDescriptor = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: FlowTicket[];
  emptyMessage: string;
  sinceLabel: (ticket: FlowTicket) => string;
  rightContent?: (ticket: FlowTicket) => ReactNode;
};

function normalizeAvg(v: string | number): number {
  if (typeof v === "number") return v;
  // soporta "10 min" o "10m"
  const num = parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function formatTimeLabel(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function priorityBadgeStyles(priority: number) {
  if (priority === 1) {
    return {
      label: `Prioridad ${priority}`,
      className: "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-100 border-0",
    };
  }
  if (priority === 2) {
    return {
      label: `Prioridad ${priority}`,
      className: "bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-100 border-0",
    };
  }
  return {
    label: `Prioridad ${priority}`,
    className: "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-100 border-0",
  };
}

function RealTimeFlowGrid({
  inProgress,
  called,
  waiting,
  className,
  scrollAreaClassName,
}: RealTimeFlowGridProps) {
  const columns: FlowColumnDescriptor[] = [
    {
      key: "in-progress",
      label: "En atención",
      icon: Activity,
      items: inProgress,
      emptyMessage: "Sin tickets en atención ahora mismo.",
      sinceLabel: (ticket) => `En atención desde ${ticket.since}`,
    },
    {
      key: "called",
      label: "Llamados",
      icon: BellRing,
      items: called,
      emptyMessage: "No hay tickets llamados pendientes de atender.",
      sinceLabel: (ticket) => `Llamado a las ${ticket.since}`,
    },
    {
      key: "waiting",
      label: "En espera",
      icon: Clock,
      items: waiting,
      emptyMessage: "No hay turnos esperando en este momento.",
      sinceLabel: (ticket) => `En fila desde ${ticket.since}`,
      rightContent: (ticket) =>
        typeof ticket.position === "number" ? (
          <Badge variant="outline" className="border-dashed px-2 py-0.5 text-xs">
            #{ticket.position}
          </Badge>
        ) : null,
    },
  ];

  return (
    <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
      {columns.map((column) => (
        <div
          key={column.key}
          className="rounded-xl border border-border/40 bg-card/70 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <column.icon className="h-4 w-4" /> {column.label}
            </div>
            <Badge variant="secondary" className="border-0">
              {column.items.length}
            </Badge>
          </div>
          <ScrollArea className={cn("max-h-64 pr-3", scrollAreaClassName)}>
            {column.items.length > 0 ? (
              <ul className="space-y-3">
                {column.items.map((ticket) => {
                  const showPriority = ticket.priority > 0;
                  const priorityStyles = priorityBadgeStyles(ticket.priority);
                  return (
                    <li
                      key={`${column.key}-${ticket.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/60 p-3 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold">Turno {ticket.number}</span>
                          {showPriority && (
                            <Badge className={`${priorityStyles.className} text-xs px-2 py-0.5`}>
                              {priorityStyles.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{ticket.serviceName}</p>
                        <p className="text-[11px] text-muted-foreground/80">
                          {column.sinceLabel(ticket)}
                        </p>
                      </div>
                      {column.rightContent ? column.rightContent(ticket) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{column.emptyMessage}</p>
            )}
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

export default function QueuesIndexPage() {
  const { theme, setTheme, systemTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark");

  const { getQueueStatus, refetch } = useQueueStatus();
  const [status, setStatus] = useState(getQueueStatus());

  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [isRealtimeModalOpen, setRealtimeModalOpen] = useState(false);

  // Filtros y orden
  const [q, setQ] = useState("");
  const [minWaiting, setMinWaiting] = useState<number | "">("");
  const [sortBy, setSortBy] = useState<"name" | "waiting" | "avg">("waiting");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const refreshing = useRef(false);

  // Carga inicial + refresco cada 5s
  useEffect(() => {
    (async () => {
      const fresh = await refetch();
      if (fresh) setStatus(fresh);
    })();
  }, [refetch]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const fresh = await refetch();
        if (fresh) setStatus(fresh);
      } finally {
        refreshing.current = false;
      }
    }, 5000);
    return () => clearInterval(id);
  }, [refetch]);

  // Derivamos y normalizamos las colas
  const queues: QueueItem[] = useMemo(() => {
    return (status?.queues ?? []).map((q: any) => ({
      id: q.id,
      name: q.name,
      waitingCount: Number(q.waitingCount ?? 0),
      averageTime: q.averageTime,
    }));
  }, [status]);

  const inProgressFlow: FlowTicket[] = useMemo(() => {
    return (status?.inProgressTickets ?? []).map((ticket) => ({
      id: ticket.id,
      number: ticket.number ?? `#${ticket.id}`,
      serviceId: String(
        ticket.service?.id ??
          (ticket.service as any)?.serviceId ??
          ticket.serviceId ??
          "",
      ),
      serviceName: ticket.service?.name ?? `Servicio #${ticket.serviceId}`,
      priority: normalizePriorityLevel(ticket.priority) ?? 0,
      since: formatTimeLabel(ticket.startedAt ?? ticket.calledAt ?? ticket.createdAt),
    }));
  }, [status]);

  const calledFlow: FlowTicket[] = useMemo(() => {
    return (status?.calledTickets ?? []).map((ticket) => ({
      id: ticket.id,
      number: ticket.number ?? `#${ticket.id}`,
      serviceId: String(
        ticket.service?.id ??
          (ticket.service as any)?.serviceId ??
          ticket.serviceId ??
          "",
      ),
      serviceName: ticket.service?.name ?? `Servicio #${ticket.serviceId}`,
      priority: normalizePriorityLevel(ticket.priority) ?? 0,
      since: formatTimeLabel(ticket.calledAt ?? ticket.createdAt),
    }));
  }, [status]);

  const waitingFlow: FlowTicket[] = useMemo(() => {
    const tickets = [...(status?.waitingTickets ?? [])];

    const getReferenceTimestamp = (ticket: (typeof tickets)[number]) => {
      const reference = (ticket as any)?.requeuedAt ?? ticket.createdAt ?? null;
      if (!reference) return 0;
      if (reference instanceof Date) {
        const value = reference.getTime();
        return Number.isFinite(value) ? value : 0;
      }
      const date = new Date(reference as any);
      const value = date.getTime();
      return Number.isFinite(value) ? value : 0;
    };

    tickets.sort((a, b) => {
      const order = compareByPriorityDescAndDateAsc(
        a,
        b,
        (ticket) => normalizePriorityLevel(ticket.priority),
        (ticket) => getReferenceTimestamp(ticket),
      );
      if (order !== 0) return order;

      const idA = Number((a as any)?.id ?? Number.NaN);
      const idB = Number((b as any)?.id ?? Number.NaN);

      if (Number.isFinite(idA) && Number.isFinite(idB)) {
        return idA - idB;
      }

      return String(a.id).localeCompare(String(b.id));
    });

    return tickets.map((ticket, index) => ({
      id: ticket.id,
      number: ticket.number ?? `#${ticket.id}`,
      serviceId: String(
        ticket.service?.id ??
          (ticket.service as any)?.serviceId ??
          ticket.serviceId ??
          "",
      ),
      serviceName: ticket.service?.name ?? `Servicio #${ticket.serviceId}`,
      priority: normalizePriorityLevel(ticket.priority) ?? 0,
      since: formatTimeLabel((ticket as any)?.requeuedAt ?? ticket.createdAt),
      position: index + 1,
    }));
  }, [status]);

  const availableServices = useMemo(() => {
    const lookup = new Map<string, string>();
    queues.forEach((queue) => {
      lookup.set(String(queue.id), queue.name);
    });
    [...inProgressFlow, ...calledFlow, ...waitingFlow].forEach((ticket) => {
      if (!ticket.serviceId) return;
      if (!lookup.has(ticket.serviceId)) {
        lookup.set(ticket.serviceId, ticket.serviceName);
      }
    });

    return Array.from(lookup.entries())
      .map(([id, name]) => ({
        id,
        name: name || `Servicio #${id}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [queues, inProgressFlow, calledFlow, waitingFlow]);

  const availableServiceIds = useMemo(
    () => new Set(availableServices.map((service) => service.id)),
    [availableServices],
  );

  useEffect(() => {
    setSelectedServices((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((id) => availableServiceIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [availableServiceIds]);

  const selectedServiceNames = useMemo(() => {
    if (selectedServices.length === 0) return [] as string[];
    const selectedSet = new Set(selectedServices);
    return availableServices
      .filter((service) => selectedSet.has(service.id))
      .map((service) => service.name);
  }, [availableServices, selectedServices]);

  const filteredInProgress = useMemo(() => {
    if (selectedServices.length === 0) return inProgressFlow;
    const selectedSet = new Set(selectedServices);
    return inProgressFlow.filter((ticket) => selectedSet.has(ticket.serviceId));
  }, [inProgressFlow, selectedServices]);

  const filteredCalledFlow = useMemo(() => {
    if (selectedServices.length === 0) return calledFlow;
    const selectedSet = new Set(selectedServices);
    return calledFlow.filter((ticket) => selectedSet.has(ticket.serviceId));
  }, [calledFlow, selectedServices]);

  const filteredWaitingFlow = useMemo(() => {
    if (selectedServices.length === 0) return waitingFlow;
    const selectedSet = new Set(selectedServices);
    return waitingFlow.filter((ticket) => selectedSet.has(ticket.serviceId));
  }, [waitingFlow, selectedServices]);

  // Filtro + orden
  const filtered = useMemo(() => {
    let list = [...queues];

    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((x) => `${x.name}`.toLowerCase().includes(needle));
    }

    if (minWaiting !== "" && Number.isFinite(Number(minWaiting))) {
      list = list.filter((x) => x.waitingCount >= Number(minWaiting));
    }

    list.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortBy === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
      } else if (sortBy === "waiting") {
        va = a.waitingCount;
        vb = b.waitingCount;
      } else {
        va = normalizeAvg(a.averageTime);
        vb = normalizeAvg(b.averageTime);
      }

      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [queues, q, minWaiting, sortBy, sortDir]);

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  }

  // Export JSON
  function exportJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalServices: filtered.length,
      items: filtered.map((x) => ({
        id: x.id,
        name: x.name,
        waitingCount: x.waitingCount,
        averageTime: typeof x.averageTime === "string" ? x.averageTime : `${x.averageTime} min`,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "queues-detail.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export CSV
  function exportCSV() {
    const rows = [
      ["id", "name", "waitingCount", "averageTime(min)"],
      ...filtered.map((x) => [
        String(x.id),
        String(x.name).replaceAll(",", " "), // naive escape
        String(x.waitingCount),
        String(normalizeAvg(x.averageTime)),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "queues-detail.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" className="px-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Colas — Detalle</h1>
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

      <Dialog open={isRealtimeModalOpen} onOpenChange={setRealtimeModalOpen}>
        <Card className="glass card-elev-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" /> Flujo en tiempo real
              </CardTitle>
              <CardDescription>
                Visualizá los tickets activos y cómo los turnos con prioridad se ubican en la fila.
              </CardDescription>
              {selectedServiceNames.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedServiceNames.map((serviceName) => (
                    <Badge key={serviceName} variant="outline" className="border-dashed text-xs">
                      {serviceName}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                    <Filter className="h-4 w-4" />
                    {selectedServiceNames.length === 1
                      ? selectedServiceNames[0]
                      : selectedServices.length > 1
                      ? `${selectedServices.length} servicios`
                      : "Todos los servicios"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filtrar servicios</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={selectedServices.length === 0}
                    onCheckedChange={() => setSelectedServices([])}
                  >
                    Todos los servicios
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {availableServices.map((service) => (
                    <DropdownMenuCheckboxItem
                      key={service.id}
                      checked={selectedServices.includes(service.id)}
                      onCheckedChange={(checked) => {
                        setSelectedServices((prev) => {
                          if (checked) {
                            if (prev.includes(service.id)) return prev;
                            return [...prev, service.id];
                          }
                          return prev.filter((id) => id !== service.id);
                        });
                      }}
                    >
                      {service.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <Maximize2 className="h-4 w-4" /> Vista ampliada
                </Button>
              </DialogTrigger>
            </div>
          </CardHeader>
          <CardContent>
            <RealTimeFlowGrid
              inProgress={filteredInProgress}
              called={filteredCalledFlow}
              waiting={filteredWaitingFlow}
              scrollAreaClassName="max-h-[320px] md:max-h-[45vh] pr-3 md:pr-4"
            />
          </CardContent>
        </Card>

        <DialogContent className="sm:max-w-5xl">
          <DialogHeader className="text-left">
            <DialogTitle>Flujo en tiempo real</DialogTitle>
            <DialogDescription>
              Explorá el detalle completo de la fila con desplazamiento para cada etapa del turno.
            </DialogDescription>
          </DialogHeader>
          <RealTimeFlowGrid
            inProgress={filteredInProgress}
            called={filteredCalledFlow}
            waiting={filteredWaitingFlow}
            className="md:grid-cols-3"
            scrollAreaClassName="max-h-[60vh] pr-4"
          />
        </DialogContent>
      </Dialog>

      <Card className="glass card-elev-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Listado de colas
          </CardTitle>
          <CardDescription>Filtrá por nombre o mínimo de espera, ordená y exportá CSV/JSON.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Controles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 min-w-[260px]"
                placeholder="Buscar por servicio…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                className="w-[140px]"
                placeholder="Mín. en espera"
                value={String(minWaiting)}
                onChange={(e) => {
                  const v = e.target.value;
                  setMinWaiting(v === "" ? "" : Number(v));
                }}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={() => toggleSort("name")}>
                <ArrowUpDown className="h-4 w-4 mr-1" /> Nombre
              </Button>
              <Button variant="ghost" onClick={() => toggleSort("waiting")}>
                <ArrowUpDown className="h-4 w-4 mr-1" /> En espera
              </Button>
              <Button variant="ghost" onClick={() => toggleSort("avg")}>
                <ArrowUpDown className="h-4 w-4 mr-1" /> Tiempo prom.
              </Button>

              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" onClick={exportJSON}>
                <Download className="h-4 w-4 mr-1" /> JSON
              </Button>
            </div>
          </div>

          {/* Lista con Link a detalle */}
          <div className="space-y-3">
            {filtered.map((s) => {
              const heavy = s.waitingCount > 15;
              const chipClasses = heavy
                ? "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-200"
                : "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-200";

              return (
                <Link
                  key={s.id}
                  href={`/dashboard/queues/${encodeURIComponent(String(s.id))}`}
                >
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card/70 hover:shadow-sm hover:bg-accent/5 transition cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Badge className={`${chipClasses} border-0 font-semibold px-4 py-2 rounded-xl`}>
                        {s.name}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">
                          {typeof s.averageTime === "string" ? s.averageTime : `${s.averageTime} min`} promedio
                        </span>
                      </div>
                    </div>

                    <div
                      className="text-3xl font-bold"
                      style={{ background: "var(--gradient-4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                      title={`${s.waitingCount} esperando`}
                    >
                      {s.waitingCount}
                    </div>
                  </div>
                </Link>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground">No hay colas que cumplan el criterio.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
