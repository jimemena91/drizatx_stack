"use client";

import { RotateCcw, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicketWithRelations } from "@/lib/types";

type AbsentTicketsCardProps = {
  tickets: TicketWithRelations[];
  historicalCount?: number;
  onReintegrate: (ticketId: number) => void;
};

export function AbsentTicketsCard({ tickets, historicalCount = 0, onReintegrate }: AbsentTicketsCardProps) {
  const hasTickets = tickets.length > 0;
  const showHistoricalInfo = historicalCount > 0;

  if (!hasTickets && !showHistoricalInfo) {
    return null;
  }

  return (
    <Card className="glass card-elev-2 border border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5" />
          Tickets Ausentes
        </CardTitle>
        <CardDescription>Clientes que no respondieron al llamado</CardDescription>
      </CardHeader>
      <CardContent>
        {hasTickets ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/60">
                <div>
                  <div className="text-lg font-bold text-primary mb-1">{ticket.number}</div>
                  <p className="text-sm text-muted-foreground">{ticket.service.name}</p>
                  {ticket.client && (
                    <p className="text-xs text-muted-foreground/80">{ticket.client.name}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => onReintegrate(ticket.id)} className="text-xs">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reintegrar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay tickets ausentes para reintegrar hoy.</p>
        )}

        {showHistoricalInfo && (
          <p className="mt-4 text-xs text-muted-foreground">
            {historicalCount === 1
              ? "Hay 1 ticket ausente de días anteriores (solo como referencia histórica)."
              : `Hay ${historicalCount} tickets ausentes de días anteriores (solo como referencia histórica).`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
