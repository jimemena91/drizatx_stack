import { ApiError } from "./api-client"

function firstNonEmptyMessage(...messages: Array<unknown>): string | null {
  for (const message of messages) {
    if (typeof message !== "string") continue
    const trimmed = message.trim()
    if (trimmed.length === 0) continue
    return trimmed
  }
  return null
}

export function getFriendlyApiErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado.",
): string {
  if (error instanceof ApiError) {
    const status = error.status
    const explicitMessage = firstNonEmptyMessage(error.message, (error.details as any)?.message)

    if (status === 401 || status === 403) {
      if (explicitMessage) return explicitMessage
      return "No tenés permisos para acceder a esta información."
    }

    if (status === 404) {
      return "El recurso solicitado no se encuentra disponible."
    }

    if (status === 408) {
      return "La solicitud tardó demasiado en responder. Intenta nuevamente."
    }

    if (status >= 400 && status < 500) {
      if (explicitMessage) return explicitMessage
      return "No pudimos procesar la solicitud. Verificá los datos e intentá otra vez."
    }

    if (status >= 500) {
      if (explicitMessage) return explicitMessage
      return "El servicio no está disponible en este momento. Intenta más tarde."
    }
  }

  if (error instanceof Error && error.message) {
    const normalized = error.message.toLowerCase()
    if (normalized.includes("failed to fetch") || normalized.includes("network")) {
      return "No pudimos conectarnos con el servidor. Revisá tu conexión e intentá nuevamente."
    }
  }

  return fallback
}
