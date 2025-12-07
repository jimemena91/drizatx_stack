"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicketWithRelations } from "@/lib/types";

type CurrentTicketCardProps = {
  ticket: TicketWithRelations | null | undefined;
};

export function CurrentTicketCard({ ticket }: CurrentTicketCardProps) {
  if (!ticket) {
    return null;
  }

  return (
    <Card className="glass card-elev-3 bg-hero text-primary-foreground">
      <CardHeader>
        <CardTitle className="text-primary-foreground">🔊 Turno en Atención</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-4xl font-bold mb-2">{ticket.number}</div>
            <p className="text-sm text-primary-foreground/80">
              {ticket.service.name} - {ticket.operator?.position}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-primary-foreground/80">Operador:</p>
            <p className="font-medium">{ticket.operator?.name}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
