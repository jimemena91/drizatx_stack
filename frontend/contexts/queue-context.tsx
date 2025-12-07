"use client"

import type React from "react"
import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react"
import type { Service, Operator, Ticket, SystemSetting, QueueState, Client, CustomMessage } from "@/lib/types"
import { mockServices, mockOperators, mockSettings, generateMockTickets, mockClients } from "@/lib/mock-data"
import { isApiMode } from "@/lib/api-mode"

// ==============================
// Storage versioning & constants
// ==============================
const STORAGE_KEY_V1 = "drizatx-queue-state"
const STORAGE_KEY = "drizatx-queue-state-v2"

// ------------------------------
// Helpers: default state builder (solo NO-API)
// ------------------------------
function buildDefaultState(): QueueState {
  const services: Service[] = (mockServices ?? []).map((s) => ({
    ...s,
    active: typeof s.active === "boolean" ? s.active : true,
    createdAt: new Date(s.createdAt ?? Date.now()),
    updatedAt: new Date(s.updatedAt ?? Date.now()),
  }))

  const operators: Operator[] = (mockOperators ?? []).map((o) => ({
    ...o,
    createdAt: new Date(o.createdAt ?? Date.now()),
    updatedAt: new Date(o.updatedAt ?? Date.now()),
  }))

  const tickets: Ticket[] = generateMockTickets().map((t) => reviveTicketDates(t))

  const settings: SystemSetting[] = (mockSettings ?? []).map((st) => ({
    ...st,
    updatedAt: new Date(st.updatedAt ?? Date.now()),
  }))

  const clients: Client[] = (mockClients ?? []).map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt ?? Date.now()),
    updatedAt: new Date(c.updatedAt ?? Date.now()),
  }))

  const customMessages: CustomMessage[] = []

  return {
    services,
    operators,
    tickets,
    settings,
    clients,
    customMessages,
    currentTime: new Date(),
  }
}

// ------------------------------
// Estado vacío para API (source of truth = backend)
// ------------------------------
const EMPTY_STATE: QueueState = {
  services: [],
  operators: [],
  tickets: [],
  settings: [],
  clients: [],
  customMessages: [],
  currentTime: new Date(),
}

// ------------------------------
// Helpers: revive / migration (solo NO-API)
// ------------------------------
function reviveTicketDates(ticket: any): Ticket {
  return {
    ...ticket,
    createdAt: ticket.createdAt ? new Date(ticket.createdAt) : new Date(),
    calledAt: ticket.calledAt ? new Date(ticket.calledAt) : null,
    startedAt: ticket.startedAt ? new Date(ticket.startedAt) : null,
    completedAt: ticket.completedAt ? new Date(ticket.completedAt) : null,
    almostReadyNotificationSentAt: ticket.almostReadyNotificationSentAt
      ? new Date(ticket.almostReadyNotificationSentAt)
      : null,
    qrScannedAt: ticket.qrScannedAt ? new Date(ticket.qrScannedAt) : null,
  }
}

function reviveStateDates(raw: any): QueueState {
  const defaulted = buildDefaultState()

  const services: Service[] = (raw.services ?? defaulted.services).map((s: any) => ({
    ...s,
    active: typeof s.active === "boolean" ? s.active : true,
    createdAt: s?.createdAt ? new Date(s.createdAt) : new Date(),
    updatedAt: s?.updatedAt ? new Date(s.updatedAt) : new Date(),
  }))

  const operators: Operator[] = (raw.operators ?? defaulted.operators).map((o: any) => ({
    ...o,
    createdAt: o?.createdAt ? new Date(o.createdAt) : new Date(),
    updatedAt: o?.updatedAt ? new Date(o.updatedAt) : new Date(),
  }))

  const tickets: Ticket[] = (raw.tickets ?? defaulted.tickets).map((t: any) => reviveTicketDates(t))

  const rawSettings: SystemSetting[] = Array.isArray(raw.settings) ? raw.settings : []
  const mergedSettings = [...rawSettings]
  defaulted.settings.forEach((defSetting) => {
    if (!mergedSettings.some((s) => s.key === defSetting.key)) {
      mergedSettings.push(defSetting)
    }
  })
  const settings: SystemSetting[] = mergedSettings.map((st: any) => ({
    ...st,
    updatedAt: st?.updatedAt ? new Date(st.updatedAt) : new Date(),
  }))

  const clients: Client[] = (raw.clients ?? defaulted.clients).map((c: any) => ({
    ...c,
    createdAt: c?.createdAt ? new Date(c.createdAt) : new Date(),
    updatedAt: c?.updatedAt ? new Date(c.updatedAt) : new Date(),
  }))

  const customMessages: CustomMessage[] = (raw.customMessages ?? defaulted.customMessages).map((m: any) => ({
    ...m,
    createdAt: m?.createdAt ? new Date(m.createdAt) : new Date(),
    updatedAt: m?.updatedAt ? new Date(m.updatedAt) : new Date(),
    startDate: m?.startDate ? new Date(m.startDate) : null,
    endDate: m?.endDate ? new Date(m.endDate) : null,
    displayDurationSeconds:
      typeof m?.displayDurationSeconds === "number" && Number.isFinite(m.displayDurationSeconds)
        ? m.displayDurationSeconds
        : null,
    activeDays: Array.isArray(m?.activeDays)
      ? m.activeDays
      : typeof m?.activeDays === "string"
        ? m.activeDays
            .split(/[,;\s]+/)
            .map((item: string) => item.trim().toLowerCase())
            .filter(Boolean)
        : null,
  }))

  return {
    services,
    operators,
    tickets,
    settings,
    clients,
    customMessages,
    currentTime: new Date(),
  }
}

