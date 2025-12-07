import { audioService } from "@/lib/audio-service"

export interface NotificationConfig {
  smsEnabled: boolean
  pushEnabled: boolean
  emailEnabled: boolean
  twilioAccountSid?: string
  twilioAuthToken?: string
  twilioPhoneNumber?: string
  pushApiKey?: string
}

export interface NotificationPayload {
  ticketId: number
  ticketNumber: string
  serviceName: string
  mobilePhone?: string
  clientName?: string
  message: string
  type: "sms" | "push" | "email"
}

class NotificationService {
  private config: NotificationConfig = {
    smsEnabled: false,
    pushEnabled: process.env.NEXT_PUBLIC_PUSH_ENABLED === "true",
    emailEnabled: process.env.NEXT_PUBLIC_EMAIL_ENABLED === "true",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    pushApiKey: process.env.PUSH_API_KEY,
  }

  async sendSMS(payload: NotificationPayload): Promise<boolean> {
    console.info(
      "[notificationService] SMS temporalmente deshabilitado. Se omitió el envío.",
      {
        ticketId: payload.ticketId,
        mobilePhone: payload.mobilePhone ?? "sin número",
      },
    )
    return false
  }

  async sendPushNotification(payload: NotificationPayload): Promise<boolean> {
    if (!this.config.pushEnabled) {
      return false
    }

    try {
      // En modo simulado
      if (process.env.NEXT_PUBLIC_API_MODE !== "true") {
        console.log(`🔔 Push Notification Simulada:`, payload.message)
        return true
      }

      // En modo API real
      const response = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      return response.ok
    } catch (error) {
      console.error("Error sending push notification:", error)
      return false
    }
  }

  generateNotificationMessage(
    type: "your-turn" | "almost-ready" | "ready" | "scan-confirmed" | "registered",
    ticketNumber: string,
    serviceName: string,
  ): string {
    switch (type) {
      case "your-turn":
        return `🎫 DrizaTx: Su turno ${ticketNumber} para ${serviceName} está siendo llamado. Diríjase al mostrador.`
      case "almost-ready":
        return `⏰ DrizaTx: Queda una persona antes del turno ${ticketNumber} de ${serviceName}. Prepárese, es el próximo.`
      case "ready":
        return `✅ DrizaTx: Su turno ${ticketNumber} para ${serviceName} está listo. Preséntese en el mostrador.`
      case "scan-confirmed":
        return `🔐 DrizaTx: Escaneo correcto del turno ${ticketNumber} de ${serviceName}. Revise su celular: recibirá un mensaje cuando quede una sola persona adelante.`
      case "registered":
        return `📲 DrizaTx: Registramos el turno ${ticketNumber} para ${serviceName}. Te avisaremos por SMS cuando quede una persona delante y cuando seas llamado.`
      default:
        return `DrizaTx: Actualización de su turno ${ticketNumber} para ${serviceName}.`
    }
  }

  async notifyTicketCalled(
    ticketId: number,
    ticketNumber: string,
    serviceName: string,
    mobilePhone?: string,
    clientName?: string,
  ) {
    const message = this.generateNotificationMessage("your-turn", ticketNumber, serviceName)

    const payload: NotificationPayload = {
      ticketId,
      ticketNumber,
      serviceName,
      mobilePhone,
      clientName,
      message,
      type: "sms",
    }

    // Enviar SMS si hay teléfono
    if (mobilePhone) {
      await this.sendSMS(payload)
    }

    // Enviar push notification
    await this.sendPushNotification({ ...payload, type: "push" })

    // Reproducir sonido usando audioService
    await audioService.playTicketCalled(ticketNumber, serviceName)
  }

  async notifyAlmostReady(
    ticketId: number,
    ticketNumber: string,
    serviceName: string,
    mobilePhone?: string,
    clientName?: string,
  ) {
    const message = this.generateNotificationMessage("almost-ready", ticketNumber, serviceName)

    const payload: NotificationPayload = {
      ticketId,
      ticketNumber,
      serviceName,
      mobilePhone,
      clientName,
      message,
      type: "sms",
    }

    if (mobilePhone) {
      await this.sendSMS(payload)
    }
  }

  async notifyScanConfirmed(
    ticketId: number,
    ticketNumber: string,
    serviceName: string,
    mobilePhone?: string,
    clientName?: string,
  ) {
    const message = this.generateNotificationMessage("scan-confirmed", ticketNumber, serviceName)

    const payload: NotificationPayload = {
      ticketId,
      ticketNumber,
      serviceName,
      mobilePhone,
      clientName,
      message,
      type: "sms",
    }

    if (mobilePhone) {
      await this.sendSMS(payload)
    }
  }

  async notifyTicketRegistered(
    ticketId: number,
    ticketNumber: string,
    serviceName: string,
    mobilePhone?: string,
    clientName?: string,
  ) {
    const message = this.generateNotificationMessage("registered", ticketNumber, serviceName)

    const payload: NotificationPayload = {
      ticketId,
      ticketNumber,
      serviceName,
      mobilePhone,
      clientName,
      message,
      type: "sms",
    }

    if (mobilePhone) {
      await this.sendSMS(payload)
    }
  }
}

export const notificationService = new NotificationService()
