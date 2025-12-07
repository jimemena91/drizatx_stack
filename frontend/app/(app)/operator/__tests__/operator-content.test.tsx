import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { OperatorContent } from "../page"
import { Status, type QueueStatus, type ServiceWithStats, type TicketWithRelations } from "@/lib/types"
import { useQueueStatus, type QueueSnapshotState } from "@/hooks/use-queue-status"

const mockUseQueue = vi.fn()

vi.mock("@/contexts/queue-context", () => ({
  useQueue: () => mockUseQueue(),
}))

vi.mock("@/hooks/use-queue-status", () => ({
  useQueueStatus: vi.fn(),
}))

const mockUseQueueStatus = useQueueStatus as unknown as ReturnType<typeof vi.fn>

const mockRequestCallNext = vi.fn()
const mockRequestStatusChange = vi.fn()

const mockUseKeyboardNavigation = vi.fn()

vi.mock("@/hooks/use-keyboard-navigation", () => ({
  useKeyboardNavigation: (shortcuts: unknown) => mockUseKeyboardNavigation(shortcuts),
}))

vi.mock("@/hooks/use-ticket-actions", () => ({
  useTicketActions: () => ({
    requestCallNext: mockRequestCallNext,
    requestStatusChange: mockRequestStatusChange,
  }),
}))

const defaultServices: ServiceWithStats[] = [
  {
    id: 1,
    name: "Caja principal",
    prefix: "C",
    active: true,
    priority: 1,
    estimatedTime: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    waitingCount: 0,
    averageTime: 0,
    todayTickets: 0,
    absentCount: 0,
  },
]

const mockUseServices = vi.fn(() => ({
  services: defaultServices,
  loading: false,
  error: null,
}))

vi.mock("@/hooks/use-services", () => ({
  useServices: () => mockUseServices(),
}))

const mockAddToast = vi.fn()

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

const mockGetOperatorAvailabilityStatus = vi.fn().mockResolvedValue({ availability: "ACTIVE" })
const mockGetOperatorServices = vi.fn().mockResolvedValue({ services: [{ id: 1, active: true }] })
const mockUpdateOperatorAvailabilityStatus = vi
  .fn()
  .mockImplementation(async (_operatorId: number, next: string) => ({ availability: next }))

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client")
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getOperatorAvailabilityStatus: mockGetOperatorAvailabilityStatus,
      getOperatorServices: mockGetOperatorServices,
      updateOperatorAvailabilityStatus: mockUpdateOperatorAvailabilityStatus,
    },
  }
})

const baseQueueStatus: QueueStatus = {
  queues: defaultServices,
  currentTicket: null,
  nextTickets: [],
  inProgressTickets: [],
  calledTickets: [],
  waitingTickets: [],
  absentTickets: [],
  recentlyCompletedTickets: [],
  todayMetrics: {
    totalInQueue: 0,
    averageWaitTime: 0,
    attendedToday: 0,
    serviceLevel: 0,
    peakHour: 0,
  },
}

const makeTicket = (overrides: Partial<TicketWithRelations> = {}): TicketWithRelations => ({
  id: 101,
  number: "C101",
  serviceId: 1,
  status: Status.CALLED,
  priority: 1,
  createdAt: new Date().toISOString(),
  calledAt: new Date().toISOString(),
  startedAt: null,
  completedAt: null,
  attentionDuration: null,
  operatorId: 1,
  estimatedWaitTime: null,
  actualWaitTime: null,
  mobilePhone: null,
  notificationSent: false,
  clientId: null,
  service: defaultServices[0],
  operator: null,
  client: null,
  ...overrides,
})

const makeSnapshotState = (
  overrides: Partial<QueueSnapshotState> = {},
): QueueSnapshotState => ({
  status: "idle",
  error: null,
  hasSnapshot: false,
  isIdle: true,
  isLoading: false,
  isInitialLoading: false,
  isError: false,
  isSuccess: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockUseKeyboardNavigation.mockReturnValue({
    showHelp: false,
    setShowHelp: vi.fn(),
    allShortcuts: [],
    focusFirstInteractive: vi.fn(),
    trapFocus: vi.fn(),
  })
  mockUseServices.mockReturnValue({ services: defaultServices, loading: false, error: null })
  mockUseQueue.mockReturnValue({
    state: {
      settings: [
        {
          id: 1,
          key: "autoCallNext",
          value: "false",
          description: null,
          updatedAt: new Date(),
        },
      ],
    },
    dispatch: vi.fn(),
    isApiMode: false,
  })
  mockRequestCallNext.mockResolvedValue({ ticket: makeTicket(), error: null })
  mockRequestStatusChange.mockResolvedValue({ ticket: makeTicket(), error: null })
})

