"use client";

import { useCallback } from "react";

import type { Status, TicketWithRelations } from "@/lib/types";
import { useTickets } from "./use-tickets";

type UseTicketsReturn = ReturnType<typeof useTickets>;
type CallNextTicketFn = UseTicketsReturn["callNextTicket"];
type CallNextTicketResult = Awaited<ReturnType<CallNextTicketFn>>;

type RequestCallNextResult = {
  ticket: CallNextTicketResult;
  error: unknown;
};

type RequestStatusChangeResult = {
  ticket: TicketWithRelations | null;
  error: unknown;
};

export const useTicketActions = () => {
  const { callNextTicket, callTicket, updateTicketStatus } = useTickets({ skipInitialFetch: true });

  const requestCallNext = useCallback<
    (operatorId: number, serviceId: number) => Promise<RequestCallNextResult>
  >(
    async (operatorId, serviceId) => {
      try {
        const ticket = await callNextTicket(operatorId, serviceId);
        return { ticket, error: null };
      } catch (error) {
        return { ticket: null, error };
      }
    },
    [callNextTicket],
  );

  const requestStatusChange = useCallback<
    (ticketId: number, status: Status, operatorId?: number) => Promise<RequestStatusChangeResult>
  >(
    async (ticketId, status, operatorId) => {
      try {
        const ticket = await updateTicketStatus(ticketId, status, operatorId);
        return { ticket, error: null };
      } catch (error) {
        return { ticket: null, error };
      }
    },
    [updateTicketStatus],
  );

  const requestCallTicket = useCallback<
    (ticketId: number, operatorId: number) => Promise<RequestStatusChangeResult>
  >(
    async (ticketId, operatorId) => {
      try {
        const ticket = await callTicket(ticketId, operatorId);
        return { ticket, error: null };
      } catch (error) {
        return { ticket: null, error };
      }
    },
    [callTicket],
  );

  return { requestCallNext, requestStatusChange, requestCallTicket };
};
