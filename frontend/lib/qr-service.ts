// src/lib/qr-service.ts

export interface QRData {
  ticketId: number
  ticketNumber: string
  serviceId: number
  serviceName: string
  createdAt: string
  mobilePhone?: string
  clientId?: number
  status?: string | null
  estimatedWaitTime?: number | null
  queuePosition?: number | null
  waitingAhead?: number | null
  serviceWaitingCount?: number | null
  lastUpdatedAt?: string
}

export interface QRDynamicOverrides {
  status?: string | null
  estimatedWaitTime?: number | null
  queuePosition?: number | null
  waitingAhead?: number | null
  serviceWaitingCount?: number | null
  lastUpdatedAt?: Date | string | number | null
}

export interface QRConfig {
  size: number
  level: "L" | "M" | "Q" | "H"
  includeMargin: boolean
  fgColor: string
  bgColor: string
}

class QRService {
  private baseUrl: string

  constructor() {
    // Normalizamos para evitar doble barra final
    const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:4200"
    this.baseUrl = base.replace(/\/$/, "")
  }

  // --- Helpers privados para robustez ---
  private ensureDate(value?: Date | string | number): Date {
    if (value instanceof Date) return value
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value)
      if (!isNaN(d.getTime())) return d
    }
    return new Date()
  }

  private toSafeString(value: unknown): string {
    if (value === null || value === undefined) return ""
    return String(value)
  }

  private toOptionalNumber(value: unknown): number | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private toOptionalNonNegativeInteger(value: unknown): number | null | undefined {
    const parsed = this.toOptionalNumber(value)
    if (parsed === undefined || parsed === null) return parsed
    return Math.max(0, Math.round(parsed))
  }

  private buildMetaPayload(qrData: QRData): Record<string, unknown> | null {
    const {
      status,
      estimatedWaitTime,
      queuePosition,
      waitingAhead,
      serviceWaitingCount,
      lastUpdatedAt,
    } = qrData

    const payload: Record<string, unknown> = {}

    if (status) payload.status = status
    if (estimatedWaitTime !== undefined && estimatedWaitTime !== null) {
      payload.estimatedWaitTime = estimatedWaitTime
    }
    if (queuePosition !== undefined && queuePosition !== null) {
      payload.queuePosition = queuePosition
    }
    if (waitingAhead !== undefined && waitingAhead !== null) {
      payload.waitingAhead = waitingAhead
    }
    if (serviceWaitingCount !== undefined && serviceWaitingCount !== null) {
      payload.serviceWaitingCount = serviceWaitingCount
    }
    if (lastUpdatedAt) payload.lastUpdatedAt = lastUpdatedAt

    return Object.keys(payload).length > 0 ? payload : null
  }

  // Acepta createdAt como Date | string | number | undefined
  generateTicketData(
    ticketId: number,
    ticketNumber: string,
    serviceId: number,
    serviceName: string,
    createdAt?: Date | string | number,
    mobilePhone?: string,
    clientId?: number,
    overrides: QRDynamicOverrides = {},
  ): QRData {
    const created = this.ensureDate(createdAt)
    const data: QRData = {
      ticketId: Number(ticketId),
      ticketNumber: this.toSafeString(ticketNumber),
      serviceId: Number(serviceId),
      serviceName: this.toSafeString(serviceName),
      createdAt: created.toISOString(), // ← nunca rompe
      mobilePhone: mobilePhone ?? undefined,
      clientId: typeof clientId === "number" ? clientId : undefined,
    }

    if (overrides.status !== undefined) {
      data.status = overrides.status === null ? null : this.toSafeString(overrides.status)
    }
    if (overrides.estimatedWaitTime !== undefined) {
      data.estimatedWaitTime = this.toOptionalNumber(overrides.estimatedWaitTime)
    }
    if (overrides.queuePosition !== undefined) {
      data.queuePosition = this.toOptionalNonNegativeInteger(overrides.queuePosition)
    }
    if (overrides.waitingAhead !== undefined) {
      data.waitingAhead = this.toOptionalNonNegativeInteger(overrides.waitingAhead)
    }
    if (overrides.serviceWaitingCount !== undefined) {
      data.serviceWaitingCount = this.toOptionalNonNegativeInteger(overrides.serviceWaitingCount)
    }
    if (overrides.lastUpdatedAt !== undefined) {
      const lastUpdated =
        overrides.lastUpdatedAt === null ? null : this.ensureDate(overrides.lastUpdatedAt)
      data.lastUpdatedAt = lastUpdated ? lastUpdated.toISOString() : undefined
    }

    return data
  }

  generateTrackingUrl(qrData: QRData): string {
    const params = new URLSearchParams({
      ticket: qrData.ticketNumber,
      id: String(qrData.ticketId),
      service: String(qrData.serviceId),
    })
    return `${this.baseUrl}/mobile/track?${params.toString()}`
  }

  /**
   * Por defecto devuelve solo la URL (QR simple).
   * Si alguna vez querés QR “rico”, podés pasar mode="json" para incluir datos estructurados.
   */
  generateQRContent(qrData: QRData, mode: "url" | "json" = "url"): string {
    const trackingUrl = this.generateTrackingUrl(qrData)

    if (mode === "json") {
      const structured = {
        type: "drizatx-ticket",
        version: "1.0",
        data: qrData,
        url: trackingUrl,
      }
      try {
        return JSON.stringify(structured)
      } catch {
        return trackingUrl
      }
    }

    // Modo simple (lo que ya usabas)
    const metaPayload = this.buildMetaPayload(qrData)
    if (metaPayload) {
      const encodedMeta = encodeURIComponent(JSON.stringify(metaPayload))
      const separator = trackingUrl.includes("?") ? "&" : "?"
      return `${trackingUrl}${separator}meta=${encodedMeta}`
    }

    return trackingUrl
  }

  getDefaultConfig(): QRConfig {
    return {
      size: 128,
      level: "M",
      includeMargin: true,
      fgColor: "#000000",
      bgColor: "#ffffff",
    }
  }

  // Valida y parsea una URL de tracking generada por generateTrackingUrl
  parseTrackingUrl(url: string): QRData | null {
    try {
      const urlObj = new URL(url)
      const params = urlObj.searchParams

      const ticketNumber = params.get("ticket")
      const ticketIdStr = params.get("id")
      const serviceIdStr = params.get("service")

      if (!ticketNumber || !ticketIdStr || !serviceIdStr) return null

      const ticketId = Number(ticketIdStr)
      const serviceId = Number(serviceIdStr)
      if (!Number.isFinite(ticketId) || !Number.isFinite(serviceId)) return null

      return {
        ticketId,
        ticketNumber,
        serviceId,
        serviceName: "", // se completa al buscar el ticket en la app
        createdAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error parsing tracking URL:", error)
      return null
    }
  }

  // Genera un QR de prueba (devuelve la URL o JSON si lo pedís)
  generateTestQR(mode: "url" | "json" = "url"): string {
    const testData: QRData = {
      ticketId: 999,
      ticketNumber: "TEST001",
      serviceId: 1,
      serviceName: "Servicio de Prueba",
      createdAt: new Date().toISOString(),
      status: "WAITING",
      estimatedWaitTime: 12,
      queuePosition: 3,
      waitingAhead: 2,
      serviceWaitingCount: 5,
      lastUpdatedAt: new Date().toISOString(),
    }
    return this.generateQRContent(testData, mode)
  }
}

export const qrService = new QRService()