describe("OperatorContent", () => {
  it("muestra un spinner mientras la cola inicial se carga", () => {
    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => baseQueueStatus,
      refetch: vi.fn().mockResolvedValue(baseQueueStatus),
      status: "loading",
      loading: true,
      isLoading: true,
      isIdle: false,
      isError: false,
      isSuccess: false,
      hasSnapshot: false,
      currentTime: new Date(),
      error: null,
      snapshotState: makeSnapshotState({
        status: "loading",
        isIdle: false,
        isLoading: true,
        isInitialLoading: true,
      }),
    })

    render(<OperatorContent operatorId={1} />)

    expect(mockUseKeyboardNavigation).toHaveBeenCalled()
    expect(screen.getByText("Cargando panel de tickets...")).toBeInTheDocument()
  })

  it("renderiza el panel cuando la cola está disponible", async () => {
    const mockRefetch = vi.fn().mockResolvedValue(baseQueueStatus)

    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => baseQueueStatus,
      refetch: mockRefetch,
      status: "success",
      loading: false,
      isLoading: false,
      isIdle: false,
      isError: false,
      isSuccess: true,
      hasSnapshot: true,
      currentTime: new Date(),
      error: null,
      snapshotState: makeSnapshotState({
        status: "success",
        hasSnapshot: true,
        isIdle: false,
        isSuccess: true,
      }),
    })

    render(<OperatorContent operatorId={1} />)

    await waitFor(() => expect(mockUseKeyboardNavigation).toHaveBeenCalled())
    expect(mockRefetch).not.toHaveBeenCalled()
    const shortcuts = mockUseKeyboardNavigation.mock.calls[0]?.[0]
    expect(Array.isArray(shortcuts)).toBe(true)
    expect(
      await screen.findByText("Gestiona el flujo de tickets con un solo clic"),
    ).toBeInTheDocument()
  })

  it("muestra un mensaje de error cuando no se puede cargar la cola", () => {
    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => baseQueueStatus,
      refetch: vi.fn(),
      status: "error",
      loading: false,
      isLoading: false,
      isIdle: false,
      isError: true,
      isSuccess: false,
      hasSnapshot: false,
      currentTime: new Date(),
      error: "No autorizado",
      snapshotState: makeSnapshotState({
        status: "error",
        isIdle: false,
        isError: true,
        error: "No autorizado",
      }),
    })

    render(<OperatorContent operatorId={1} />)

    expect(
      screen.getByText("Error al cargar el panel de tickets. Contacte a soporte."),
    ).toBeInTheDocument()
  })

  it("enfoca el botón principal de llamada cuando no hay ticket activo", async () => {
    const queueState: QueueStatus = {
      ...baseQueueStatus,
      queues: defaultServices,
      currentTicket: null,
    }

    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => queueState,
      refetch: vi.fn().mockResolvedValue(queueState),
      status: "success",
      loading: false,
      isLoading: false,
      isIdle: false,
      isError: false,
      isSuccess: true,
      hasSnapshot: true,
      currentTime: new Date(),
      error: null,
      snapshotState: makeSnapshotState({ status: "success", hasSnapshot: true, isSuccess: true }),
    })

    render(<OperatorContent operatorId={1} />)

    const callNextButton = await screen.findByRole("button", {
      name: /llamar siguiente turno\/ticket/i,
    })

    await waitFor(() => expect(callNextButton).toHaveFocus())
  })

  it("enfoca el botón de atender cuando se asigna un ticket", async () => {
    let queueState: QueueStatus = {
      ...baseQueueStatus,
      currentTicket: makeTicket({ id: 201, number: "C201" }),
    }

    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => queueState,
      refetch: vi.fn().mockResolvedValue(queueState),
      status: "success",
      loading: false,
      isLoading: false,
      isIdle: false,
      isError: false,
      isSuccess: true,
      hasSnapshot: true,
      currentTime: new Date(),
      error: null,
      snapshotState: makeSnapshotState({ status: "success", hasSnapshot: true, isSuccess: true }),
    })

    render(<OperatorContent operatorId={1} />)

    const attendButton = await screen.findByRole("button", {
      name: /atender \/ tomar ticket/i,
    })

    await waitFor(() => expect(attendButton).toHaveFocus())
  })

  it("no sobrescribe el foco cuando el usuario está escribiendo en otro elemento interactivo", async () => {
    let queueState: QueueStatus = {
      ...baseQueueStatus,
      currentTicket: makeTicket({ id: 501, number: "C501" }),
    }

    const mockRefetch = vi.fn().mockImplementation(async () => queueState)

    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => queueState,
      refetch: mockRefetch,
      status: "success",
      loading: false,
      isLoading: false,
      isIdle: false,
      isError: false,
      isSuccess: true,
      hasSnapshot: true,
      currentTime: new Date(),
      error: null,
      snapshotState: makeSnapshotState({ status: "success", hasSnapshot: true, isSuccess: true }),
    })

    const { rerender } = render(<OperatorContent operatorId={1} />)

    const manualInput = document.createElement("input")
    document.body.appendChild(manualInput)
    manualInput.focus()

    queueState = {
      ...queueState,
      currentTicket: null,
      inProgressTickets: [],
      calledTickets: [],
    }

    rerender(<OperatorContent operatorId={1} />)

    await waitFor(() => expect(manualInput).toHaveFocus())

    manualInput.remove()
  })

  it("respeta el foco actual cuando llega un nuevo ticket y el usuario está en otro elemento", async () => {
    let queueState: QueueStatus = {
      ...baseQueueStatus,
      currentTicket: null,
    }

    const mockRefetch = vi.fn().mockImplementation(async () => queueState)

    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => queueState,
      refetch: mockRefetch,
      status: "success",
      loading: false,
      isLoading: false,
      isIdle: false,
      isError: false,
      isSuccess: true,
      hasSnapshot: true,
      currentTime: new Date(),
      error: null,
      snapshotState: makeSnapshotState({ status: "success", hasSnapshot: true, isSuccess: true }),
    })

    const { rerender } = render(<OperatorContent operatorId={1} />)

    const manualInput = document.createElement("input")
    document.body.appendChild(manualInput)
    manualInput.focus()

    queueState = {
      ...queueState,
      currentTicket: makeTicket({ id: 777, number: "C777" }),
    }

    rerender(<OperatorContent operatorId={1} />)

    await waitFor(() => expect(manualInput).toHaveFocus())

    manualInput.remove()
  })

  it("llama automáticamente al siguiente ticket cuando autoCallNext está habilitado", async () => {
    const waitingTicket = makeTicket({ id: 801, number: "C801", status: Status.WAITING })
    const queueWithWaiting: QueueStatus = {
      ...baseQueueStatus,
      queues: [
        {
          ...defaultServices[0],
        waitingCount: 1,
        averageTime: 5,
        todayTickets: 0,
        absentCount: 0,
      },
      ],
      nextTickets: [waitingTicket],
      waitingTickets: [waitingTicket],
      currentTicket: null,
    }

    const autoCalledTicket = makeTicket({ id: 901, number: "C901" })
    const queueAfterCall: QueueStatus = {
      ...queueWithWaiting,
      currentTicket: autoCalledTicket,
      nextTickets: [],
      waitingTickets: [],
    }

    mockUseQueueStatus.mockReturnValue({
      getQueueStatus: () => queueWithWaiting,
      refetch: vi.fn().mockResolvedValue(queueAfterCall),
      status: "success",
      loading: false,
      isLoading: false,
      isIdle: false,
      isError: false,
      isSuccess: true,
      hasSnapshot: true,
      currentTime: new Date(),
      error: null,
      snapshotState: makeSnapshotState({ status: "success", hasSnapshot: true, isSuccess: true }),
    })

    mockUseQueue.mockReturnValue({
      state: {
        settings: [
          {
            id: 1,
            key: "autoCallNext",
            value: "true",
            description: null,
            updatedAt: new Date(),
          },
        ],
      },
      dispatch: vi.fn(),
      isApiMode: false,
    })

    mockRequestCallNext.mockResolvedValue({ ticket: autoCalledTicket, error: null })

    render(<OperatorContent operatorId={1} />)

    await waitFor(() => {
      expect(mockRequestCallNext).toHaveBeenCalledWith(1, 1)
    })
  })
})