function migrateOrSeed(raw: any): QueueState {
  if (!raw) return buildDefaultState()

  const revived = reviveStateDates(raw)

  if (!Array.isArray(revived.services) || revived.services.length === 0) {
    const seeded = buildDefaultState()
    return { ...revived, services: seeded.services }
  }
  const hasActive = revived.services.some((s) => !!s.active)
  if (!hasActive) {
    const services = revived.services.map((s) => ({ ...s, active: true }))
    return { ...revived, services }
  }

  return revived
}

// ==============================
// Tipos para las acciones
// ==============================
type QueueAction =
  | { type: "SET_SERVICES"; payload: Service[] }
  | { type: "ADD_SERVICE"; payload: Service }
  | { type: "UPDATE_SERVICE"; payload: { id: number; data: Partial<Service> } }
  | { type: "DELETE_SERVICE"; payload: number }
  | { type: "SET_OPERATORS"; payload: Operator[] }
  | { type: "ADD_OPERATOR"; payload: Operator }
  | { type: "UPDATE_OPERATOR"; payload: { id: number; data: Partial<Operator> } }
  | { type: "DELETE_OPERATOR"; payload: number }
  | { type: "SET_TICKETS"; payload: Ticket[] }
  | { type: "ADD_TICKET"; payload: Ticket }
  | { type: "UPDATE_TICKET"; payload: { id: number; data: Partial<Ticket> } }
  | { type: "DELETE_TICKET"; payload: number }
  | { type: "SET_SETTINGS"; payload: SystemSetting[] }
  | { type: "UPDATE_SETTING"; payload: { key: string; value: string } }
  | { type: "SET_CLIENTS"; payload: Client[] }
  | { type: "ADD_CLIENT"; payload: Client }
  | { type: "UPDATE_CLIENT"; payload: { id: number; data: Partial<Client> } }
  | { type: "DELETE_CLIENT"; payload: number }
  | { type: "SET_CUSTOM_MESSAGES"; payload: CustomMessage[] }
  | { type: "ADD_CUSTOM_MESSAGE"; payload: CustomMessage }
  | { type: "UPDATE_CUSTOM_MESSAGE"; payload: { id: number; data: Partial<CustomMessage> } }
  | { type: "DELETE_CUSTOM_MESSAGE"; payload: number }
  | { type: "UPDATE_TIME" }
  | { type: "LOAD_FROM_STORAGE"; payload: QueueState }

// ==============================
// Estado inicial (NO-API)
// ==============================
const initialState: QueueState = buildDefaultState()

