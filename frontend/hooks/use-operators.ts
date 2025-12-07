"use client";

import * as React from "react";
import { apiClient, ApiError, type Operator as OperatorApi } from "@/lib/api-client";
import {
  Role,
  Status,
  type Operator as OperatorUI,
  type TicketWithRelations,
  type OperatorWithStats,
} from "@/lib/types";

/** 👀 Etiqueta visible para confirmar versión del hook */
export const __USE_OPERATORS_VERSION = "use-operators@2.9";

/** Log único al cargar el módulo (debe verse 1 vez al abrir Admin) */
if (typeof window !== "undefined") {
  console.log("[useOperators] módulo cargado →", __USE_OPERATORS_VERSION);
}

/* ============ Tipos extra para la UI ============ */
export type OperatorDerivedStatus = "AVAILABLE" | "CALLING" | "BUSY" | "OFFLINE";

/** Resultado extendido que la UI puede consumir directamente */
export type OperatorWithDerived = OperatorWithStats & {
  derivedStatus: OperatorDerivedStatus;
  derivedStatusLabel: string;
};

/* ============ Utils ============ */
function toBool(v: any): boolean {
  if (v === true || v === 1 || v === "1") return true;
  if (v === false || v === 0 || v === "0") return false;
  return !!v;
}

function normalizeOperator(raw: any): OperatorUI {
  const availableRoles = Object.values(Role) as string[];
  const primaryRoleRaw = typeof raw.role === "string" ? raw.role.toUpperCase() : "OPERATOR";
  const primaryRole = availableRoles.includes(primaryRoleRaw)
    ? (primaryRoleRaw as Role)
    : Role.OPERATOR;

  const normalizedRoles = Array.isArray(raw.roles)
    ? raw.roles
        .map((value: any) => (typeof value === "string" ? value.toUpperCase() : undefined))
        .filter((value: string | undefined): value is Role =>
          typeof value === "string" && availableRoles.includes(value),
        )
    : undefined;

  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    username: String(raw.username ?? ""),
    email: raw.email ?? "",
    position: raw.position ?? null,
    role: primaryRole,
    roles: normalizedRoles,
    active: toBool(raw.active),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  };
}

