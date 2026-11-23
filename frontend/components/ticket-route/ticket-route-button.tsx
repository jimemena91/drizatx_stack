"use client";

import { useCallback, useState } from "react";
import { Route as RouteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { TicketRoutePanel } from "./ticket-route-panel";

type TicketRouteButtonProps = {
  className?: string;
};

/**
 * Botón "Ruta de ticket": abre un panel para buscar un turno por número y fecha
 * y ver todo su recorrido (emisión, llamados, ausentes, quién lo retomó, tiempos).
 */
export function TicketRouteButton({ className }: TicketRouteButtonProps) {
  const [open, setOpen] = useState(false);

  const search = useCallback((number: string, date: string) => apiClient.getTicketRoute(number, date), []);

  const list = useCallback((date: string) => apiClient.getTicketRouteDay(date), []);

  return (
    <div className={cn("w-full sm:w-auto", className)}>
      <Button
        variant="outline"
        className="w-full hover:bg-accent hover:text-accent-foreground sm:w-auto"
        onClick={() => setOpen(true)}
        data-testid="ticket-route-button"
      >
        <RouteIcon className="mr-2 h-4 w-4" />
        Ruta de ticket
      </Button>

      <TicketRoutePanel open={open} onOpenChange={setOpen} onSearch={search} onList={list} />
    </div>
  );
}
