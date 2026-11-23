"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAlertDuration } from "@/components/attention-alerts/attention-alerts-panel";
import type { AbsenceReport } from "@/lib/api-client";

const BUSINESS_TZ = "America/Argentina/Mendoza";

const STATUS_LABELS: Record<string, string> = {
  WAITING: "En espera",
  CALLED: "Llamado",
  IN_PROGRESS: "En atención",
  COMPLETED: "Completado",
  ABSENT: "Ausente",
  DAILY_CLOSED: "Cierre diario",
};

const dur = (seconds: number | null | undefined) =>
  seconds === null || seconds === undefined ? "—" : formatAlertDuration(seconds);

const clock = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TZ,
  });
};

const withPosition = (name: string | null, position: string | null) =>
  name ? (position ? `${name} · ${position}` : name) : null;

type Props = {
  report: AbsenceReport | null;
  loading: boolean;
  error: string | null;
  threshold: number;
  onThresholdChange: (minutes: number) => void;
};

export function AbsencesReport({ report, loading, error, threshold: currentThreshold, onThresholdChange }: Props) {
  const [draft, setDraft] = useState(String(currentThreshold));

  const commitThreshold = () => {
    const value = Math.round(Number(draft));
    if (Number.isFinite(value) && value >= 1 && value <= 1440) {
      if (value !== currentThreshold) onThresholdChange(value);
    } else {
      setDraft(String(currentThreshold));
    }
  };

  const threshold = report?.thresholdMin ?? currentThreshold;

  return (
    <div className="space-y-6" data-testid="absences-report">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Ausentes y esperas largas</CardTitle>
            <CardDescription>
              Sale del historial de cada turno: quién marca los ausentes, cuánto duran y quién los retoma. Sólo incluye
              turnos desde que se activó la ruta del ticket.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="wait-threshold" className="text-xs uppercase text-muted-foreground">
              Espera larga: más de (min)
            </Label>
            <Input
              id="wait-threshold"
              type="number"
              min={1}
              max={1440}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitThreshold}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitThreshold();
              }}
              className="w-32"
              data-testid="absences-threshold"
            />
          </div>
        </CardHeader>
      </Card>

      {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading && !report && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ausentes marcados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.absences.total}</p>
                <p className="text-xs text-muted-foreground">
                  en {report.absences.ticketsWithAbsence} turnos · {report.absences.notRetaken} sin retomar
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ausencia promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{dur(report.absences.avgAbsentSeconds)}</p>
                <p className="text-xs text-muted-foreground">máxima {dur(report.absences.maxAbsentSeconds)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Esperas de más de {threshold} min</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.longWaits.overThreshold}</p>
                <p className="text-xs text-muted-foreground">
                  de {report.longWaits.totalTickets} turnos
                  {report.longWaits.overThresholdPct !== null ? ` (${report.longWaits.overThresholdPct}%)` : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Espera promedio / máxima</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{dur(report.longWaits.avgWaitSeconds)}</p>
                <p className="text-xs text-muted-foreground">máxima {dur(report.longWaits.maxWaitSeconds)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ausentes por operador</CardTitle>
              <CardDescription>Quién los marca y quién los retoma.</CardDescription>
            </CardHeader>
            <CardContent>
              {report.byOperator.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No hay ausentes en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="absences-by-operator">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-4">Operador</th>
                        <th className="py-2 pr-4 text-right">Marcó ausente</th>
                        <th className="py-2 pr-4 text-right">Retomó</th>
                        <th className="py-2 pr-4 text-right">Ausencia promedio</th>
                        <th className="py-2 pr-4 text-right">Sin retomar</th>
                        <th className="py-2 pr-4 text-right">Retomados atendidos</th>
                        <th className="py-2 pr-4 text-right">Atención prom. retomados</th>
                        <th className="py-2 text-right">Atención total retomados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byOperator.map((row) => (
                        <tr key={`${row.operatorId ?? row.name}`} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <p className="font-medium">{row.name}</p>
                            {row.position && <p className="text-xs text-muted-foreground">{row.position}</p>}
                          </td>
                          <td className="py-2 pr-4 text-right">{row.markedAbsent}</td>
                          <td className="py-2 pr-4 text-right">{row.retaken}</td>
                          <td className="py-2 pr-4 text-right">{dur(row.avgAbsentSeconds)}</td>
                          <td className="py-2 pr-4 text-right">{row.notRetaken}</td>
                          <td className="py-2 pr-4 text-right">{row.retakenCompleted}</td>
                          <td className="py-2 pr-4 text-right">{dur(row.avgRetakenAttentionSeconds)}</td>
                          <td className="py-2 text-right">{row.retakenCompleted ? dur(row.totalRetakenAttentionSeconds) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Turnos con espera larga</CardTitle>
              <CardDescription>
                Desde que sacó el número hasta que empezó la atención. Los que siguen esperando cuentan hasta ahora.
                {report.longWaits.overThreshold > report.longWaits.rows.length
                  ? ` Se muestran los ${report.longWaits.rows.length} más largos; el Excel trae hasta 500.`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.longWaits.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ningún turno esperó más de {threshold} min en el período.
                </p>
              ) : (
                <ul className="space-y-2" data-testid="absences-long-waits">
                  {report.longWaits.rows.map((w) => (
                    <li key={w.ticketId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {w.ticketNumber}
                          {w.serviceName && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{w.serviceName}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sacó turno {clock(w.createdAt)}
                          {w.absentCount > 0 ? ` · ausente ${w.absentCount} ${w.absentCount === 1 ? "vez" : "veces"}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{STATUS_LABELS[w.status] ?? w.status}</Badge>
                        <span className="text-sm font-semibold">
                          {dur(w.waitSeconds)}
                          {w.ongoing ? " (sigue)" : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de ausencias</CardTitle>
              <CardDescription>Cada ausente: quién lo marcó, cuánto duró y quién lo retomó.</CardDescription>
            </CardHeader>
            <CardContent>
              {report.details.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No hay ausentes en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="absences-details">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-4">Turno</th>
                        <th className="py-2 pr-4">Se marcó</th>
                        <th className="py-2 pr-4">Lo marcó</th>
                        <th className="py-2 pr-4 text-right">Ausente</th>
                        <th className="py-2 pr-4">Lo retomó</th>
                        <th className="py-2 text-right">Atención tras retomar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.details.map((d, index) => (
                        <tr key={`${d.ticketId}-${d.markedAt}-${index}`} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{d.ticketNumber}</td>
                          <td className="py-2 pr-4">{clock(d.markedAt)}</td>
                          <td className="py-2 pr-4">{withPosition(d.markedByName, d.markedByPosition) ?? "No registrado"}</td>
                          <td className="py-2 pr-4 text-right">{dur(d.absentSeconds)}</td>
                          <td className="py-2 pr-4">
                            {d.takenAt
                              ? `${withPosition(d.takenByName, d.takenByPosition) ?? "Operador no registrado"} (${clock(d.takenAt)})`
                              : "Nadie todavía"}
                          </td>
                          <td className="py-2 text-right">
                            {d.retakenCompleted
                              ? dur(d.retakenAttentionSeconds)
                              : d.takenAt
                                ? "En curso / sin atender"
                                : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
