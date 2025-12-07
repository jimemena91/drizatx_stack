"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { getDefaultRouteForRole } from "@/lib/auth-utils";
import { useQueueStatus } from "@/hooks/use-queue-status";
import { useTicketActions } from "@/hooks/use-ticket-actions";
import { useServices } from "@/hooks/use-services";
import {
  useKeyboardNavigation,
  type KeyboardShortcut,
} from "@/hooks/use-keyboard-navigation";
import { useToast } from "@/components/toast-provider";
import { useQueue } from "@/contexts/queue-context";
import { applyTicketUpdateToSnapshot } from "@/lib/queue-snapshot";
import {
  Role,
  Status,
  type DashboardMetrics,
  type QueueStatus,
  type TicketWithRelations,
} from "@/lib/types";
import { getFriendlyApiErrorMessage } from "@/lib/error-messages";
import {
  apiClient,
  type OperatorAvailabilityStatus,
  type OperatorWithStatus,
} from "@/lib/api-client";
import {
  DEFAULT_OPERATOR_AVAILABILITY,
  normalizeOperatorAvailability,
} from "@/lib/operator-availability";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle,
  Circle,
  Clock,
  Loader2,
  Phone,
  PlayCircle,
  RotateCcw,
  Sparkles,
  UserX,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getBooleanSetting } from "@/lib/system-settings";

/* ----------------------------- Helpers de tiempo ----------------------------- */
function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

type AvailabilityState = OperatorAvailabilityStatus;

type AvailabilityPayload = Partial<OperatorWithStatus> & {
  availability?: string | null;
  availabilityStatus?: string | null;
  status?: string | null;
  state?: string | null;
};

type TicketStatusAction = {
  status: Status;
  keyHint?: string;
  label: string;
  shortcutDescription: string;
  icon: LucideIcon;
  buttonClassName: string;
  badgeClassName?: string;
  variant?: "default" | "secondary";
};

type AttentionTimingState = {
  limitSeconds: number | null;
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
  exceededSeconds: number | null;
};

const isActiveFlag = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (["1", "true", "t", "yes", "y", "on", "activo", "active"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "f", "no", "n", "off", "inactivo", "inactive"].includes(normalized)) {
      return false;
    }
  }
  return Boolean(value);
};

const formatSecondsToClock = (value: number): string => {
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const formatSecondsVerbose = (value: number | null): string => {
  if (value === null) return "—";
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes > 0 && seconds > 0)
    return `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} s`;
};

const SERVE_TICKETS_PERMISSION_MESSAGE =
  "Tu cuenta no tiene permisos para llamar turnos. Contactá a un supervisor para habilitar tu usuario.";

/* --------------------------------- Estilos ---------------------------------- */
const AVAILABILITY_BADGE_STYLES: Record<AvailabilityState, string> = {
  ACTIVE: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  BREAK: "border border-amber-200 bg-amber-50 text-amber-700",
  OFF: "border border-gray-200 bg-gray-50 text-gray-600",
};

const TICKET_STATUS_VISUALS: Record<
  Status,
  { label: string; helper: string; tone: string }