function sortByName(a: OperatorUI, b: OperatorUI) {
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Deriva el estado visible del operador a partir de su actividad y tickets */
function deriveOperatorStatus(
  op: OperatorUI,
  tickets: TicketWithRelations[]
): OperatorDerivedStatus {
  if (!op.active) return "OFFLINE";
  const tkForOp = tickets.filter((t) => t.operatorId === op.id);
  const hasInProgress = tkForOp.some((t) => t.status === Status.IN_PROGRESS);
  if (hasInProgress) return "BUSY";
  const hasCalled = tkForOp.some((t) => t.status === Status.CALLED);
  if (hasCalled) return "CALLING";
  return "AVAILABLE";
}

/** 🔢 Calcula métricas por operador + estado derivado (seguro ante arrays vacíos) */
export function computeOperatorsWithStats(
  operators: OperatorUI[] = [],
  tickets: TicketWithRelations[] = [],
): OperatorWithDerived[] {
  const today = startOfToday();

  return operators.map((op) => {
    const tkForOp = tickets.filter((t) => t.operatorId === op.id);

    const todayTickets = tkForOp.filter((t) => {
      const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
      return d >= today;
    }).length;

    const totalWait = tkForOp.reduce((acc, t) => acc + (t.actualWaitTime ?? 0), 0);
    const averageTime = tkForOp.length ? Math.round(totalWait / tkForOp.length) : 0;

    const currentTicket =
      tkForOp.find((t) => t.status === Status.IN_PROGRESS) ?? null;

    const derivedStatus = deriveOperatorStatus(op, tickets);
    const derivedStatusLabel =
      derivedStatus === "AVAILABLE" ? "Disponible" :
      derivedStatus === "CALLING"  ? "Llamando"   :
      derivedStatus === "BUSY"     ? "Atendiendo" :
                                     "Inactivo";

    return {
      ...op,
      todayTickets,
      averageTime,
      currentTicket,
      derivedStatus,
      derivedStatusLabel,
    };
  }).sort(sortByName);
}

/* ============ Hook principal ============ */
export function useOperators() {
  const [operators, setOperators] = React.useState<OperatorUI[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("[useOperators] GET /api/operators …");
      const raw = await apiClient.getOperators();
      console.log("[useOperators] respuesta cruda:", raw);
      const list = (raw ?? []).map(normalizeOperator).sort(sortByName);
      console.log("[useOperators] OK cantidad:", list.length);
      setOperators(list);
    } catch (e: any) {
      const msg =
        e instanceof ApiError ? e.message : e?.message || "No se pudieron cargar los operadores";
      console.error("[useOperators] ERROR GET /api/operators:", e);
      setOperators([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // microtick para separar de la hidratación y forzar que aparezca en Network
    const t = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(t);
  }, [refetch]);

  const createOperator = React.useCallback(
    async (p: {
      name: string;
      email: string;
      position?: string;
      role: Role;
      active?: boolean;
      username: string;
      password: string;
      serviceIds?: number[];
    }) => {
      const body = {
        name: String(p.name ?? "").trim(),
        username: String(p.username ?? "").trim(),
        password: String(p.password ?? ""),
        email: String(p.email ?? "").trim(),
        position: p.position ?? null,
        role: String(p.role ?? Role.OPERATOR).toUpperCase(),
        active: !!p.active,
      };
      console.log("[useOperators] POST /api/operators payload:", body);
      const created = await apiClient.createOperator({
        name: body.name,
        username: body.username,
        password: body.password,
        email: body.email,
        position: body.position,
        role: body.role,
        active: body.active,
        serviceIds: p.serviceIds ?? [],
      });
      await refetch();
      return normalizeOperator(created as OperatorApi);
    },
    [refetch],
  );

  const updateOperator = React.useCallback(
    async (id: number, p: Partial<OperatorUI> & { username?: string; password?: string; serviceIds?: number[] }) => {
      const body: any = {
        name: p.name?.trim(),
        email: p.email?.trim(),
        position: p.position ?? null,
        role: p.role ? String(p.role).toUpperCase() : undefined,
        active: typeof p.active === "boolean" ? p.active : undefined,
        username: p.username?.trim(),
      };
      if (p.password) body.password = String(p.password);
      console.log("[useOperators] PUT /api/operators/%d payload:", id, body);
      const updated = await apiClient.updateOperator(id, body);

      if (Array.isArray(p.serviceIds)) {
        await apiClient.assignOperatorServices(id, { serviceIds: p.serviceIds });
      }

      await refetch();
      return normalizeOperator(updated as OperatorApi);
    },
    [refetch],
  );

  const deleteOperator = React.useCallback(
    async (id: number) => {
      console.log("[useOperators] DELETE /api/operators/%d", id);
      await apiClient.deleteOperator(id);
      await refetch();
    },
    [refetch],
  );

  /** Devuelve métricas + estado derivado; si no pasás tickets, vuelve con contadores 0. */
  const getOperatorsWithStats = React.useCallback(
    (tickets?: TicketWithRelations[]): OperatorWithDerived[] =>
      computeOperatorsWithStats(operators, tickets ?? []),
    [operators],
  );

  const operatorsMapRef = React.useRef<Map<number, OperatorUI>>(new Map());

  React.useEffect(() => {
    const map = new Map<number, OperatorUI>();
    for (const op of operators) {
      map.set(op.id, op);
    }
    operatorsMapRef.current = map;
  }, [operators]);

  const operatorsMapById = operatorsMapRef.current;

  return {
    operators,
    createOperator,
    updateOperator,
    deleteOperator,
    refetch,
    loading,
    error,
    // extras:
    getOperatorsWithStats,
    operatorsMapById,
  };
}
