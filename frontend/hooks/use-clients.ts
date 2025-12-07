"use client"

import { useState, useEffect } from "react"
import { useQueue } from "@/contexts/queue-context"
import type { Client, ClientHistory, ClientVisitHistoryItem } from "@/lib/types"
import { apiClient, ApiError } from "@/lib/api-client"

type UseClientsOptions = {
  publicMode?: boolean;
};

export function useClients(options: UseClientsOptions = {}) {
  const { state, dispatch, isApiMode } = useQueue()
  const { publicMode = false } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isApiMode && !publicMode) {
      fetchClients()
    }
  }, [isApiMode, publicMode])

  const fetchClients = async () => {
    if (!isApiMode || publicMode) return

    try {
      setLoading(true)
      setError(null)
      const clients = await apiClient.getClients()
      dispatch({ type: "SET_CLIENTS", payload: clients })
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error fetching clients"
      setError(errorMessage)
      console.error("Error fetching clients:", err)
    } finally {
      setLoading(false)
    }
  }

  const createClient = async (data: Omit<Client, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Crear clientes no está disponible en modo público")
        }
        setLoading(true)
        const newClient = await apiClient.createClient(data)
        dispatch({ type: "ADD_CLIENT", payload: newClient })
        return newClient
      } else {
        const newClient: Client = {
          ...data,
          id: Math.max(0, ...state.clients.map((c) => c.id)) + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        dispatch({ type: "ADD_CLIENT", payload: newClient })
        return newClient
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error creating client"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const updateClient = async (id: number, data: Partial<Client>) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Actualizar clientes no está disponible en modo público")
        }
        setLoading(true)
        const updatedClient = await apiClient.updateClient(id, data)
        dispatch({ type: "UPDATE_CLIENT", payload: { id, data: updatedClient } })
      } else {
        dispatch({ type: "UPDATE_CLIENT", payload: { id, data } })
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error updating client"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const deleteClient = async (id: number) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Eliminar clientes no está disponible en modo público")
        }
        setLoading(true)
        await apiClient.deleteClient(id)
      }

      dispatch({ type: "DELETE_CLIENT", payload: id })
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error deleting client"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const findByDni = async (dni: string) => {
    try {
      setError(null)

      if (isApiMode) {
        setLoading(true)
        if (publicMode) {
          const client = await apiClient.getClientByDniPublic(dni)
          if (!client) return null
          return {
            id: client.id,
            dni: client.dni,
            name: client.name,
            email: client.email,
            phone: client.phone,
            vip: client.vip,
            createdAt: client.createdAt ?? new Date().toISOString(),
            updatedAt: client.updatedAt ?? new Date().toISOString(),
          }
        }
        const client = await apiClient.getClientByDni(dni)
        return client
      } else {
        return state.clients.find((c) => c.dni === dni) || null
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error finding client by DNI"
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }

  const search = async (query: string) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Buscar clientes no está disponible en modo público")
        }
        setLoading(true)
        const results = await apiClient.searchClients(query)
        return results
      } else {
        const q = query.toLowerCase()
        return state.clients.filter((c) => c.name.toLowerCase().includes(q) || c.dni.includes(query))
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error searching clients"
      setError(errorMessage)
      return []
    } finally {
      setLoading(false)
    }
  }

  const bulkImport = async (rows: Array<Pick<Client, "dni" | "name" | "email" | "phone"> & { vip?: boolean }>) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Importar clientes no está disponible en modo público")
        }
        setLoading(true)
        const clients = rows.map((r) => ({ ...r, vip: r.vip ?? false }))
        let createdClients: Client[] = []

        try {
          createdClients = await apiClient.bulkCreateClients(clients)
        } catch (apiErr) {
          if (apiErr instanceof ApiError && [404, 405, 501].includes(apiErr.status)) {
            const processed: Client[] = []
            for (const clientPayload of clients) {
              const existing = await apiClient.getClientByDni(clientPayload.dni)
              if (existing) {
                const updated = await apiClient.updateClient(existing.id, clientPayload)
                processed.push(updated)
              } else {
                const created = await apiClient.createClient(clientPayload)
                processed.push(created)
              }
            }
            createdClients = processed
          } else {
            throw apiErr
          }
        }

        // Refresh clients list
        await fetchClients()
        return createdClients
      } else {
        rows.forEach((r) => {
          const existed = state.clients.find((c) => c.dni === r.dni)
          if (existed) {
            dispatch({ type: "UPDATE_CLIENT", payload: { id: existed.id, data: { ...r } } })
          } else {
            const newClient: Client = {
              ...r,
              vip: r.vip ?? false,
              id: Math.max(0, ...state.clients.map((c) => c.id)) + 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            dispatch({ type: "ADD_CLIENT", payload: newClient })
          }
        })
        return []
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error importing clients"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getHistory = async (id: number): Promise<ClientHistory> => {
    if (!id) throw new Error("ID de cliente requerido")

    try {
      setError(null)

      if (isApiMode) {
        setLoading(true)
        const history = await apiClient.getClientHistory(id)
        return history
      }

      const client = state.clients.find((c) => c.id === id)
      if (!client) {
        throw new Error("Cliente no encontrado")
      }

      const tickets = state.tickets
        .filter((ticket) => ticket.clientId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const lastTicket = tickets[0] ?? null
      const limit = 25
      const limitedTickets = tickets.slice(0, limit)

      const historyItems: ClientVisitHistoryItem[] = limitedTickets.map((ticket) => {
        const service = state.services.find((s) => s.id === ticket.serviceId) ?? null
        const operator = ticket.operatorId != null
          ? state.operators.find((o) => o.id === ticket.operatorId) ?? null
          : null

        return {
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          status: ticket.status,
          serviceId: ticket.serviceId ?? null,
          serviceName: service?.name ?? null,
          operatorId: ticket.operatorId ?? null,
          operatorName: operator?.name ?? null,
          createdAt: ticket.createdAt,
          calledAt: ticket.calledAt ?? null,
          startedAt: ticket.startedAt ?? null,
          completedAt: ticket.completedAt ?? null,
        }
      })

      const lastVisitAt = lastTicket
        ? lastTicket.completedAt ?? lastTicket.startedAt ?? lastTicket.calledAt ?? lastTicket.createdAt
        : null

      const lastService = lastTicket
        ? state.services.find((s) => s.id === lastTicket.serviceId) ?? null
        : null

      const lastOperator = lastTicket?.operatorId != null
        ? state.operators.find((o) => o.id === lastTicket.operatorId) ?? null
        : null

      return {
        client,
        totalVisits: tickets.length,
        lastVisitAt,
        lastTicketNumber: lastTicket?.number ?? null,
        lastOperator: lastTicket
          ? { id: lastTicket.operatorId ?? null, name: lastOperator?.name ?? null }
          : null,
        lastService: lastTicket
          ? { id: lastTicket.serviceId ?? null, name: lastService?.name ?? null }
          : null,
        history: historyItems,
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : (err as Error).message || "Error obteniendo historial"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return {
    clients: state.clients,
    loading,
    error,
    createClient,
    updateClient,
    deleteClient,
    findByDni,
    search,
    bulkImport,
    refetch: fetchClients,
    getHistory,
  }
}
