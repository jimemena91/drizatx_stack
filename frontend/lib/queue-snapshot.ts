import { Status, type QueueStatus, type TicketWithRelations } from "@/lib/types"
import { compareByPriorityDescAndDateAsc, normalizePriorityLevel } from "@/lib/priority"

const ALL_STATUSES = new Set<Status>(Object.values(Status))

type SanitizedTicket = TicketWithRelations & { status: Status }

type TicketList = TicketWithRelations[]

type SanitizedList = SanitizedTicket[]

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

const toTimestamp = (value: Date | string | null | undefined): number => {
  const date = toDate(value)
  return date ? date.getTime() : 0
}

const normalizeStatus = (status: TicketWithRelations["status"]): Status | null => {
  if (!status) return null
  const raw = typeof status === "string" ? status.toUpperCase().trim() : status
  return ALL_STATUSES.has(raw as Status) ? (raw as Status) : null
}

const sanitizeTicket = (ticket: TicketWithRelations): SanitizedTicket => {
  const normalized = normalizeStatus(ticket.status) ?? Status.WAITING
  return {
    ...ticket,
    status: normalized,
    priority: normalizePriorityLevel(ticket.priority) ?? 0,
  } as SanitizedTicket
}

const dedupeById = (tickets: TicketList): SanitizedList => {
  const seen = new Set<number>()
  const result: SanitizedList = []
  tickets.forEach((ticket) => {
    if (!ticket) return
    const id = Number(ticket.id)
    if (!Number.isFinite(id) || seen.has(id)) return
    seen.add(id)
    result.push(sanitizeTicket(ticket))
  })
  return result
}

const sortInProgress = (tickets: SanitizedList): SanitizedList =>
  [...tickets].sort((a, b) => {
    const aRef = toTimestamp(a.startedAt ?? a.calledAt ?? a.createdAt)
    const bRef = toTimestamp(b.startedAt ?? b.calledAt ?? b.createdAt)
    return aRef - bRef
  })

const sortCalled = (tickets: SanitizedList): SanitizedList =>
  [...tickets].sort((a, b) => {
    const aRef = toTimestamp(a.calledAt ?? a.createdAt)
    const bRef = toTimestamp(b.calledAt ?? b.createdAt)
    return aRef - bRef
  })

const getRequeueTimestamp = (ticket: TicketWithRelations): number => {
  const raw = (ticket as any)?.requeuedAt ?? null
  if (!raw) return toTimestamp(ticket.createdAt)
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw.getTime() : toTimestamp(ticket.createdAt)
  const parsed = new Date(raw)
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : toTimestamp(ticket.createdAt)
}

const sortWaiting = (tickets: SanitizedList): SanitizedList =>
  [...tickets].sort((a, b) =>
    compareByPriorityDescAndDateAsc(
      a,
      b,
      (ticket) => ticket.priority,
      (ticket) => getRequeueTimestamp(ticket),
    ),
  )

const sortCompleted = (tickets: SanitizedList): SanitizedList =>
  [...tickets].sort((a, b) => {
    const aRef = toTimestamp(a.startedAt ?? a.completedAt ?? a.calledAt ?? a.createdAt)
    const bRef = toTimestamp(b.startedAt ?? b.completedAt ?? b.calledAt ?? b.createdAt)
    return bRef - aRef
  })

const sortAbsent = (tickets: SanitizedList): SanitizedList =>
  [...tickets].sort((a, b) => {
    const aRef = toTimestamp((a as any)?.absentAt ?? a.calledAt ?? a.createdAt)
    const bRef = toTimestamp((b as any)?.absentAt ?? b.calledAt ?? b.createdAt)
    return bRef - aRef
  })

const filterByStatus = (tickets: TicketList, status: Status): SanitizedList =>
  dedupeById(tickets.filter((ticket) => normalizeStatus(ticket.status) === status))

const aggregateNextTickets = (
  inProgress: SanitizedList,
  called: SanitizedList,
  waiting: SanitizedList,
  current: SanitizedTicket | null,
): SanitizedList => {
  const aggregated = [...inProgress, ...called, ...waiting]
  const seen = new Set<number>()
  const result: SanitizedList = []
  aggregated.forEach((ticket) => {
    if (current && ticket.id === current.id) return
    if (seen.has(ticket.id)) return
    seen.add(ticket.id)
    result.push(ticket)
  })
  return result
}

