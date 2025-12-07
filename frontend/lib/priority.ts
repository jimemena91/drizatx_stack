export function normalizePriorityLevel(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const numeric = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(numeric)) return null
  const intValue = Math.trunc(numeric)
  if (intValue < 1) return 1
  if (intValue > 6) return 6
  return intValue
}

export function getPrioritySortValue(raw: unknown): number {
  const normalized = normalizePriorityLevel(raw)
  return normalized ?? Number.NEGATIVE_INFINITY
}

export function comparePriorityDesc(a: unknown, b: unknown): number {
  return getPrioritySortValue(b) - getPrioritySortValue(a)
}

export function toTimestamp(value: unknown, fallback = 0): number {
  if (!value) return fallback
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : fallback
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  const parsed = new Date(value as any)
  const time = parsed.getTime()
  return Number.isFinite(time) ? time : fallback
}

export function compareByPriorityDescAndDateAsc<T>(
  a: T,
  b: T,
  getPriority: (item: T) => unknown,
  getDate: (item: T) => unknown,
): number {
  const priorityDiff = comparePriorityDesc(getPriority(a), getPriority(b))
  if (priorityDiff !== 0) return priorityDiff
  return toTimestamp(getDate(a)) - toTimestamp(getDate(b))
}
