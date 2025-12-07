import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

import { useQueueStatus } from "../use-queue-status"
import { Status } from "@/lib/types"
import type { DashboardResponse } from "@/lib/api-client"

const mockApiClient = {
  ping: vi.fn<[], Promise<void>>(() => Promise.resolve()),
  getQueueDashboard: vi.fn<[{ publicMode?: boolean }?], Promise<DashboardResponse>>(),
}

const mockUseQueue = vi.fn()
const mockUsePathname = vi.fn()

vi.mock("@/lib/api-client", () => ({
  apiClient: mockApiClient,
}))

vi.mock("@/contexts/queue-context", () => ({
  useQueue: () => mockUseQueue(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}))

describe("useQueueStatus - terminal mode", () => {
  const baseState = {
    services: [],
    operators: [],
    tickets: [],
    settings: [],
    clients: [],
    customMessages: [],
    currentTime: new Date(),
  }

  const dashboardPayload: DashboardResponse = {
    services: [
      {
        serviceId: 1,
        serviceName: "Caja",
        waitingCount: 2,
        avgWaitTime: 5,
        inProgressCount: 1,
        completedCountToday: 3,
        absentCountToday: 1,
        attendedCountToday: 4,
      },
    ],
    updatedAt: new Date("2024-01-01T10:00:00.000Z").toISOString(),
    currentTicket: {
      id: 101,
      number: "A001",
      serviceId: 1,
      operatorId: 5,
      clientId: null,
      status: Status.IN_PROGRESS,
      priority: 1,
      createdAt: new Date("2024-01-01T09:50:00.000Z").toISOString(),
      calledAt: new Date("2024-01-01T09:55:00.000Z").toISOString(),
      startedAt: new Date("2024-01-01T09:57:00.000Z").toISOString(),
      completedAt: null,
      attentionDuration: null,
      estimatedWaitTime: 4,
      actualWaitTime: 3,
      mobilePhone: null,
      notificationSent: 0 as any,
      service: {
        id: 1,
        name: "Caja",
        prefix: "A",
        active: true,
        priority: 1,
        estimatedTime: 5,
        maxAttentionTime: null,
        createdAt: new Date("2024-01-01T08:00:00.000Z").toISOString(),
        updatedAt: new Date("2024-01-01T09:00:00.000Z").toISOString(),
      } as any,
      operator: {
        id: 5,
        name: "Operador",
        username: "operador",
        email: "op@example.com",
        position: "Caja",
        active: true,
        createdAt: new Date("2024-01-01T08:00:00.000Z").toISOString(),
        updatedAt: new Date("2024-01-01T09:00:00.000Z").toISOString(),
      } as any,
      client: null,
      qrScannedAt: null,
    } as any,
    nextTickets: [],
    inProgressTickets: [],
    calledTickets: [],
    waitingTickets: [],
    absentTickets: [],
    recentlyCompletedTickets: [
      {
        id: 99,
        number: "A099",
        serviceId: 1,
        operatorId: 5,
        clientId: null,
        status: Status.COMPLETED,
        priority: 1,
        createdAt: new Date("2024-01-01T08:00:00.000Z").toISOString(),
        calledAt: new Date("2024-01-01T08:05:00.000Z").toISOString(),
        startedAt: new Date("2024-01-01T08:06:00.000Z").toISOString(),
        completedAt: new Date("2024-01-01T08:10:00.000Z").toISOString(),
        attentionDuration: 240,
        estimatedWaitTime: 4,
        actualWaitTime: 3,
        mobilePhone: null,
        notificationSent: 0 as any,
        service: null,
        operator: null,
        client: null,
        qrScannedAt: null,
      } as any,
    ],
  }

  beforeEach(() => {
    mockUseQueue.mockReturnValue({ state: baseState, isApiMode: true })
    mockUsePathname.mockReturnValue("/terminal")
    mockApiClient.ping.mockResolvedValue(undefined)
    mockApiClient.getQueueDashboard.mockResolvedValue(dashboardPayload)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("calls the public dashboard endpoint in terminal mode and maps the response", async () => {
    const { result } = renderHook(() => useQueueStatus())

    await act(async () => {
      await result.current.refetch()
    })

    expect(mockApiClient.getQueueDashboard).toHaveBeenCalledWith({ publicMode: true })
    const snapshot = result.current.getQueueStatus()
    expect(snapshot.currentTicket?.id).toBe(101)
    expect(snapshot.queues[0]?.waitingCount).toBe(2)
    expect(snapshot.absentTickets).toHaveLength(0)
  })

  it("falls back to the authenticated dashboard outside terminal mode", async () => {
    mockUsePathname.mockReturnValue("/dashboard")

    const { result } = renderHook(() => useQueueStatus())

    await act(async () => {
      await result.current.refetch()
    })

    expect(mockApiClient.getQueueDashboard).toHaveBeenCalledWith({ publicMode: false })
    const snapshot = result.current.getQueueStatus()
    expect(snapshot.queues[0]?.waitingCount).toBe(2)
  })
})