export function sanitizeQueueSnapshot(snapshot: QueueStatus): QueueStatus {
  const current = snapshot.currentTicket ? sanitizeTicket(snapshot.currentTicket) : null

  const inProgress = sortInProgress(filterByStatus(snapshot.inProgressTickets, Status.IN_PROGRESS))
  const called = sortCalled(filterByStatus(snapshot.calledTickets, Status.CALLED))
  const waiting = sortWaiting(filterByStatus(snapshot.waitingTickets, Status.WAITING))
  const absent = sortAbsent(filterByStatus(snapshot.absentTickets ?? [], Status.ABSENT))
  const completed = sortCompleted(
    filterByStatus(snapshot.recentlyCompletedTickets ?? [], Status.COMPLETED),
  ).slice(0, 5)

  let resolvedCurrent = current
  if (resolvedCurrent) {
    const status = normalizeStatus(resolvedCurrent.status)
    if (!status || ![Status.IN_PROGRESS, Status.CALLED, Status.WAITING].includes(status)) {
      resolvedCurrent = null
    }
  }

  if (!resolvedCurrent) {
    resolvedCurrent = inProgress[0] ?? called[0] ?? waiting[0] ?? null
  }

  const nextTickets = aggregateNextTickets(inProgress, called, waiting, resolvedCurrent)

  const sanitizedNext = dedupeById(snapshot.nextTickets).filter((ticket) => {
    if (resolvedCurrent && ticket.id === resolvedCurrent.id) return false
    const status = ticket.status
    if (status === Status.IN_PROGRESS) return inProgress.some((t) => t.id === ticket.id)
    if (status === Status.CALLED) return called.some((t) => t.id === ticket.id)
    if (status === Status.WAITING) return waiting.some((t) => t.id === ticket.id)
    return false
  })

  const mergedNext = aggregateNextTickets(
    inProgress,
    called,
    waiting,
    resolvedCurrent,
  )

  // Priorizar el orden calculado y completar con lo que venga del backend para no perder datos
  const mergedIds = new Set(mergedNext.map((ticket) => ticket.id))
  sanitizedNext.forEach((ticket) => {
    if (!mergedIds.has(ticket.id)) mergedNext.push(ticket)
  })

  return {
    ...snapshot,
    currentTicket: resolvedCurrent,
    inProgressTickets: inProgress,
    calledTickets: called,
    waitingTickets: waiting,
    absentTickets: absent,
    nextTickets: mergedNext,
    recentlyCompletedTickets: completed,
  }
}

export function applyTicketUpdateToSnapshot(
  snapshot: QueueStatus,
  updatedTicket: TicketWithRelations | null | undefined,
): QueueStatus {
  if (!updatedTicket) return snapshot

  const sanitizedSnapshot = sanitizeQueueSnapshot(snapshot)
  const ticket = sanitizeTicket(updatedTicket)

  const removeTicket = (tickets: SanitizedList): SanitizedList =>
    tickets.filter((item) => item.id !== ticket.id)

  let inProgress = removeTicket(sanitizedSnapshot.inProgressTickets)
  let called = removeTicket(sanitizedSnapshot.calledTickets)
  let waiting = removeTicket(sanitizedSnapshot.waitingTickets)
  let absent = removeTicket(sanitizedSnapshot.absentTickets ?? [])
  let completed = removeTicket(sanitizedSnapshot.recentlyCompletedTickets ?? [])

  switch (ticket.status) {
    case Status.IN_PROGRESS:
      inProgress = sortInProgress([...inProgress, ticket])
      break
    case Status.CALLED:
      called = sortCalled([...called, ticket])
      break
    case Status.WAITING:
      waiting = sortWaiting([...waiting, ticket])
      break
    case Status.ABSENT:
      absent = sortAbsent([...absent, ticket])
      break
    case Status.COMPLETED:
      completed = sortCompleted([ticket, ...completed]).slice(0, 5)
      break
    default:
      break
  }

  if (ticket.status !== Status.COMPLETED) {
    completed = completed.filter((item) => item.id !== ticket.id)
  }

  if (ticket.status !== Status.ABSENT) {
    absent = absent.filter((item) => item.id !== ticket.id)
  }

  let current = sanitizedSnapshot.currentTicket
  if (current && current.id === ticket.id) {
    if ([Status.IN_PROGRESS, Status.CALLED, Status.WAITING].includes(ticket.status)) {
      current = ticket
    } else {
      current = null
    }
  }

  if (!current && ticket.status === Status.IN_PROGRESS) {
    current = ticket
  }

  if (!current) {
    current = inProgress[0] ?? called[0] ?? waiting[0] ?? null
  }

  const nextTickets = aggregateNextTickets(inProgress, called, waiting, current ?? null)

  return sanitizeQueueSnapshot({
    ...sanitizedSnapshot,
    currentTicket: current,
    inProgressTickets: inProgress,
    calledTickets: called,
    waitingTickets: waiting,
    absentTickets: absent,
    nextTickets,
    recentlyCompletedTickets: completed,
  })
}
