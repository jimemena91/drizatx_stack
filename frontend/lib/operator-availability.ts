import type { OperatorAvailabilityStatus } from "./api-client";

export const DEFAULT_OPERATOR_AVAILABILITY: OperatorAvailabilityStatus = "OFF";

export const OPERATOR_AVAILABILITY_ALIASES: Record<OperatorAvailabilityStatus, readonly string[]> = {
  ACTIVE: [
    "ACTIVE",
    "AVAILABLE",
    "ONLINE",
    "ON",
    "READY",
    "IDLE",
    "BUSY",
    "CALLING",
    "IN_PROGRESS",
  ],
  BREAK: ["BREAK", "PAUSE", "PAUSED", "AWAY", "REST", "BRB"],
  OFF: ["OFF", "OFFLINE", "INACTIVE", "FINISHED", "END", "DONE", "OUT"],
};

const OPERATOR_AVAILABILITY_ALIAS_ENTRIES = Object.entries(OPERATOR_AVAILABILITY_ALIASES).flatMap(
  ([availability, aliases]) => aliases.map((alias) => [alias, availability] as const),
);

const OPERATOR_AVAILABILITY_ALIAS_MAP = new Map<string, OperatorAvailabilityStatus>(
  OPERATOR_AVAILABILITY_ALIAS_ENTRIES,
);

export const normalizeOperatorAvailability = (
  value: unknown,
): OperatorAvailabilityStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return OPERATOR_AVAILABILITY_ALIAS_MAP.get(normalized) ?? null;
};