// ==============================
// Reducer
// ==============================
function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "SET_SERVICES":
      return { ...state, services: action.payload }
    case "ADD_SERVICE":
      return { ...state, services: [...state.services, action.payload] }
    case "UPDATE_SERVICE":
      return {
        ...state,
        services: state.services.map((service) =>
          service.id === action.payload.id ? { ...service, ...action.payload.data, updatedAt: new Date() } : service,
        ),
      }
    case "DELETE_SERVICE":
      return { ...state, services: state.services.filter((service) => service.id !== action.payload) }

    case "SET_OPERATORS":
      return { ...state, operators: action.payload }
    case "ADD_OPERATOR":
      return { ...state, operators: [...state.operators, action.payload] }
    case "UPDATE_OPERATOR":
      return {
        ...state,
        operators: state.operators.map((operator) =>
          operator.id === action.payload.id ? { ...operator, ...action.payload.data, updatedAt: new Date() } : operator,
        ),
      }
    case "DELETE_OPERATOR":
      return { ...state, operators: state.operators.filter((operator) => operator.id !== action.payload) }

    case "SET_TICKETS":
      return { ...state, tickets: action.payload }
    case "ADD_TICKET":
      return { ...state, tickets: [action.payload, ...state.tickets] }
    case "UPDATE_TICKET":
      return {
        ...state,
        tickets: state.tickets.map((ticket) =>
          ticket.id === action.payload.id ? { ...ticket, ...action.payload.data } : ticket,
        ),
      }
    case "DELETE_TICKET":
      return { ...state, tickets: state.tickets.filter((ticket) => ticket.id !== action.payload) }

    case "SET_SETTINGS":
      return { ...state, settings: action.payload }
    case "UPDATE_SETTING": {
      const exists = state.settings.some((setting) => setting.key === action.payload.key)
      if (exists) {
        return {
          ...state,
          settings: state.settings.map((setting) =>
            setting.key === action.payload.key
              ? { ...setting, value: action.payload.value, updatedAt: new Date() }
              : setting,
          ),
        }
      }

      const fallback = mockSettings.find((setting) => setting.key === action.payload.key)
      const newSetting: SystemSetting = {
        id: fallback?.id ?? Date.now(),
        key: action.payload.key,
        value: action.payload.value,
        description: fallback?.description ?? null,
        updatedAt: new Date(),
      }

      return {
        ...state,
        settings: [...state.settings, newSetting],
      }
    }

    case "SET_CLIENTS":
      return { ...state, clients: action.payload }
    case "ADD_CLIENT":
      return { ...state, clients: [...state.clients, action.payload] }
    case "UPDATE_CLIENT":
      return {
        ...state,
        clients: state.clients.map((client) =>
          client.id === action.payload.id ? { ...client, ...action.payload.data, updatedAt: new Date() } : client,
        ),
      }
    case "DELETE_CLIENT":
      return { ...state, clients: state.clients.filter((client) => client.id !== action.payload) }

    case "SET_CUSTOM_MESSAGES":
      return { ...state, customMessages: action.payload }
    case "ADD_CUSTOM_MESSAGE":
      return { ...state, customMessages: [...state.customMessages, action.payload] }
    case "UPDATE_CUSTOM_MESSAGE":
      return {
        ...state,
        customMessages: state.customMessages.map((message) =>
          message.id === action.payload.id ? { ...message, ...action.payload.data, updatedAt: new Date() } : message,
        ),
      }
    case "DELETE_CUSTOM_MESSAGE":
      return { ...state, customMessages: state.customMessages.filter((message) => message.id !== action.payload) }

    case "UPDATE_TIME":
      return { ...state, currentTime: new Date() }

    case "LOAD_FROM_STORAGE":
      return action.payload

    default:
      return state
  }
}

// ==============================
// Context
// ==============================
interface QueueContextType {
  state: QueueState
  dispatch: React.Dispatch<QueueAction>
  isApiMode: boolean
}

const QueueContext = createContext<QueueContextType | undefined>(undefined)

// ==============================
// Provider
// ==============================
interface QueueProviderProps {
  children: ReactNode
}

export function QueueProvider({ children }: QueueProviderProps) {
  const apiMode = isApiMode()
  // ⬇️ En API: arrancamos vacíos; en NO-API: con mocks y migración
  const [state, dispatch] = useReducer(queueReducer, apiMode ? EMPTY_STATE : initialState)

  // Cargar datos del localStorage al iniciar (solo NO-API)
  useEffect(() => {
    if (apiMode) return

    try {
      const rawV2 = localStorage.getItem(STORAGE_KEY)
      const rawV1 = rawV2 ? null : localStorage.getItem(STORAGE_KEY_V1)

      const parsed = rawV2 ? JSON.parse(rawV2) : rawV1 ? JSON.parse(rawV1) : null
      const nextState = migrateOrSeed(parsed)

      if (!rawV2) {
        localStorage.removeItem(STORAGE_KEY_V1)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
      }

      dispatch({ type: "LOAD_FROM_STORAGE", payload: nextState })
    } catch (error) {
      console.error("Error loading/migrating state from localStorage:", error)
      dispatch({ type: "LOAD_FROM_STORAGE", payload: buildDefaultState() })
    }
  }, [apiMode])

  // Guardar en localStorage cuando cambie el estado (solo NO-API)
  useEffect(() => {
    if (!apiMode) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (e) {
        console.error("Error persisting state:", e)
      }
    }
  }, [state, apiMode])

  // Actualizar tiempo cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "UPDATE_TIME" })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return <QueueContext.Provider value={{ state, dispatch, isApiMode: apiMode }}>{children}</QueueContext.Provider>
}

// Hook para usar el context
export function useQueue() {
  const context = useContext(QueueContext)
  if (context === undefined) {
    throw new Error("useQueue must be used within a QueueProvider")
  }
  return context
}