> = {
  [Status.WAITING]: {
    label: "En espera",
    helper: "El ticket continúa en la cola general.",
    tone: "border border-violet-200 bg-violet-50 text-violet-700",
  },
  [Status.CALLED]: {
    label: "Llamado",
    helper: "El cliente fue notificado y espera confirmación.",
    tone: "border border-sky-200 bg-sky-50 text-sky-700",
  },
  [Status.IN_PROGRESS]: {
    label: "En atención",
    helper: "Estás trabajando activamente el ticket.",
    tone: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  [Status.COMPLETED]: {
    label: "Finalizado",
    helper: "La atención se completó correctamente.",
    tone: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  [Status.CANCELLED]: {
    label: "Cancelado",
    helper: "El ticket se cerró sin brindar atención.",
    tone: "border border-rose-200 bg-rose-50 text-rose-700",
  },
  [Status.ABSENT]: {
    label: "Ausente",
    helper: "El cliente no se presentó al llamado.",
    tone: "border border-amber-200 bg-amber-50 text-amber-700",
  },
};

type StageKey = Status | "IDLE";

const STAGE_THEMES: Record<
  StageKey,
  {
    label: string;
    description: string;
    badgeClassName: string;
    accentClassName: string;
    helperClassName: string;
  }
> = {
  IDLE: {
    label: "Listo para llamar",
    description:
      'Pulsa "Llamar siguiente" para asignar un nuevo turno a tu puesto.',
    badgeClassName: "border border-slate-700/60 bg-slate-800/60 text-slate-100",
    accentClassName: "text-white",
    helperClassName: "text-slate-300/80",
  },
  [Status.WAITING]: {
    label: "En cola",
    description: "El ticket se encuentra en espera dentro de la cola general.",
    badgeClassName:
      "border border-violet-400/40 bg-violet-500/20 text-violet-100",
    accentClassName: "text-violet-100",
    helperClassName: "text-violet-200/80",
  },
  [Status.CALLED]: {
    label: "Llamando",
    description:
      "Esperando que la persona se acerque al puesto para iniciar la atención.",
    badgeClassName: "border border-sky-400/40 bg-sky-500/20 text-sky-100",
    accentClassName: "text-sky-100",
    helperClassName: "text-sky-200/80",
  },
  [Status.IN_PROGRESS]: {
    label: "Atención en curso",
    description: "Gestioná la atención en curso con foco en el servicio.",
    badgeClassName:
      "border border-emerald-400/40 bg-emerald-500/20 text-emerald-100",
    accentClassName: "text-emerald-100",
    helperClassName: "text-emerald-200/80",
  },
  [Status.COMPLETED]: {
    label: "Atención finalizada",
    description:
      "Confirma el cierre y llama al siguiente turno cuando estés listo.",
    badgeClassName:
      "border border-indigo-400/40 bg-indigo-500/20 text-indigo-100",
    accentClassName: "text-indigo-100",
    helperClassName: "text-indigo-200/80",
  },
  [Status.ABSENT]: {
    label: "Ausente",
    description:
      "El ticket fue marcado como ausente y puede volver a la cola si lo necesitas.",
    badgeClassName: "border border-amber-400/40 bg-amber-500/20 text-amber-100",
    accentClassName: "text-amber-100",
    helperClassName: "text-amber-200/80",
  },
  [Status.CANCELLED]: {
    label: "Cancelado",
    description: "El ticket se canceló sin brindar atención.",
    badgeClassName: "border border-rose-400/40 bg-rose-500/20 text-rose-100",
    accentClassName: "text-rose-100",
    helperClassName: "text-rose-200/80",
  },
};

const STAGE_BACKDROP_GRADIENTS: Record<StageKey, string> = {
  IDLE: "from-slate-700/30 via-slate-900/10 to-transparent",
  [Status.WAITING]: "from-violet-500/25 via-violet-500/5 to-transparent",
  [Status.CALLED]: "from-sky-500/30 via-sky-400/5 to-transparent",
  [Status.IN_PROGRESS]: "from-emerald-500/30 via-emerald-500/10 to-transparent",
  [Status.COMPLETED]: "from-indigo-500/25 via-indigo-400/5 to-transparent",
  [Status.ABSENT]: "from-amber-500/30 via-amber-400/10 to-transparent",
  [Status.CANCELLED]: "from-rose-500/30 via-rose-500/10 to-transparent",
};

/* ------------------------------ Acciones status ----------------------------- */
const TICKET_STATUS_ACTIONS: TicketStatusAction[] = [
  {
    status: Status.CALLED,
    keyHint: "1",
    label: "Llamar / confirmar llegada",
    shortcutDescription: "Marcar ticket como llamado",
    icon: Phone,
    buttonClassName:
      "rounded-2xl border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100",
    badgeClassName: "border-sky-200 bg-white text-sky-700 text-xs",
    variant: "secondary",
  },
  {
    status: Status.IN_PROGRESS,
    keyHint: "2",
    label: "Empezar atención",
    shortcutDescription: "Atender el ticket actual",
    icon: PlayCircle,
    buttonClassName:
      "rounded-2xl bg-indigo-600 text-white shadow-lg transition-colors hover:bg-indigo-700",
    badgeClassName: "border-white/40 bg-white/10 text-white text-xs",
  },
  {
    status: Status.COMPLETED,
    keyHint: "3",
    label: "Finalizar ticket",
    shortcutDescription: "Finalizar ticket",
    icon: BadgeCheck,
    buttonClassName:
      "rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100",
    badgeClassName: "border-emerald-300 bg-white text-emerald-700 text-xs",
    variant: "secondary",
  },
  {
    status: Status.ABSENT,
    keyHint: "4",
    label: "Marcar ausente / no se presentó",
    shortcutDescription: "Marcar ticket ausente",
    icon: AlertCircle,
    buttonClassName:
      "rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100",
    badgeClassName: "border-amber-300 bg-white text-amber-700 text-[0.625rem]",
    variant: "secondary",
  },
  {
    status: Status.WAITING,
    keyHint: "5",
    label: "Devolver a la cola / en espera",
    shortcutDescription: "Devolver ticket a la cola",
    icon: RotateCcw,
    buttonClassName:
      "rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 transition-colors hover:bg-violet-100",
    badgeClassName:
      "border-violet-300 bg-white text-violet-700 text-[0.625rem]",
    variant: "secondary",
  },
  {
    status: Status.CANCELLED,
    label: "Cancelar ticket / no atendido",
    shortcutDescription: "Cancelar ticket",
    icon: Circle,
    buttonClassName:
      "rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100",
    variant: "secondary",
  },
];

const SHORTCUT_STATUS_ACTIONS = TICKET_STATUS_ACTIONS.filter(
  (action): action is TicketStatusAction & { keyHint: string } =>
    Boolean(action.keyHint),
).sort((a, b) =>
  a.keyHint.localeCompare(b.keyHint, undefined, { numeric: true }),
);

const PRIMARY_STATUS_SEQUENCE: Status[] = [
  Status.CALLED,
  Status.IN_PROGRESS,
  Status.ABSENT,
  Status.COMPLETED,
];

const isTransitionAllowed = (from: Status | null, to: Status): boolean => {
  if (!from) return false;
  switch (to) {
    case Status.CALLED:
      return from === Status.WAITING || from === Status.CALLED;
    case Status.IN_PROGRESS:
      return from === Status.CALLED;
    case Status.COMPLETED:
      return from === Status.IN_PROGRESS;
    case Status.ABSENT:
      return from === Status.CALLED || from === Status.IN_PROGRESS;
    case Status.WAITING:
      return from === Status.ABSENT;
    default:
      return true;
  }
};

/* ------------------------- Normalización disponibilidad ---------------------- */
const normalizeAvailabilityValue = (value: unknown): AvailabilityState | null =>
  normalizeOperatorAvailability(value);

const resolveAvailabilityFromPayload = (
  payload: AvailabilityPayload | null | undefined,
): AvailabilityState | null => {
  if (!payload) return null;

  const candidates: Array<string | null | undefined> = [
    payload.availability,
    payload.availabilityStatus,
    (payload as any)?.availability_state,
    payload.status,
    payload.state,
    (payload as any)?.stateLabel,
    (payload as any)?.derivedStatus,
  ];

  for (const candidate of candidates) {
    const resolved = normalizeAvailabilityValue(candidate);
    if (resolved) return resolved;
  }

  if (typeof (payload as any)?.active === "boolean") {
    return (payload as any).active ? "ACTIVE" : "OFF";
  }

  return null;
};

/* ------------------------------ Utilidades cola ----------------------------- */
function pickTicketsForOperator(queue: QueueStatus, operatorId: number | null) {
  if (!operatorId)
    return {
      active: null as TicketWithRelations | null,
      any: null as TicketWithRelations | null,
    };

  const pool: TicketWithRelations[] = [];
  if (queue.currentTicket) pool.push(queue.currentTicket);
  pool.push(...queue.inProgressTickets, ...queue.calledTickets);

  const byStatus = (status: Status) =>
    pool.find(
      (ticket) =>
        ticket.operator?.id === operatorId && ticket.status === status,
    ) ?? null;

  const inProgress = byStatus(Status.IN_PROGRESS);
  const called = byStatus(Status.CALLED);

  const active = inProgress ?? called ?? null;
  const any =
    active ?? pool.find((ticket) => ticket.operator?.id === operatorId) ?? null;

  return { active, any };
}

/* ------------------------------- Componente UI ------------------------------ */
function OperatorContent({ operatorId }: { operatorId: number | null }) {
  const {
    getQueueStatus,
    refetch,
    status: queueStatusState,
    snapshotState,
    hasSnapshot: queueHasSnapshot,
  } = useQueueStatus();
  const { isInitialLoading: queueLoading, error: queueError } = snapshotState;
  const queueData = getQueueStatus();
  const [queueSnapshot, setQueueSnapshot] = useState<QueueStatus>(queueData);
  useEffect(() => {
    setQueueSnapshot(queueData);
  }, [queueData]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { requestCallNext, requestStatusChange, requestCallTicket } =
    useTicketActions();

  const queueCtx = useQueue();
  const queueState = queueCtx.state;
  const queueIsApiMode = (queueCtx as any)?.isApiMode ?? false;

  const { state: authState } = useAuth();
  const authLoading = authState.isLoading;
  const authToken = authState.token;
  const authIsAuthenticated = authState.isAuthenticated;
  const authReady = !authLoading && (authIsAuthenticated || !!authToken);

  const permissions: string[] = Array.isArray(authState.permissions)
    ? authState.permissions
    : [];
  const normalizedRoleSet = useMemo(() => {
    const roles: string[] = [];
    const primaryRole = authState.user?.role;
    if (typeof primaryRole === "string") {
      roles.push(primaryRole);
    }
    const secondaryRoles = authState.user?.roles;
    if (Array.isArray(secondaryRoles)) {
      roles.push(
        ...secondaryRoles.filter((role): role is string => typeof role === "string"),
      );
    }
    return new Set(
      roles
        .map((role) => role.trim().toUpperCase())
        .filter((role) => role.length > 0),
    );
  }, [authState.user?.role, authState.user?.roles]);
  const normalizedPermissionSet = useMemo(
    () => new Set(permissions.map((permission) => permission?.toLowerCase?.() ?? "")),
    [permissions],
  );
  const permissionAliases = useMemo(
    () =>
      new Set(
        [
          "call_tickets",
          "call-tickets",
          "calltickets",
          "serve_tickets",
          "serve-tickets",
          "servetickets",
        ].map((alias) => alias.toLowerCase()),
      ),
    [],
  );
  const hasExplicitServePermission = useMemo(() => {
    if (normalizedPermissionSet.size === 0) return false;
    return Array.from(normalizedPermissionSet).some((permission) =>
      permissionAliases.has(permission),
    );
  }, [normalizedPermissionSet, permissionAliases]);

  const permissionGateReady = queueIsApiMode && authReady && authIsAuthenticated;

  const hasServeTicketPermission = useMemo(() => {
    if (hasExplicitServePermission) return true;
    if (!queueIsApiMode) return true;
    if (!permissionGateReady) {
      return normalizedRoleSet.has(Role.OPERATOR);
    }
    return false;
  }, [
    hasExplicitServePermission,
    queueIsApiMode,
    permissionGateReady,
    normalizedRoleSet,
  ]);

  const lacksServeTicketPermission =
    permissionGateReady && !hasServeTicketPermission;

  const isAdminLike =
    normalizedRoleSet.has(Role.ADMIN) || normalizedRoleSet.has(Role.SUPERADMIN);
  const showAdministrativeInsights = isAdminLike;
  const showTimingInsights = isAdminLike;

  const { services: rawServicesList, error: servicesError } = useServices({
    requireAuth: queueIsApiMode && isAdminLike,
  });
  const servicesList = rawServicesList ?? [];

  const { addToast } = useToast();
  const showPermissionDeniedToast = useCallback(() => {
    addToast({
      type: "error",
      title: "Sin permisos para llamar turnos",
      description: SERVE_TICKETS_PERMISSION_MESSAGE,
    });
  }, [addToast]);

  const [assignedServiceIds, setAssignedServiceIds] = useState<number[] | null>(
    null,
  );
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedError, setAssignedError] = useState<string | null>(null);

  const [callingNext, setCallingNext] = useState(false);
  const [callNextReason, setCallNextReason] = useState<
    "manual" | "auto" | null
  >(null);
  const [statusLoading, setStatusLoading] = useState<Status | null>(null);
  const [reintegratingTicketId, setReintegratingTicketId] = useState<
    number | null
  >(null);
  const [availability, setAvailability] = useState<AvailabilityState | null>(
    null,
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [availabilityMutating, setAvailabilityMutating] =
    useState<AvailabilityState | null>(null);
  const [attentionTiming, setAttentionTiming] = useState<AttentionTimingState>({
    limitSeconds: null,
    elapsedSeconds: null,
    remainingSeconds: null,
    exceededSeconds: null,
  });

  const callNextButtonRef = useRef<HTMLButtonElement | null>(null);
  const attendButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousTicketIdRef = useRef<number | null>(null);

  const isFocusOnDifferentInteractiveElement = useCallback(
    (target: HTMLButtonElement | null) => {
      if (typeof document === "undefined") return false;
      if (!target) return false;

      const activeElement = document.activeElement as HTMLElement | null;
      if (!activeElement || activeElement === document.body) return false;
      if (!(activeElement instanceof HTMLElement)) return false;
      if (activeElement === target || target.contains(activeElement))
        return false;

      const interactiveSelector =
        "button, [role='button'], input, select, textarea, [contenteditable='true'], a[href], [tabindex]:not([tabindex='-1'])";
      const interactiveAncestor = activeElement.closest(interactiveSelector);

      if (!interactiveAncestor) return false;
      if (
        interactiveAncestor === target ||
        target.contains(interactiveAncestor)
      )
        return false;

      return true;
    },
    [],
  );

  const applyAvailabilityFromPayload = useCallback(
    (
      payload: AvailabilityPayload | null | undefined,
      fallback?: AvailabilityState | null,
    ) => {
      const resolved = resolveAvailabilityFromPayload(payload);
      const defaultAvailability: AvailabilityState | null =
        typeof (payload as any)?.active === "boolean"
          ? (payload as any).active
            ? "ACTIVE"
            : "OFF"
          : payload
          ? DEFAULT_OPERATOR_AVAILABILITY
          : null;
      setAvailability((prev) => {
        if (resolved) return resolved;
        if (fallback) return fallback;
        if (prev) return prev;
        return defaultAvailability;
      });
      return resolved ?? fallback ?? defaultAvailability ?? null;
    },
    [],
  );

  const refreshQueue = useCallback(async () => {
    if (queueIsApiMode && !authReady) return;
    setIsRefreshing(true);
    try {
      const updated = await refetch();
      if (updated) {
        setQueueSnapshot(updated);
      } else {
        setQueueSnapshot(getQueueStatus());
      }
    } catch (error) {
      console.error("[operator] refreshQueue error", error);
      setQueueSnapshot(getQueueStatus());
    } finally {
      setIsRefreshing(false);
    }
  }, [authReady, queueIsApiMode, refetch, getQueueStatus]);

  useEffect(() => {
    if (queueHasSnapshot) return;
    if (queueIsApiMode && !authReady) return;
    void refreshQueue();
  }, [queueHasSnapshot, queueIsApiMode, authReady, refreshQueue]);

  useEffect(() => {
    if (!operatorId) {
      setAvailability(null);
      setAvailabilityError(null);
      setAvailabilityLoading(false);
      setAvailabilityMutating(null);
      return;
    }

    if (queueIsApiMode && lacksServeTicketPermission) {
      setAvailability(null);
      setAvailabilityError(null);
      setAvailabilityLoading(false);
      setAvailabilityMutating(null);
      return;
    }

    if (queueIsApiMode && !authReady) {
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      setAvailabilityMutating(null);
      return;
    }

    let cancelled = false;
    setAvailabilityMutating(null);
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    const loadAvailability = async () => {
      try {
        const payload =
          await apiClient.getOperatorAvailabilityStatus(operatorId);
        if (cancelled) return;
        applyAvailabilityFromPayload(payload);
      } catch (error) {
        if (cancelled) return;
        const message = getFriendlyApiErrorMessage(
          error,
          "No se pudo obtener la disponibilidad del operador.",
        );
        setAvailabilityError(message);
        console.error("[operator] loadAvailability error", error);
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [
    operatorId,
    applyAvailabilityFromPayload,
    queueIsApiMode,
    authReady,
    authToken,
    lacksServeTicketPermission,
  ]);

  useEffect(() => {
    if (!operatorId) return;
    if (queueIsApiMode && lacksServeTicketPermission) {
      setAssignedServiceIds(null);
      setAssignedLoading(false);
      setAssignedError(null);
      return;
    }
    if (queueIsApiMode && !authReady) {
      setAssignedLoading(true);
      setAssignedError(null);
      return;
    }
    let cancelled = false;

    const loadAssignedServices = async () => {
      setAssignedLoading(true);
      setAssignedError(null);
      try {
        const payload = await apiClient.getOperatorServices(operatorId);
        const rawServices = Array.isArray(payload?.services)
          ? payload.services
          : [];
        const activeServices = rawServices
          .filter((svc) => svc && isActiveFlag((svc as any).active))
          .map((svc) => Number((svc as any).id))
          .filter((id) => Number.isInteger(id) && id > 0);

        const fallbackIds = Array.isArray(payload?.serviceIds)
          ? payload.serviceIds
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          : [];

        const fallbackFromRaw = rawServices
          .map((svc) => Number((svc as any).id))
          .filter((id) => Number.isInteger(id) && id > 0);

        const resolvedIds =
          activeServices.length > 0
            ? activeServices
            : fallbackIds.length > 0
            ? fallbackIds
            : fallbackFromRaw;

        if (!cancelled) {
          setAssignedServiceIds(resolvedIds);
        }
      } catch (error) {
        if (!cancelled) {
          const message = getFriendlyApiErrorMessage(
            error,
            "No se pudieron obtener los servicios del operador.",
          );
          setAssignedError(message);
          setAssignedServiceIds(null);
          console.error("[operator] loadAssignedServices error", error);
        }
      } finally {
        if (!cancelled) {
          setAssignedLoading(false);
        }
      }
    };

    void loadAssignedServices();

    return () => {
      cancelled = true;
    };
  }, [
    operatorId,
    queueIsApiMode,
    authReady,
    authToken,
    lacksServeTicketPermission,
  ]);

  const { active: operatorActiveTicket } = useMemo(
    () => pickTicketsForOperator(queueSnapshot, operatorId),
    [queueSnapshot, operatorId],
  );

  const allowedServiceIds = useMemo(() => {
    if (assignedServiceIds === null) return null;
    const normalized = assignedServiceIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return new Set(normalized);
  }, [assignedServiceIds]);

  const operatorActiveServiceId = operatorActiveTicket
    ? Number(operatorActiveTicket.service?.id ?? operatorActiveTicket.serviceId)
    : null;

  const isActiveTicketAllowed = useMemo(() => {
    if (!operatorActiveTicket) return false;
    if (!allowedServiceIds) return true;
    if (allowedServiceIds.size === 0) return false;
    if (!operatorActiveServiceId || Number.isNaN(operatorActiveServiceId)) {
      return false;
    }
    return allowedServiceIds.has(operatorActiveServiceId);
  }, [operatorActiveTicket, allowedServiceIds, operatorActiveServiceId]);

  const currentTicket = isActiveTicketAllowed ? operatorActiveTicket : null;

  const filteredNextTickets = useMemo(() => {
    const all = queueSnapshot.nextTickets ?? [];
    if (!allowedServiceIds) return all;
    if (allowedServiceIds.size === 0) return [];
    return all.filter((ticket) => {
      const serviceId = Number(ticket.service?.id ?? ticket.serviceId);
      return Number.isFinite(serviceId) && allowedServiceIds.has(serviceId);
    });
  }, [queueSnapshot.nextTickets, allowedServiceIds]);

  const filteredAbsentTickets = useMemo(() => {
    const all = queueSnapshot.absentTickets ?? [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    const isFromToday = (value: Date | string | null | undefined) => {
      if (!value) return false;
      const date = value instanceof Date ? value : new Date(value);
      if (!Number.isFinite(date.getTime())) return false;
      return date >= todayStart && date < tomorrowStart;
    };

    const filteredByDay = all.filter((ticket) => {
      const reference = (ticket as any)?.absentAt ?? ticket.calledAt ?? ticket.createdAt;
      return isFromToday(reference);
    });

    if (!allowedServiceIds) return filteredByDay;
    if (allowedServiceIds.size === 0) return [];

    return filteredByDay.filter((ticket) => {
      const serviceId = Number(ticket.service?.id ?? ticket.serviceId);
      return Number.isFinite(serviceId) && allowedServiceIds.has(serviceId);
    });
  }, [queueSnapshot.absentTickets, allowedServiceIds]);

  const currentTicketStatusVisual = currentTicket
    ? TICKET_STATUS_VISUALS[currentTicket.status]
    : null;

  const aggregatedQueueEntries = useMemo(() => {
    const list = queueSnapshot.queues ?? [];
    if (!allowedServiceIds) return list;
    if (allowedServiceIds.size === 0) return [];
    return list.filter((service) =>
      allowedServiceIds.has(Number(service.id)),
    );
  }, [queueSnapshot.queues, allowedServiceIds]);

  const allowedServiceNames = useMemo(() => {
    return aggregatedQueueEntries
      .map((service) =>
        typeof (service as any)?.name === "string"
          ? ((service as any).name as string).trim()
          : "",
      )
      .filter((name) => name.length > 0);
  }, [aggregatedQueueEntries]);

  const allowedServiceSummary = useMemo(() => {
    if (allowedServiceNames.length === 0) return null;
    if (allowedServiceNames.length === 1) return allowedServiceNames[0];
    if (allowedServiceNames.length === 2)
      return `${allowedServiceNames[0]} y ${allowedServiceNames[1]}`;
    const [last, ...rest] = allowedServiceNames
      .slice()
      .reverse();
    return `${rest.reverse().join(", ")} y ${last}`;
  }, [allowedServiceNames]);

  const resolveServiceName = useCallback(
    (serviceId: number | null | undefined) => {
      const normalizedId = Number(serviceId);
      if (!Number.isFinite(normalizedId)) return null;

      const fromQueue = (queueSnapshot.queues ?? []).find(
        (service) => Number(service.id) === normalizedId,
      );
      const queueName =
        typeof (fromQueue as any)?.name === "string"
          ? (fromQueue as any).name.trim()
          : "";
      if (queueName) return queueName;

      const fromServices = servicesList.find(
        (service) => Number((service as any)?.id) === normalizedId,
      );
      const catalogName =
        typeof (fromServices as any)?.name === "string"
          ? (fromServices as any).name.trim()
          : "";
      if (catalogName) return catalogName;

      return null;
    },
    [queueSnapshot.queues, servicesList],
  );

  const currentTicketServiceName = useMemo(() => {
    if (!currentTicket) return null;
    const directName =
      typeof currentTicket.service?.name === "string"
        ? currentTicket.service.name.trim()
        : "";
    if (directName) return directName;
    const serviceId = Number(
      currentTicket.service?.id ?? currentTicket.serviceId ?? null,
    );
    return resolveServiceName(serviceId);
  }, [currentTicket, resolveServiceName]);

  const isServiceAllowed = useCallback(
    (serviceId: number | null | undefined) => {
      if (!serviceId || Number.isNaN(Number(serviceId))) return false;
      if (!allowedServiceIds) return true;
      if (allowedServiceIds.size === 0) return false;
      return allowedServiceIds.has(Number(serviceId));
    },
    [allowedServiceIds],
  );

  const waitingTicketsCount = useMemo(() => {
    const aggregated = aggregatedQueueEntries.reduce((sum, service) => {
      const value = Number((service as any)?.waitingCount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    if (aggregated > 0) return aggregated;
    return filteredNextTickets.length;
  }, [aggregatedQueueEntries, filteredNextTickets]);

  const absentTicketsCount = filteredAbsentTickets.length;

  const assignedServiceDisplayIds = useMemo(() => {
    if (allowedServiceIds && allowedServiceIds.size === 0) return [] as number[];
    if (allowedServiceIds) return Array.from(allowedServiceIds);
    return (queueSnapshot.queues ?? [])
      .map((service) => Number(service.id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }, [allowedServiceIds, queueSnapshot.queues]);

  const metrics: DashboardMetrics = useMemo(() => {
    const base = queueSnapshot.todayMetrics;
    if (aggregatedQueueEntries.length === 0) {
      return base;
    }
    const totalInQueue = aggregatedQueueEntries.reduce((sum, service) => {
      const value = Number((service as any)?.waitingCount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const attendedToday = aggregatedQueueEntries.reduce((sum, service) => {
      const value = Number((service as any)?.todayTickets);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const waitValues = aggregatedQueueEntries
      .map((service) => Number((service as any)?.averageTime))
      .filter((value) => Number.isFinite(value));

    const averageWaitTime =
      waitValues.length > 0
        ? Math.max(
            0,
            Math.round(
              waitValues.reduce((sum, value) => sum + value, 0) /
                waitValues.length,
            ),
          )
        : null;

    return {
      ...base,
      totalInQueue: totalInQueue || base.totalInQueue,
      attendedToday: attendedToday || base.attendedToday,
      averageWaitTime: averageWaitTime ?? base.averageWaitTime,
    };
  }, [queueSnapshot, aggregatedQueueEntries]);

  const metricsAttendedDisplay =
    typeof metrics.attendedToday === "number"
      ? String(metrics.attendedToday)
      : "—";
  const metricsAverageDisplay =
    typeof metrics.averageWaitTime === "number"
      ? `${metrics.averageWaitTime} min`
      : "—";
  const metricsQueueDisplay =
    typeof metrics.totalInQueue === "number"
      ? String(metrics.totalInQueue)
      : "—";

  const nextCallableServiceId = useMemo(() => {
    const firstTicket = filteredNextTickets[0];
    if (firstTicket) {
      const id = Number(firstTicket.service?.id ?? firstTicket.serviceId);
      if (Number.isFinite(id)) return id;
    }

    if (currentTicket) {
      const id = Number(currentTicket.service?.id ?? currentTicket.serviceId);
      if (Number.isFinite(id)) return id;
    }

    if (allowedServiceIds && allowedServiceIds.size === 0) {
      return null;
    }

    if (allowedServiceIds && allowedServiceIds.size > 0) {
      const [firstAllowed] = Array.from(allowedServiceIds);
      if (Number.isFinite(firstAllowed)) return firstAllowed;
    }

    const fallback = queueSnapshot.queues.find((service) => {
      const id = Number(service.id);
      if (!Number.isFinite(id)) return false;
      if (allowedServiceIds) {
        return allowedServiceIds.has(id);
      }
      return (service as any)?.active !== false;
    });
    const resolvedId = fallback ? Number(fallback.id) : NaN;
    return Number.isFinite(resolvedId) ? resolvedId : null;
  }, [
    filteredNextTickets,
    currentTicket,
    allowedServiceIds,
    queueSnapshot.queues,
  ]);

  const waitMinutes = (ticket: TicketWithRelations) => {
    const createdAt = asDate(ticket.createdAt);
    if (!createdAt) return 0;
    const diff = Date.now() - createdAt.getTime();
    return Math.max(0, Math.round(diff / 60000));
  };

  /* Autocall */
  const autoCallNextEnabled = useMemo(
    () => getBooleanSetting(queueState.settings, "autoCallNext", false),
    [queueState.settings],
  );
  const autoCallBadgeActive =
    autoCallNextEnabled && !lacksServeTicketPermission;

    const handleCallNext = useCallback(
    async (reason: "manual" | "auto" = "manual") => {
      if (currentTicket && reason === "manual") {
        if (currentTicket.status === Status.CALLED) {
          addToast({
            type: "info",
            title: "Ticket ya notificado",
            description: `El turno ${currentTicket.number}${
              currentTicketServiceName ? ` de ${currentTicketServiceName}` : ""
            } ya está siendo llamado. Esperá a que el cliente llegue o marcá la atención antes de pedir otro turno.`,
          });
          return null;
        }
        if (currentTicket.status === Status.IN_PROGRESS) {
          addToast({
            type: "info",
            title: "Atención en curso",
            description: `El turno ${currentTicket.number}${
              currentTicketServiceName ? ` de ${currentTicketServiceName}` : ""
            } ya está en atención. Finalizá o devolvé el turno antes de solicitar uno nuevo.`,
          });
          return null;
        }
      }

      if (!operatorId) {
        addToast({
          type: "error",
          title: "Sesión inválida",
          description: "No se encontró la información del operador.",
        });
        return null;
      }

      // Usamos nextCallableServiceId solo como heurística de “hay algo para atender”
      if (!nextCallableServiceId) {
        addToast({
          type: "info",
          title: "Sin tickets disponibles",
          description: allowedServiceSummary
            ? `No encontramos turnos pendientes en tus servicios habilitados (${allowedServiceSummary}) en este momento.`
            : "No encontramos turnos pendientes en tus servicios habilitados en este momento.",
        });
        return null;
      }

      if (queueIsApiMode && !authReady) {
        addToast({
          type: "info",
          title: "Validando sesión",
          description:
            "Estamos confirmando tus credenciales. Intentá nuevamente en unos segundos.",
        });
        return null;
      }

      if (assignedLoading) {
        addToast({
          type: "info",
          title: "Validando servicios habilitados",
          description:
            "Estamos comprobando qué servicios podés operar. Esperá unos segundos y volvé a intentar.",
        });
        return null;
      }

      if (!isServiceAllowed(nextCallableServiceId)) {
        addToast({
          type: "warning",
          title: "Servicio no habilitado",
          description:
            "No estás habilitado para operar los servicios que actualmente tienen tickets en la cola. Contactá a un supervisor para revisarlo.",
        });
        return null;
      }

      if (permissionGateReady && !hasServeTicketPermission) {
        showPermissionDeniedToast();
        return null;
      }

      setCallingNext(true);
      setCallNextReason(reason);

      try {
        // 🔴 AHORA SOLO LE PASAMOS EL operatorId
        const { ticket, error } = await requestCallNext(operatorId);

        if (error) {
          const message = getFriendlyApiErrorMessage(
            error,
            "No se pudo llamar al siguiente turno.",
          );
          addToast({
            type: "error",
            title: "Error al llamar turno",
            description: message,
          });
          return null;
        }

        if (ticket) {
          const assignedServiceName =
            resolveServiceName(
              Number(ticket.service?.id ?? ticket.serviceId ?? null),
            ) ??
            (typeof ticket.service?.name === "string"
              ? ticket.service.name
              : "Servicio");

          addToast({
            type: reason === "auto" ? "info" : "success",
            title:
              reason === "auto"
                ? "Nuevo ticket asignado automáticamente"
                : `Turno ${ticket.number} asignado`,
            description:
              reason === "auto"
                ? `${assignedServiceName} fue tomado automáticamente para mantener el ritmo de atención.`
                : `${assignedServiceName} está listo para ser atendido.`,
          });
        } else {
          addToast({
            type: "info",
            title:
              reason === "auto"
                ? "Sin tickets para asignar"
                : "No hay turnos en espera",
            description:
              reason === "auto"
                ? "El sistema buscó nuevos tickets en tus servicios habilitados, pero no encontró ninguno disponible."
                : "Tus servicios habilitados no tienen turnos disponibles en este momento.",
          });
        }

        await refreshQueue();
        return ticket;
      } finally {
        setCallingNext(false);
        setCallNextReason((prev) => (prev === reason ? null : prev));
      }
    },
    [
      operatorId,
      addToast,
      authReady,
      queueIsApiMode,
      assignedLoading,
      permissionGateReady,
      hasServeTicketPermission,
      showPermissionDeniedToast,
      nextCallableServiceId,
      isServiceAllowed,
      requestCallNext,
      refreshQueue,
      currentTicket,
      currentTicketServiceName,
      allowedServiceSummary,
      resolveServiceName,
    ],
  );


  const handleStatusChange = useCallback(
    async (status: Status) => {
      if (!currentTicket) return;
      if (permissionGateReady && !hasServeTicketPermission) {
        showPermissionDeniedToast();
        return;
      }
      setStatusLoading(status);
      try {
        const { ticket: updatedTicket, error } = await requestStatusChange(
          currentTicket.id,
          status,
          operatorId ?? undefined,
        );

        if (error) {
          const message = getFriendlyApiErrorMessage(
            error,
            "No se pudo actualizar el estado del turno.",
          );
          addToast({
            type: "error",
            title: "No se pudo actualizar el turno",
            description: message,
          });
          return;
        }

        if (updatedTicket) {
          setQueueSnapshot((prev) =>
            applyTicketUpdateToSnapshot(prev, updatedTicket),
          );
        }

        const statusLabel: Record<Status, string> = {
          [Status.IN_PROGRESS]: "Turno en atención",
          [Status.COMPLETED]: "Turno completado",
          [Status.ABSENT]: "Turno marcado como ausente",
          [Status.WAITING]: "Turno devuelto a la cola",
          [Status.CALLED]: "Turno llamado",
          [Status.CANCELLED]: "Turno cancelado",
        };
        addToast({
          type: "success",
          title: statusLabel[status] ?? "Estado actualizado",
          description: `El turno ${currentTicket.number} se actualizó correctamente.`,
        });

        const shouldAutoCall =
          autoCallNextEnabled &&
          (status === Status.COMPLETED || status === Status.ABSENT) &&
          operatorId &&
          (!queueIsApiMode || (authReady && hasServeTicketPermission)) &&
          nextCallableServiceId !== null &&
          isServiceAllowed(nextCallableServiceId);

        if (shouldAutoCall) {
          await handleCallNext("auto");
        } else {
          await refreshQueue();
        }
      } finally {
        setStatusLoading(null);
      }
    },
    [
      addToast,
      autoCallNextEnabled,
      currentTicket,
      handleCallNext,
      operatorId,
      queueIsApiMode,
      authReady,
      hasServeTicketPermission,
      permissionGateReady,
      refreshQueue,
      requestStatusChange,
      nextCallableServiceId,
      isServiceAllowed,
      showPermissionDeniedToast,
      setQueueSnapshot,
    ],
  );

  const handleAttendAbsentTicket = useCallback(
    async (ticket: TicketWithRelations) => {
      if (!operatorId) {
        addToast({
          type: "error",
          title: "Sesión inválida",
          description: "No se encontró la información del operador.",
        });
        return;
      }

      if (permissionGateReady && !hasServeTicketPermission) {
        showPermissionDeniedToast();
        return;
      }

      const serviceId = Number(ticket.service?.id ?? ticket.serviceId ?? null);
      if (!isServiceAllowed(serviceId)) {
        addToast({
          type: "error",
          title: "Servicio no disponible",
          description:
            "No estás habilitado para operar el servicio de este ticket ausente.",
        });
        return;
      }

      setReintegratingTicketId(ticket.id);
      try {
        const { ticket: calledTicket, error: callError } =
          await requestCallTicket(ticket.id, operatorId);

        if (callError || !calledTicket) {
          const message = getFriendlyApiErrorMessage(
            callError,
            "No se pudo asignar el ticket ausente para atención.",
          );
          addToast({
            type: "error",
            title: "No se pudo reasignar",
            description: message,
          });
          await refreshQueue();
          return;
        }

        setQueueSnapshot((prev) =>
          applyTicketUpdateToSnapshot(prev, calledTicket),
        );
        addToast({
          type: "success",
          title: "Ticket asignado",
          description: `El ticket ${calledTicket.number} fue reasignado para atención.`,
        });
        await refreshQueue();
      } finally {
        setReintegratingTicketId((prev) => (prev === ticket.id ? null : prev));
      }
    },
    [
      addToast,
      operatorId,
      permissionGateReady,
      hasServeTicketPermission,
      refreshQueue,
      requestCallTicket,
      showPermissionDeniedToast,
      isServiceAllowed,
    ],
  );

  /* Disparador de autocall al quedar libre */
  useEffect(() => {
    if (!autoCallNextEnabled) return;
    if (queueLoading) return;
    if (callingNext) return;
    if (statusLoading !== null) return;
    if (!operatorId || nextCallableServiceId === null) return;
    if (queueIsApiMode && !authReady) return;
    if (permissionGateReady && !hasServeTicketPermission) return;
    if (assignedLoading) return;
    if (!isServiceAllowed(nextCallableServiceId)) return;
    if (currentTicket) return;
    if (filteredNextTickets.length === 0) return;

    void handleCallNext("auto");
  }, [
    autoCallNextEnabled,
    assignedLoading,
    queueLoading,
    callingNext,
    statusLoading,
    operatorId,
    nextCallableServiceId,
    queueIsApiMode,
    authReady,
    permissionGateReady,
    hasServeTicketPermission,
    currentTicket,
    filteredNextTickets.length,
    handleCallNext,
    isServiceAllowed,
  ]);

  /* Estilos y textos de disponibilidad */
  const availabilitySuccessMessages = useMemo(
    () => ({
      ACTIVE: {
        title:
          availability === "OFF"
            ? "Jornada iniciada"
            : "Disponibilidad activada",
        description:
          availability === "OFF"
            ? "Se registró el inicio de tu jornada en el sistema."
            : "El backend confirmó que puedes recibir nuevos tickets.",
      },
      BREAK: {
        title: "Descanso registrado",
        description:
          "No se asignarán nuevos tickets mientras estés en descanso.",
      },
      OFF: {
        title: "Turno finalizado",
        description: "Se registró el cierre de tu jornada en el sistema.",
      },
    }),
    [availability],
  );

  const availabilityStyles: Record<
    AvailabilityState,
    { label: string; helper: string; tone: string }
  > = {
    ACTIVE: {
      label: "Disponible",
      helper: "Listo para recibir nuevos tickets",
      tone: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    BREAK: {
      label: "En descanso",
      helper: "No recibirás nuevos tickets durante la pausa",
      tone: "text-amber-600 bg-amber-50 border-amber-200",
    },
    OFF: {
      label: "Fuera de turno",
      helper: "Finalizaste tu jornada",
      tone: "text-gray-600 bg-gray-50 border-gray-200",
    },
  };

  const startAvailabilityLabel = useMemo(
    () => (availability === "OFF" ? "Iniciar jornada" : "Volver disponible"),
    [availability],
  );

  const currentAvailability = availability ?? DEFAULT_OPERATOR_AVAILABILITY;
  const availabilityConfig = availabilityStyles[currentAvailability];
  const availabilityLabel =
    availabilityMutating !== null
      ? "Actualizando disponibilidad"
      : availability
      ? availabilityConfig.label
      : availabilityLoading
      ? "Sincronizando disponibilidad"
      : "Disponibilidad no confirmada";
  const availabilityHelper =
    availabilityMutating !== null
      ? "Guardando cambios en el backend..."
      : availabilityLoading
      ? "Obteniendo el estado actual desde la API..."
      : availability
      ? availabilityConfig.helper
      : "Aún no se pudo determinar el estado real del operador.";
  const AvailabilityIndicatorIcon =
    availabilityLoading || availabilityMutating !== null ? Loader2 : Circle;
  const availabilityIndicatorClassName =
    availabilityLoading || availabilityMutating !== null
      ? "h-4 w-4 animate-spin"
      : "h-4 w-4";
  const availabilityBadgeClassName =
    AVAILABILITY_BADGE_STYLES[currentAvailability];
  const availabilityHeroBadgeClassName =
    currentAvailability === "ACTIVE"
      ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
      : currentAvailability === "BREAK"
      ? "border border-amber-400/40 bg-amber-500/20 text-amber-100"
      : "border border-slate-600/50 bg-slate-700/30 text-slate-100";

  const handleAvailabilityChange = useCallback(
    async (next: AvailabilityState) => {
      if (!operatorId) {
        addToast({
          type: "error",
          title: "Sesión inválida",
          description: "No se encontró la información del operador.",
        });
        return;
      }
      if (availabilityMutating !== null) return;

      setAvailabilityError(null);
      setAvailabilityMutating(next);

      try {
        const result = await apiClient.updateOperatorAvailabilityStatus(
          operatorId,
          next,
        );
        const confirmed = applyAvailabilityFromPayload(result, next);
        const effective: AvailabilityState = confirmed ?? next;
        const success = availabilitySuccessMessages[effective];
        addToast({
          type: "success",
          title: success.title,
          description: success.description,
        });
        await refreshQueue();
      } catch (error) {
        const message = getFriendlyApiErrorMessage(
          error,
          "No se pudo actualizar tu disponibilidad.",
        );
        setAvailabilityError(message);
        addToast({
          type: "error",
          title: "No se pudo actualizar la disponibilidad",
          description: message,
        });
        console.error("[operator] updateAvailability error", error);
      } finally {
        setAvailabilityMutating(null);
      }
    },
    [
      operatorId,
      availabilityMutating,
      addToast,
      applyAvailabilityFromPayload,
      availabilitySuccessMessages,
      refreshQueue,
    ],
  );

  /* Habilitaciones y atajos */
  const canCallNext =
    !callingNext &&
    !assignedLoading &&
    !currentTicket &&
    nextCallableServiceId !== null &&
    Boolean(operatorId) &&
    isServiceAllowed(nextCallableServiceId) &&
    (!queueIsApiMode || (authReady && hasServeTicketPermission));

  const canUpdateTicketStatus = Boolean(currentTicket) && !callingNext;
  const canUpdateAvailability =
    Boolean(operatorId) &&
    !availabilityLoading &&
    availabilityMutating === null;

  const operatorShortcuts = useMemo<KeyboardShortcut[]>(() => {
    const shortcuts: KeyboardShortcut[] = [];

    if (canCallNext) {
      const triggerCallNext = () => {
        if (
          callingNext ||
          !operatorId ||
          nextCallableServiceId === null ||
          currentTicket ||
          !isServiceAllowed(nextCallableServiceId)
        )
          return;
        void handleCallNext("manual");
      };

      shortcuts.push({
        key: "Enter",
        description: "Llamar siguiente ticket",
        action: triggerCallNext,
      });
    }

    if (canUpdateTicketStatus) {
      SHORTCUT_STATUS_ACTIONS.forEach(
        ({ keyHint, status, shortcutDescription }) => {
          if (statusLoading === status) return;
          shortcuts.push({
            key: keyHint,
            description: shortcutDescription,
            action: () => {
              if (!currentTicket || callingNext || statusLoading === status)
                return;
              void handleStatusChange(status);
            },
          });
        },
      );
    }

    if (canUpdateAvailability) {
      [
        {
          key: "v",
          state: "ACTIVE" as AvailabilityState,
          description: startAvailabilityLabel,
        },
        {
          key: "b",
          state: "BREAK" as AvailabilityState,
          description: "Marcar descanso",
        },
        {
          key: "f",
          state: "OFF" as AvailabilityState,
          description: "Finalizar jornada",
        },
      ].forEach(({ key, state, description }) => {
        shortcuts.push({
          key,
          description,
          action: () => {
            if (
              !operatorId ||
              availabilityLoading ||
              availabilityMutating !== null
            )
              return;
            void handleAvailabilityChange(state);
          },
        });
      });
    }

    return shortcuts;
  }, [
    availabilityLoading,
    availabilityMutating,
    canCallNext,
    canUpdateAvailability,
    canUpdateTicketStatus,
    callingNext,
    currentTicket,
    handleAvailabilityChange,
    handleCallNext,
    handleStatusChange,
    operatorId,
    nextCallableServiceId,
    isServiceAllowed,
    statusLoading,
    startAvailabilityLabel,
  ]);

  useKeyboardNavigation(operatorShortcuts);

  const keyboardShortcutHints = useMemo(() => {
    const hints: Array<{ key: string; label: string; active: boolean }> = [
      { key: "Enter", label: "Llamar siguiente ticket", active: canCallNext },
    ];
    SHORTCUT_STATUS_ACTIONS.forEach((action) => {
      hints.push({
        key: action.keyHint.toUpperCase(),
        label: action.label,
        active: canUpdateTicketStatus,
      });
    });
    hints.push(
      {
        key: "V",
        label: startAvailabilityLabel,
        active: canUpdateAvailability,
      },
      { key: "B", label: "Marcar descanso", active: canUpdateAvailability },
      { key: "F", label: "Finalizar jornada", active: canUpdateAvailability },
    );
    return hints;
  }, [
    canCallNext,
    canUpdateAvailability,
    canUpdateTicketStatus,
    startAvailabilityLabel,
  ]);

  /* Focus management */
  useEffect(() => {
    if (currentTicket || callingNext || statusLoading) return;
    const target = callNextButtonRef.current;
    if (!target) return;
    if (isFocusOnDifferentInteractiveElement(target)) return;
    target.focus();
  }, [
    currentTicket,
    callingNext,
    statusLoading,
    isFocusOnDifferentInteractiveElement,
  ]);

  useEffect(() => {
    const ticketId = currentTicket?.id ?? null;
    if (ticketId === null) {
      previousTicketIdRef.current = null;
      return;
    }
    if (ticketId === previousTicketIdRef.current) return;
    if (statusLoading !== null) return;
    const target = attendButtonRef.current;
    if (!target) {
      previousTicketIdRef.current = ticketId;
      return;
    }
    if (isFocusOnDifferentInteractiveElement(target)) {
      previousTicketIdRef.current = ticketId;
      return;
    }
    target.focus();
    previousTicketIdRef.current = ticketId;
  }, [currentTicket, statusLoading, isFocusOnDifferentInteractiveElement]);

  const isQueueRefreshing = queueStatusState === "loading" && queueHasSnapshot;
  const isRefreshInFlight = isQueueRefreshing || isRefreshing;

  /* Temporizador de atención (SLA) */
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const compute = () => {
      if (!currentTicket) {
        setAttentionTiming({
          limitSeconds: null,
          elapsedSeconds: null,
          remainingSeconds: null,
          exceededSeconds: null,
        });
        return false;
      }

      const limitMinutesRaw = currentTicket.service?.maxAttentionTime ?? null;
      const limitSeconds =
        limitMinutesRaw !== null &&
        limitMinutesRaw !== undefined &&
        !Number.isNaN(Number(limitMinutesRaw))
          ? Math.max(0, Math.round(Number(limitMinutesRaw) * 60))
          : null;

      const startedAt = asDate(currentTicket.startedAt);
      const storedElapsed =
        typeof currentTicket.attentionDuration === "number" &&
        Number.isFinite(currentTicket.attentionDuration)
          ? Math.max(0, Math.floor(currentTicket.attentionDuration))
          : null;
      const liveElapsed =
        currentTicket.status === Status.IN_PROGRESS && startedAt
          ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000))
          : null;

      const elapsedSeconds =
        currentTicket.status === Status.IN_PROGRESS
          ? (liveElapsed ?? storedElapsed)
          : storedElapsed ?? liveElapsed;

      const remainingSeconds =
        limitSeconds !== null && elapsedSeconds !== null
          ? limitSeconds - elapsedSeconds
          : limitSeconds;
      const exceededSeconds =
        limitSeconds !== null &&
        elapsedSeconds !== null &&
        elapsedSeconds > limitSeconds
          ? elapsedSeconds - limitSeconds
          : null;

      setAttentionTiming({
        limitSeconds,
        elapsedSeconds,
        remainingSeconds:
          remainingSeconds !== null ? Math.max(0, remainingSeconds) : null,
        exceededSeconds,
      });

      return currentTicket.status === Status.IN_PROGRESS && startedAt !== null;
    };

    const shouldTick = compute();

    if (shouldTick) {
      interval = setInterval(() => {
        compute();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTicket]);

  const primaryStatusActions = useMemo(
    () =>
      PRIMARY_STATUS_SEQUENCE.map((status) =>
        TICKET_STATUS_ACTIONS.find((action) => action.status === status),
      ).filter(Boolean) as TicketStatusAction[],
    [],
  );
  const secondaryStatusActions = useMemo(
    () =>
      TICKET_STATUS_ACTIONS.filter(
        (action) => !PRIMARY_STATUS_SEQUENCE.includes(action.status),
      ),
    [],
  );

  const attentionLimitSeconds = attentionTiming.limitSeconds;
  const attentionRemainingSeconds = attentionTiming.remainingSeconds;
  const attentionExceededSeconds = attentionTiming.exceededSeconds;
  const attentionElapsedSeconds = attentionTiming.elapsedSeconds;
  const isTicketInProgress =
    currentTicket?.status === Status.IN_PROGRESS &&
    Boolean(asDate(currentTicket?.startedAt));
  const attentionStartTimeLabel = useMemo(() => {
    if (!isTicketInProgress) return null;
    const startedAt = asDate(currentTicket?.startedAt);
    if (!startedAt) return null;
    try {
      return new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(startedAt);
    } catch (intlError) {
      try {
        return startedAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (localeError) {
        console.error(
          "[operator] unable to format attention start time",
          intlError ?? localeError,
        );
        return null;
      }
    }
  }, [currentTicket, isTicketInProgress]);
  const attentionCountdownActive = Boolean(
    currentTicket &&
      currentTicket.status === Status.IN_PROGRESS &&
      attentionLimitSeconds !== null,
  );
  const attentionHasExceeded =
    Boolean(attentionCountdownActive) &&
    attentionExceededSeconds !== null &&
    attentionExceededSeconds > 0;
  const attentionElapsedClock =
    attentionElapsedSeconds !== null
      ? formatSecondsToClock(attentionElapsedSeconds)
      : "--:--";
  const attentionRemainingClock =
    attentionRemainingSeconds !== null
      ? formatSecondsToClock(Math.max(0, attentionRemainingSeconds))
      : null;
  const attentionExceededClock =
    attentionExceededSeconds !== null
      ? formatSecondsToClock(Math.max(0, attentionExceededSeconds))
      : null;

  /* ------------------------------ Renderizado ------------------------------ */
  if (queueLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        <Spinner label="Cargando panel de tickets..." />
      </div>
    );
  }

  if (queueError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <Alert variant="destructive" className="max-w-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar el panel</AlertTitle>
          <AlertDescription>
            Error al cargar el panel de tickets. Contacte a soporte.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const stageKey: StageKey = currentTicket ? currentTicket.status : "IDLE";
  const stageTheme = STAGE_THEMES[stageKey];
  const stageBackdropClassName = STAGE_BACKDROP_GRADIENTS[stageKey];

  const attentionPrimaryValue = attentionElapsedClock;
  const attentionPrimaryLabel = "Tiempo transcurrido";
  const attentionStateLabel = (() => {
    if (!currentTicket) return "Sin atención";
    if (attentionCountdownActive) {
      if (attentionHasExceeded) return "Fuera de objetivo";
      return "Dentro del objetivo";
    }
    if (isTicketInProgress) return "Seguimiento en vivo";
    if (currentTicket.status === Status.CALLED) return "Ticket llamado";
    if (currentTicket.status === Status.COMPLETED) return "Atención finalizada";
    return "Estado actual";
  })();
  const attentionHelperText = (() => {
    if (attentionHasExceeded) {
      return `Superaste el tiempo objetivo de ${formatSecondsVerbose(attentionLimitSeconds)}.`;
    }
    if (attentionCountdownActive && attentionRemainingClock) {
      return `Quedan ${attentionRemainingClock} para cumplir con el objetivo.`;
    }
    if (attentionLimitSeconds !== null && attentionElapsedSeconds !== null) {
      return `Han transcurrido ${formatSecondsVerbose(
        attentionElapsedSeconds,
      )} de un objetivo de ${formatSecondsVerbose(attentionLimitSeconds)}.`;
    }
    if (attentionElapsedSeconds !== null) {
      return `Han transcurrido ${formatSecondsVerbose(
        attentionElapsedSeconds,
      )} desde el inicio de la atención.`;
    }
    if (isTicketInProgress) {
      return "El cronómetro está registrando el servicio en tiempo real.";
    }
    return "Inicia la atención para comenzar a medir el servicio en pantalla.";
  })();

  const attentionMetaEntries: Array<{
    label: string;
    value: string;
    tone?: string;
  }> = [];
  if (attentionLimitSeconds !== null) {
    attentionMetaEntries.push({
      label: "Tiempo estimado",
      value: formatSecondsVerbose(attentionLimitSeconds),
    });
  }
  if (attentionElapsedSeconds !== null) {
    attentionMetaEntries.push({
      label: "Tiempo transcurrido",
      value: formatSecondsVerbose(attentionElapsedSeconds),
    });
  }
  if (
    attentionCountdownActive &&
    !attentionHasExceeded &&
    attentionRemainingSeconds !== null
  ) {
    attentionMetaEntries.push({
      label: "Tiempo restante",
      value: formatSecondsVerbose(attentionRemainingSeconds),
    });
  }
  if (attentionHasExceeded && attentionExceededSeconds !== null) {
    attentionMetaEntries.push({
      label: "Retraso",
      value: `+${formatSecondsVerbose(attentionExceededSeconds)}`,
      tone: "text-rose-200",
    });
  }

  const attentionOverrunHelperText =
    attentionHasExceeded && attentionExceededSeconds !== null
      ? `Exceso de ${formatSecondsVerbose(attentionExceededSeconds)} sobre el objetivo.`
      : null;

  const timerContainerClassName = attentionHasExceeded
    ? "border-rose-400/40 bg-rose-500/15 text-rose-50 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]"
    : attentionCountdownActive
    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
    : "border-white/10 bg-slate-900/40 text-slate-100 shadow-[0_0_0_1px_rgba(148,163,184,0.15)]";
  const timerLabelClassName = attentionHasExceeded
    ? "text-rose-200/80"
    : attentionCountdownActive
    ? "text-emerald-200/80"
    : "text-slate-300/80";
  const timerStateClassName = attentionHasExceeded
    ? "text-rose-100"
    : attentionCountdownActive
    ? "text-emerald-100"
    : "text-slate-200";
  const timerHelperColorClass = attentionHasExceeded
    ? "text-rose-100/80"
    : attentionCountdownActive
    ? "text-emerald-100/80"
    : "text-slate-200/80";

  const renderStatusButton = (
    action: TicketStatusAction,
    layout: "primary" | "secondary" = "primary",
  ) => {
    const Icon = action.icon;
    const isLoading = statusLoading === action.status;
    const currentStatus = currentTicket?.status ?? null;
    const transitionAllowed = currentStatus
      ? isTransitionAllowed(currentStatus, action.status)
      : false;
    const disabled =
      isLoading ||
      callingNext ||
      !currentTicket ||
      (currentStatus !== null && !transitionAllowed);
    const showShortcut = Boolean(action.keyHint);
    const displayShortcut = showShortcut && !isLoading && action.badgeClassName;
    const layoutHeightClass =
      layout === "primary" ? "lg:min-h-[4.5rem]" : "lg:min-h-[3.5rem]";
    return (
      <Button
        key={action.status}
        ref={action.status === Status.IN_PROGRESS ? attendButtonRef : undefined}
        onClick={() => void handleStatusChange(action.status)}
        disabled={disabled}
        variant={action.variant ?? "default"}
        className={cn(
          "flex min-h-[3.5rem] w-full items-center justify-center overflow-hidden rounded-2xl px-4 py-3 text-center text-sm font-semibold leading-tight transition-all sm:min-h-[3.5rem] sm:text-base lg:rounded-2xl",
          layoutHeightClass,
          "shadow-lg shadow-slate-900/20",
          action.buttonClassName,
        )}
        title={
          !currentTicket
            ? "No hay ticket activo"
            : currentStatus !== null && !transitionAllowed
            ? "La acción no está disponible para el estado actual"
            : undefined
        }
      >
        <span className="flex w-full min-w-0 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-left">
            {isLoading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <Icon className="h-5 w-5 shrink-0" />
            )}
            <span className="min-w-0 break-words leading-tight">
              {action.label}
            </span>
          </span>
          {displayShortcut && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 whitespace-nowrap text-[0.6rem] font-semibold uppercase tracking-[0.3em]",
                action.badgeClassName,
              )}
            >
              {action.keyHint}
            </Badge>
          )}
        </span>
      </Button>
    );
  };

  return (
    <div className="flex min-h-full w-full flex-1 flex-col text-slate-900">
      <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-3 sm:p-3 lg:gap-5 lg:p-3">
        {/* Contenedores necesarios para conservar el padding global al 100% de zoom */}
        <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-3 sm:p-3 lg:gap-5 lg:p-3">
          {/* Acción principal: llamar siguiente */}
          <section className="isolate grid w-full grid-cols-1 gap-6 lg:gap-8 xl:gap-10">
            <Card
              className={cn(
                "relative w-full overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 shadow-xl sm:rounded-3xl lg:rounded-[2.25rem]",
                isTicketInProgress &&
                  "ring-2 ring-emerald-400/70 shadow-[0_35px_80px_-35px_rgba(16,185,129,0.75)]",
              )}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stageBackdropClassName}`}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.12),_transparent_65%)] opacity-70"
                aria-hidden
              />
              <CardHeader className="relative z-10 p-3 sm:p-6 lg:p-8 pb-0">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em]">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${stageTheme.badgeClassName}`}
                      >
                        {stageTheme.label}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[0.6rem] text-slate-200/80">
                        Flujo de atención
                      </span>
                    </div>
                    <div className="space-y-2">
                      <CardTitle
                        className={`text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight ${stageTheme.accentClassName}`}
                      >
                        {currentTicket
                          ? "Atención en tiempo real"
                          : "Listo para iniciar un nuevo turno"}
                      </CardTitle>
                      <CardDescription
                        className={`max-w-2xl text-sm sm:text-base leading-relaxed ${stageTheme.helperClassName}`}
                      >
                        {stageTheme.description}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      ref={callNextButtonRef}
                      onClick={() => void handleCallNext("manual")}
                      disabled={
                        callingNext ||
                        nextCallableServiceId === null ||
                        !operatorId ||
                        assignedLoading ||
                        !isServiceAllowed(nextCallableServiceId) ||
                        (queueIsApiMode && !authReady) ||
                        lacksServeTicketPermission
                      }
                      className={cn(
                        "flex min-h-[3.25rem] w-full min-w-[3.75rem] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 text-sm font-semibold uppercase tracking-[0.15em] leading-none text-white shadow-[0_25px_70px_-25px_rgba(6,182,212,0.7)] transition hover:from-emerald-500 hover:via-cyan-500 hover:to-sky-600 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                        "sm:min-h-[3.25rem] sm:min-w-0 sm:flex-1 sm:rounded-3xl sm:text-base lg:text-lg",
                      )}
                    >
                      {callingNext ? (
                        <span className="flex items-center justify-center gap-3 min-w-0 whitespace-normal break-words text-center">
                          <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin shrink-0" />
                          <span className="truncate">
                            {callNextReason === "auto"
                              ? "Llamando automáticamente..."
                              : "Llamando siguiente"}
                          </span>
                          {callNextReason === "auto" && (
                            <Badge
                              variant="outline"
                              className="border-white/40 bg-white/10 text-white shrink-0 whitespace-nowrap"
                            >
                              Auto
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-3 min-w-0 whitespace-normal break-words text-center">
                          <Phone className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                          <span className="truncate">Llamar siguiente</span>
                          <Badge
                            variant="outline"
                            className="border-white/40 bg-white/10 text-white shrink-0 whitespace-nowrap"
                          >
                            Enter
                          </Badge>
                          {autoCallBadgeActive && (
                            <Badge
                              variant="outline"
                              className="border-white/40 bg-white/10 text-white shrink-0 whitespace-nowrap"
                            >
                              Auto
                            </Badge>
                          )}
                        </span>
                      )}
                    </Button>

                    <div className="flex items-center justify-end">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-slate-200/80">
                        Atajos V · B · F
                      </span>
                    </div>
                  </div>
                </div>

                {isTicketInProgress && currentTicket && (
                  <div
                    role="status"
                    className="relative z-10 mt-6 flex items-start gap-3 rounded-2xl border border-emerald-300/60 bg-emerald-500/15 px-4 py-3 text-emerald-50 shadow-[0_25px_60px_-30px_rgba(16,185,129,0.6)] backdrop-blur-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/30 text-emerald-50">
                      <PlayCircle className="h-5 w-5 animate-pulse" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-100/80">
                        Atención iniciada
                      </p>
                      <p className="text-sm sm:text-base font-semibold leading-snug text-emerald-50">
                        Estás atendiendo el turno {currentTicket.number}
                      </p>
                      {currentTicketServiceName && (
                        <p className="text-xs sm:text-sm text-emerald-100/80">
                          Servicio: {currentTicketServiceName}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-emerald-100/80">
                        {attentionStartTimeLabel
                          ? `Inicio registrado a las ${attentionStartTimeLabel}.`
                          : "Registramos el inicio de la atención en el sistema."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] ${availabilityHeroBadgeClassName}`}
                  >
                    <AvailabilityIndicatorIcon className="h-3 w-3" />
                    {availabilityLabel}
                  </Badge>
                </div>

                {callingNext && callNextReason === "auto" && (
                  <div className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow-[0_15px_35px_-20px_rgba(16,185,129,0.6)]">
                    <Sparkles className="h-4 w-4" />
                    El sistema está anticipando el próximo ticket por vos.
                  </div>
                )}
              </CardHeader>

              <CardContent className="relative z-10 p-3 sm:p-6 lg:p-8 pt-4 sm:pt-6">
                {currentTicket ? (
                  <div className="grid gap-6 lg:gap-8 xl:grid-cols-1">
                    <div className="space-y-6">
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300/80">
                              Ticket
                            </p>
                            <p className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                              {currentTicket.number}
                            </p>
                            <p className="text-sm sm:text-base text-slate-200/80">
                              {currentTicket.service?.name ??
                                "Servicio sin nombre"}
                            </p>
                            {currentTicket.client && (
                              <p className="text-xs sm:text-sm text-slate-300/80">
                                {currentTicket.client.name}
                              </p>
                            )}
                          </div>
                          {currentTicketStatusVisual && (
                            <div className="flex flex-col items-end gap-1 text-right">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${currentTicketStatusVisual.tone}`}
                              >
                                {currentTicketStatusVisual.label}
                              </span>
                              <p className="text-[0.7rem] text-slate-200/80">
                                {currentTicketStatusVisual.helper}
                              </p>
                            </div>
                          )}
                        </div>

                        {showTimingInsights && (
                          <div
                            className={`mt-6 rounded-3xl border px-5 py-5 sm:px-6 ${timerContainerClassName}`}
                          >
                            <p
                              className={`text-[0.6rem] font-semibold uppercase tracking-[0.4em] ${timerLabelClassName}`}
                            >
                              Cronómetro de atención
                            </p>
                            <div className="mt-4 flex flex-wrap items-baseline gap-3">
                              <span className="text-3xl sm:text-4xl font-semibold tabular-nums leading-none">
                                {attentionPrimaryValue}
                              </span>
                              <span
                                className={`text-xs sm:text-sm font-semibold uppercase tracking-[0.35em] ${timerStateClassName}`}
                              >
                                {attentionPrimaryLabel}
                              </span>
                            </div>
                            <p
                              className={`mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] ${timerStateClassName}`}
                            >
                              {attentionStateLabel}
                            </p>
                            <p
                              className={`mt-3 text-xs sm:text-sm leading-relaxed ${timerHelperColorClass}`}
                            >
                              {attentionHelperText}
                            </p>
                            {attentionHasExceeded && attentionExceededClock && (
                              <div className="mt-4 rounded-2xl border border-rose-200/60 bg-rose-500/20 px-4 py-4 text-rose-50 shadow-inner shadow-rose-900/20">
                                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-rose-100/80">
                                  Tiempo excedido
                                </p>
                                <div className="mt-3 flex flex-wrap items-baseline gap-3">
                                  <span className="text-2xl sm:text-3xl font-semibold tabular-nums leading-none">
                                    +{attentionExceededClock}
                                  </span>
                                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-rose-100">
                                    Fuera de objetivo
                                  </span>
                                </div>
                                {attentionOverrunHelperText && (
                                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-rose-50/80">
                                    {attentionOverrunHelperText}
                                  </p>
                                )}
                              </div>
                            )}
                            {attentionMetaEntries.length > 0 && (
                              <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {attentionMetaEntries.map((entry) => (
                                  <div
                                    key={entry.label}
                                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200/80"
                                  >
                                    <dt className="font-medium text-slate-300/80">
                                      {entry.label}
                                    </dt>
                                    <dd
                                      className={`font-semibold text-right tabular-nums ${entry.tone ?? "text-slate-100"}`}
                                    >
                                      {entry.value}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5 sm:p-6 backdrop-blur-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400/80">
                          Atajos disponibles
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {SHORTCUT_STATUS_ACTIONS.map((action) => {
                            const isActive =
                              currentTicket?.status === action.status;
                            return (
                              <span
                                key={action.status}
                                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] transition ${
                                  isActive
                                    ? "border-white/20 bg-white/15 text-white shadow-inner shadow-white/20"
                                    : "border-white/10 bg-white/5 text-slate-200/80"
                                }`}
                              >
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    isActive
                                      ? "bg-white/30 text-white"
                                      : "bg-white/10 text-slate-200"
                                  }`}
                                >
                                  {action.keyHint}
                                </span>
                                {action.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 sm:p-6 backdrop-blur-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400/80">
                          Acciones de estado
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          {primaryStatusActions.map((action) =>
                            renderStatusButton(action, "primary"),
                          )}
                        </div>
                        {secondaryStatusActions.length > 0 && (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {secondaryStatusActions.map((action) =>
                              renderStatusButton(action, "secondary"),
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 sm:p-6 text-sm text-slate-200/80">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400/80">
                          Sugerencia
                        </p>
                        <p className="mt-3 leading-relaxed">
                          Finaliza la atención cuando completes el servicio para
                          registrar tiempos reales y continuar con el flujo
                          recomendado.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-white/25 bg-slate-950/40 p-8 sm:p-12 text-center backdrop-blur-sm">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white shadow-inner shadow-black/30">
                      <Phone className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-semibold text-white">
                        Sin ticket activo
                      </p>
                      <p className="text-sm text-slate-300/80">
                        Presiona “Llamar siguiente” para iniciar la próxima
                        atención y continuar con el flujo recomendado.
                      </p>
                    </div>
                    <Button
                      onClick={() => void handleCallNext("manual")}
                      disabled={
                        callingNext ||
                        nextCallableServiceId === null ||
                        !operatorId ||
                        assignedLoading ||
                        !isServiceAllowed(nextCallableServiceId) ||
                        (queueIsApiMode && !authReady) ||
                        lacksServeTicketPermission
                      }
                      className={cn(
                        "flex min-h-[3.5rem] w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 text-sm font-semibold uppercase tracking-[0.2em] leading-none text-white shadow-[0_20px_45px_-20px_rgba(6,182,212,0.65)] transition hover:from-emerald-500 hover:via-cyan-500 hover:to-sky-600 focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                        "sm:min-h-[3.5rem] sm:rounded-3xl sm:text-base",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Phone className="h-5 w-5 shrink-0" />
                        <span className="truncate">Llamar siguiente</span>
                      </span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Tickets en espera / Disponibilidad */}
          <section className="grid w-full gap-6 lg:gap-8 md:grid-cols-[1.35fr,1fr]">
            <div className="space-y-6">
              <Card className="w-full rounded-2xl border border-gray-100 bg-white shadow-xl sm:rounded-[2rem]">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Tickets en espera
                  </CardTitle>
                  <CardDescription>
                    {waitingTicketsCount > 0
                      ? `Hay ${waitingTicketsCount} tickets esperando en tus servicios habilitados.`
                      : "No hay tickets en espera en tus servicios habilitados en este momento."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-2.5">
                    <span className="text-sm font-semibold text-indigo-600">
                      En espera
                    </span>
                    <span className="text-2xl font-bold text-indigo-900">
                      {waitingTicketsCount}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {filteredNextTickets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                        No hay tickets en espera en tus servicios habilitados
                        por el momento.
                      </div>
                    ) : (
                      <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
                        {filteredNextTickets.slice(0, 8).map((ticket) => (
                          <div
                            key={ticket.id}
                            className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-semibold text-gray-900 shadow">
                                {ticket.number}
                              </div>
                              <div className="space-y-1">
                                <p className="max-w-[14rem] truncate text-sm font-semibold text-gray-900 sm:max-w-[18rem]">
                                  {ticket.service?.name}
                                </p>
                                {ticket.client && (
                                  <p className="max-w-[14rem] truncate text-xs text-gray-500 sm:max-w-[18rem]">
                                    {ticket.client.name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                              <Badge
                                variant={
                                  ticket.priority > 1
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="truncate"
                              >
                                {ticket.priority > 1 ? "Prioridad" : "Normal"}
                              </Badge>
                              <div className="flex items-center text-sm text-gray-500">
                                <Clock className="mr-1 h-4 w-4" />{" "}
                                {waitMinutes(ticket)} min
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="w-full rounded-2xl border border-amber-100 bg-white shadow-xl sm:rounded-[2rem]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <UserX className="h-5 w-5 text-amber-500" />
                    Tickets ausentes
                  </CardTitle>
                  <CardDescription>
                    {absentTicketsCount > 0
                      ? `Hay ${absentTicketsCount} tickets marcados como ausentes en tus servicios habilitados.`
                      : "No hay tickets ausentes en tus servicios habilitados en este momento."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5">
                    <span className="text-sm font-semibold text-amber-700">
                      Ausentes
                    </span>
                    <span className="text-2xl font-bold text-amber-900">
                      {absentTicketsCount}
                    </span>
                  </div>
                  {filteredAbsentTickets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-amber-200/70 p-6 text-center text-sm text-amber-600/80">
                      No hay tickets ausentes en tus servicios habilitados.
                    </div>
                  ) : (
                    <div className="max-h-[18rem] space-y-3 overflow-y-auto pr-1">
                      {filteredAbsentTickets.slice(0, 6).map((ticket) => {
                        const isReintegrating =
                          reintegratingTicketId === ticket.id;
                        return (
                          <div
                            key={ticket.id}
                            className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-base font-semibold text-amber-900 shadow">
                                {ticket.number}
                              </div>
                              <div className="space-y-1">
                                <p className="max-w-[14rem] truncate text-sm font-semibold text-amber-900 sm:max-w-[18rem]">
                                  {ticket.service?.name}
                                </p>
                                {ticket.client && (
                                  <p className="max-w-[14rem] truncate text-xs text-amber-700 sm:max-w-[18rem]">
                                    {ticket.client.name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <Button
                                variant="secondary"
                                className="h-10 rounded-xl border border-amber-300 bg-white text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                                disabled={isReintegrating}
                                onClick={() =>
                                  void handleAttendAbsentTicket(ticket)
                                }
                              >
                                {isReintegrating ? (
                                  <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />{" "}
                                    Reasignando...
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <RotateCcw className="h-4 w-4" />
                                    <span>Atender ahora</span>
                                  </span>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="w-full rounded-2xl border border-gray-100 bg-white shadow-xl sm:rounded-[2rem]">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Servicios asignados
                </CardTitle>
                <CardDescription>
                  El sistema distribuirá los turnos pendientes entre tus servicios habilitados de forma automática.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignedLoading ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Validando servicios asignados...
                  </div>
                ) : allowedServiceIds && allowedServiceIds.size === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    No tenés servicios habilitados para operar. Contactá a un supervisor.
                  </div>
                ) : assignedServiceDisplayIds.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    Aún no se detectaron servicios disponibles en la cola actual.
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {assignedServiceDisplayIds.map((serviceId) => {
                      const service =
                        servicesList.find((svc) => Number(svc.id) === Number(serviceId)) ??
                        queueSnapshot.queues.find((svc) => Number(svc.id) === Number(serviceId));
                      if (!service) return null;
                      return (
                        <li
                          key={serviceId}
                          className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                        >
                          <span className="min-w-0 truncate font-semibold">
                            {service.name ?? `Servicio ${serviceId}`}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-indigo-200 bg-indigo-50 text-xs text-indigo-700"
                          >
                            ID {serviceId}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="w-full rounded-2xl border border-gray-100 bg-white shadow-xl sm:rounded-[2rem]">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Estado de turno
                </CardTitle>
                <CardDescription>
                  Gestiona tu disponibilidad para controlar cuándo recibir nuevos
                  tickets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${availabilityConfig.tone}`}
                >
                  <AvailabilityIndicatorIcon
                    className={availabilityIndicatorClassName}
                  />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide">
                      {availabilityLabel}
                    </p>
                    <p className="text-xs opacity-80">{availabilityHelper}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    className="h-12 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    onClick={() => void handleAvailabilityChange("ACTIVE")}
                    disabled={
                      availabilityLoading ||
                      availabilityMutating !== null ||
                      !operatorId
                    }
                  >
                    {availabilityMutating === "ACTIVE" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                      </span>
                    ) : (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-left">
                          {startAvailabilityLabel}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-emerald-300 bg-white text-emerald-700"
                        >
                          V
                        </Badge>
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-12 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    onClick={() => void handleAvailabilityChange("BREAK")}
                    disabled={
                      availabilityLoading ||
                      availabilityMutating !== null ||
                      !operatorId
                    }
                  >
                    {availabilityMutating === "BREAK" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                      </span>
                    ) : (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-left">
                          Marcar ausente / descanso
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-300 bg-white text-amber-700"
                        >
                          B
                        </Badge>
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-12 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 sm:col-span-2"
                    onClick={() => void handleAvailabilityChange("OFF")}
                    disabled={
                      availabilityLoading ||
                      availabilityMutating !== null ||
                      !operatorId
                    }
                  >
                    {availabilityMutating === "OFF" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                      </span>
                    ) : (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-left">
                          Completar turno / finalizar jornada
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-rose-300 bg-white text-rose-700"
                        >
                          F
                        </Badge>
                      </span>
                    )}
                  </Button>
                </div>

              </CardContent>
            </Card>
          </section>

          {/* Detalle + rendimiento */}
          <section className="grid w-full gap-3 sm:gap-6 md:grid-cols-[1.35fr,1fr]">
            <Card className="w-full rounded-2xl sm:rounded-3xl border-0 shadow-lg ring-1 ring-gray-100">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Detalle del ticket activo
                </CardTitle>
                <CardDescription>
                  Información clave del turno que estás gestionando.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {currentTicket ? (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-indigo-500">
                            Turno
                          </p>
                          <p className="text-3xl font-semibold text-indigo-900">
                            {currentTicket.number}
                          </p>
                          <p className="text-sm text-indigo-600">
                            {currentTicket.service?.name ?? "Servicio sin nombre"}
                          </p>
                        </div>
                        {currentTicketStatusVisual && (
                          <span
                            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${currentTicketStatusVisual.tone}`}
                          >
                            {currentTicketStatusVisual.label}
                          </span>
                        )}
                      </div>
                      {currentTicketStatusVisual && (
                        <p className="mt-2 text-xs text-indigo-600/80">
                          {currentTicketStatusVisual.helper}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          Cliente
                        </p>
                        <p className="text-base font-semibold text-gray-900">
                          {currentTicket.client?.name ?? "Cliente sin registrar"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          Tiempo en espera
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          {waitMinutes(currentTicket)} minutos
                        </p>
                      </div>
                      {showTimingInsights && attentionElapsedSeconds !== null && (
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-gray-400">
                            Tiempo en atención
                          </p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatSecondsVerbose(attentionElapsedSeconds)}
                          </p>
                        </div>
                      )}
                      <div className="space-y-1 sm:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          Notas
                        </p>
                        <p className="text-sm text-gray-600">
                          {currentTicket.notes?.length
                            ? currentTicket.notes
                            : "Sin notas adicionales registradas."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-2xl sm:rounded-3xl border border-dashed border-indigo-200 p-6 sm:p-8 text-center">
                    <Phone className="h-10 w-10 text-indigo-500" />
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-gray-900">
                        Sin ticket activo
                      </p>
                      <p className="text-sm text-gray-500">
                        Usa el botón "Llamar siguiente ticket" para recibir un
                        nuevo turno.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {showAdministrativeInsights && (
              <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-rose-600 p-3 sm:p-6 text-white shadow-lg">
                <div className="absolute inset-y-0 right-[-40%] h-[140%] w-[70%] rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex flex-col gap-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2 sm:max-w-[70%]">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                        Mi Puesto
                      </p>
                      <h1 className="text-3xl font-semibold">
                        Rendimiento del turno
                      </h1>
                      <p className="max-w-xl text-sm text-white/80">
                        Visualiza tu desempeño y mantén el control del servicio
                        asignado con información crítica en un solo lugar.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      className="flex items-center gap-2 rounded-2xl border border-white/30 bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/30"
                      onClick={() => void refreshQueue()}
                      disabled={isRefreshInFlight}
                      aria-busy={isRefreshInFlight}
                    >
                      {isRefreshInFlight ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Actualizando...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4" /> Actualizar datos
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1.4fr,1fr]">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white/15 p-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                          <CheckCircle className="h-4 w-4" /> Tickets resueltos hoy
                        </div>
                        <div className="mt-2 text-3xl font-semibold">
                          {metricsAttendedDisplay}
                        </div>
                        <p className="text-sm text-white/70">
                          Sigue así, mantén la calidad en cada atención.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/15 p-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                          <Clock className="h-4 w-4" /> Tiempo promedio de atención
                        </div>
                        <div className="mt-2 text-3xl font-semibold">
                          {metricsAverageDisplay}
                        </div>
                        <p className="text-sm text-white/70">
                          Reduce la espera priorizando tickets críticos.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/15 p-3 sm:col-span-2">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                          <Users className="h-4 w-4" /> Tickets en cola
                        </div>
                        <div className="mt-2 text-3xl font-semibold">
                          {metricsQueueDisplay}
                        </div>
                        <p className="text-sm text-white/70">
                          Mantén el ritmo para evitar acumulaciones.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm text-white/90">
                      <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                        Próximo servicio sugerido
                      </p>
                      {nextCallableServiceId ? (
                        <div className="mt-2 space-y-1 text-sm">
                          <p>
                            {servicesList.find((svc) => Number(svc.id) === nextCallableServiceId)?.name ??
                              queueSnapshot.queues.find((svc) => Number(svc.id) === nextCallableServiceId)?.name ??
                              `Servicio ${nextCallableServiceId}`}
                          </p>
                          <p className="text-xs text-white/70">
                            Se tomará automáticamente el siguiente ticket disponible de este servicio.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-white/70">
                          No hay servicios con tickets pendientes para asignar en este momento.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Atajos */}
          <section className="w-full rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 bg-white/70 p-3 sm:p-3 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
              Atajos disponibles
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {keyboardShortcutHints.map((hint) => (
                <div
                  key={`${hint.key}-${hint.label}`}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                    hint.active
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-gray-200 bg-gray-50 text-gray-400"
                  }`}
                >
                  <span
                    className={`rounded bg-white px-2 py-0.5 text-xs font-semibold tracking-wider ${
                      hint.active ? "text-indigo-700" : "text-gray-400"
                    }`}
                  >
                    {hint.key}
                  </span>
                  <span className="text-[0.7rem] uppercase tracking-[0.2em]">
                    {hint.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Mensajes de estado */}
          {isRefreshInFlight && (
            <Alert variant="secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Actualizando información</AlertTitle>
              <AlertDescription>
                Obteniendo el estado más reciente de la cola...
              </AlertDescription>
            </Alert>
          )}
          {availabilityLoading && (
            <Alert variant="secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Sincronizando disponibilidad</AlertTitle>
              <AlertDescription>
                Consultando el estado actual confirmado por el backend...
              </AlertDescription>
            </Alert>
          )}
          {availabilityError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error de disponibilidad</AlertTitle>
              <AlertDescription>{availabilityError}</AlertDescription>
            </Alert>
          )}
          {servicesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error de servicios</AlertTitle>
              <AlertDescription>{servicesError}</AlertDescription>
            </Alert>
          )}
          {assignedError && (
            <Alert variant="accent">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No se pudieron cargar los servicios asignados</AlertTitle>
              <AlertDescription>{assignedError}</AlertDescription>
            </Alert>
          )}
          {!assignedLoading &&
            !assignedError &&
            operatorId &&
            Array.isArray(assignedServiceIds) &&
            assignedServiceIds.length === 0 && (
              <Alert variant="accent">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sin servicios habilitados</AlertTitle>
                <AlertDescription>
                  Tu usuario no tiene servicios asignados en este momento.
                  Contactá a un supervisor para habilitarte antes de llamar nuevos
                  turnos.
                </AlertDescription>
              </Alert>
            )}
          {lacksServeTicketPermission && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Permiso requerido</AlertTitle>
              <AlertDescription>
                {SERVE_TICKETS_PERMISSION_MESSAGE}
              </AlertDescription>
            </Alert>
          )}
          {!operatorId && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sin operador</AlertTitle>
              <AlertDescription>
                No pudimos identificar al operador autenticado.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

export { OperatorContent };

export default function OperatorPage() {
  const { state } = useAuth();
  const router = useRouter();
  const operatorId = state.user?.id ?? null;
  const role = state.user?.role;
  const isOperator = role === "OPERATOR";

  // Protección por rol con fallback centralizado
  useEffect(() => {
    if (state.isLoading) return;
    if (!role || isOperator) return;
    const fallback = getDefaultRouteForRole(role);
    router.replace(fallback);
  }, [state.isLoading, role, isOperator, router]);

  if (!state.isLoading && role && !isOperator) {
    return null;
  }

  return (
    <main className="relative z-0 flex min-h-dvh w-full flex-col overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-sky-100 antialiased">
      <OperatorContent operatorId={operatorId} />
    </main>
  );
}
