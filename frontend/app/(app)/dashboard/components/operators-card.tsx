"use client";

import Link from "next/link";
import { AlertTriangle, Play, Square, UserX, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AttentionAlert } from "@/lib/api-client";
import { Status } from "@/lib/types";

export type DashboardOperator = {
  id: number;
  name: string;
  position?: string | null;
  derivedStatus?: "AVAILABLE" | "CALLING" | "BUSY" | "OFFLINE";
  derivedStatusLabel?: string;
  active: boolean | number;
  currentTicket?: { id: number; number: string; status: number | string } | null;
  services?: Array<{ id: number; name: string; prefix?: string | null } | null> | null;
  serviceIds?: number[] | null;
};

type OperatorsCardProps = {
  operators: DashboardOperator[];
  attentionAlerts: AttentionAlert[];
  alertsByTicketId: Map<number, AttentionAlert>;
  loadingOperatorId: number | null;
  onCallNext: (operator: DashboardOperator) => void;
  onStartAttention: (ticketId: number) => void;
  onMarkAbsent: (ticketId: number) => void;
  onCompleteTicket: (ticketId: number) => void;
  formatDuration: (seconds: number) => string;
};

export function OperatorsCard({
  operators,
  attentionAlerts,
  alertsByTicketId,
  loadingOperatorId,
  onCallNext,
  onStartAttention,
  onMarkAbsent,
  onCompleteTicket,
  formatDuration,
}: OperatorsCardProps) {
  return (
    <Card
      className="group relative p-6 border-2 border-border/60 dark:border-border/40 shadow-xl hover:shadow-2xl dark:shadow-2xl transition-all duration-500 overflow-hidden"
      style={{ background: "var(--card)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "var(--gradient-1)" }}
      >
        <div className="absolute inset-0 bg-card/85 dark:bg-card/80" />
      </div>

      <div className="relative z-10">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
              style={{ background: "var(--gradient-4)" }}
            >
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-card-foreground">Estado de Operadores</h3>
              <p className="text-sm text-muted-foreground mt-1">Puestos de atención y disponibilidad</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="border-0 font-semibold px-4 py-2 rounded-xl"
              style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
            >
              {operators.length} activos
            </Badge>

            <Link href="/dashboard/operators">
              <Button variant="outline" className="hover:bg-accent hover:text-accent-foreground">
                Ver detalle
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {operators.map((operator) => {
            const ticketId = operator.currentTicket ? Number(operator.currentTicket.id) : null;
            const alert = ticketId ? alertsByTicketId.get(ticketId) : undefined;
            const isExceeded = Boolean(alert);
            const cardBackground = isExceeded ? "rgba(248,113,113,0.08)" : "var(--muted)";
            const cardClasses = [
              "flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 rounded-2xl border backdrop-blur-sm transition-all duration-300",
              "hover:shadow-lg",
              isExceeded ? "border-destructive/60 shadow-destructive/30" : "border-border/30",
            ].join(" ");

            const derived = operator.derivedStatus ?? "AVAILABLE";
            const derivedLabel = operator.derivedStatusLabel ?? "Disponible";

            return (
              <div key={operator.id} className={cardClasses} style={{ background: cardBackground }}>
                <div className="flex w-full items-center gap-4 md:w-auto md:flex-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: "var(--gradient-3)" }}
                    title={operator.name}
                  >
                    {(operator.name ?? "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold text-card-foreground truncate">{operator.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{operator.position ?? "—"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {Array.isArray(operator.services) && operator.services.filter(Boolean).length > 0 ? (
                        operator.services
                          .filter((svc): svc is { id: number; name: string; prefix?: string | null } => Boolean(svc))
                          .map((svc) => (
                            <Badge
                              key={`${operator.id}-svc-${svc.id}`}
                              variant="outline"
                              className="border-border/40 px-2 py-0.5 text-[11px] font-medium"
                            >
                              {svc.name || `Servicio #${svc.id}`}
                            </Badge>
                          ))
                      ) : Array.isArray(operator.serviceIds) && operator.serviceIds.length > 0 ? (
                        <Badge variant="outline" className="border-border/40 px-2 py-0.5 text-[11px] font-medium">
                          {operator.serviceIds.length} servicio{operator.serviceIds.length === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin servicios asignados</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
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
                    {derivedLabel}
                  </Badge>

                  {operator.currentTicket ? (
                    <Badge
                      variant="secondary"
                      className="border-0 font-medium px-3 py-1 rounded-lg"
                      style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                    >
                      Turno {operator.currentTicket.number}
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

                  {alert && (
                    <Badge
                      variant="destructive"
                      className="flex items-center gap-1 border-0 font-medium px-3 py-1 rounded-lg"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {formatDuration(alert.elapsedSeconds)} / {alert.maxAttentionTime}m
                    </Badge>
                  )}

                  <div className="ml-auto flex w-full flex-col gap-1 sm:w-auto sm:flex-row md:ml-2 md:flex-col">
                    {derived === "AVAILABLE" && (
                      <Button
                        size="sm"
                        onClick={() => onCallNext(operator)}
                        className="text-xs btn-premium w-full sm:w-auto"
                        disabled={loadingOperatorId === operator.id}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {loadingOperatorId === operator.id ? "Llamando..." : "Llamar"}
                      </Button>
                    )}

                    {operator.currentTicket && operator.currentTicket.status === Status.CALLED && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onStartAttention(operator.currentTicket!.id as number)}
                          className="text-xs w-full sm:w-auto"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Iniciar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkAbsent(operator.currentTicket!.id as number)}
                          className="text-xs w-full sm:w-auto"
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Ausente
                        </Button>
                      </>
                    )}

                    {operator.currentTicket && operator.currentTicket.status === Status.IN_PROGRESS && (
                      <Button
                        size="sm"
                        onClick={() => onCompleteTicket(operator.currentTicket!.id as number)}
                        className="text-xs w-full sm:w-auto"
                        variant="outline"
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Finalizar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {operators.length === 0 && (
            <div className="text-sm text-muted-foreground">Sin datos de operadores por ahora…</div>
          )}
        </div>
      </div>
    </Card>
  );
}
