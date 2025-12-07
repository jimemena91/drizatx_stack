import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { ensureSmsPhoneNumber } from "@/lib/phone-utils"

const LOG_PREFIX = "[notifications/sms]"

function buildSimulationResponse(to: string, message: string, reason: string) {
  console.info(`${LOG_PREFIX} Modo simulación activo (${reason}). Destino: ${to}`)
  console.log(`📱 SMS Simulado enviado a ${to}: ${message}`)

  return NextResponse.json({
    success: true,
    messageId: `sim_${Date.now()}`,
    to,
    message: "SMS enviado (simulado)",
  })
}

export async function POST(request: NextRequest) {
  try {
    const { to, message, ticketId } = await request.json()

    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 },
      )
    }

    const normalizedTo = ensureSmsPhoneNumber(to)
    if (!normalizedTo) {
      return NextResponse.json(
        { success: false, error: "Número de teléfono inválido" },
        { status: 400 },
      )
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? ""
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? ""
    const fromNumber = process.env.TWILIO_PHONE_NUMBER ?? ""

    const missingCredentials = [
      !accountSid && "TWILIO_ACCOUNT_SID",
      !authToken && "TWILIO_AUTH_TOKEN",
      !fromNumber && "TWILIO_PHONE_NUMBER",
    ].filter(Boolean) as string[]

    const hasCredentials = missingCredentials.length === 0
    const forceSimulation = process.env.TWILIO_FORCE_SIMULATION === "true"

    if (!hasCredentials) {
      console.error(
        `${LOG_PREFIX} No se puede enviar SMS: faltan credenciales (${missingCredentials.join(", ")}).`,
      )

      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            success: false,
            error: "MissingTwilioCredentials",
            details: { missingCredentials },
          },
          { status: 503 },
        )
      }

      return buildSimulationResponse(normalizedTo, message, "credenciales incompletas")
    }

    if (forceSimulation) {
      return buildSimulationResponse(normalizedTo, message, "forzado por TWILIO_FORCE_SIMULATION")
    }

    const client = twilio(accountSid, authToken)

    console.info(
      `${LOG_PREFIX} Enviando SMS real a ${normalizedTo} (ticket ${ticketId ?? "sin dato"}).`,
    )

    try {
      const twilioMessage = await client.messages.create({
        body: message,
        from: fromNumber,
        to: normalizedTo,
      })

      console.info(
        `${LOG_PREFIX} SMS enviado correctamente (sid: ${twilioMessage.sid ?? "sin sid"}).`,
      )

      return NextResponse.json({
        success: true,
        messageId: twilioMessage.sid ?? `twilio_${Date.now()}`,
        to: normalizedTo,
        message: "SMS enviado exitosamente",
      })
    } catch (error) {
      const twilioError = error as { code?: number; status?: number; message?: string; moreInfo?: string }
      console.error(
        `${LOG_PREFIX} Error devuelto por Twilio`,
        {
          code: twilioError.code,
          status: twilioError.status,
          message: twilioError.message,
          moreInfo: twilioError.moreInfo,
        },
      )

      const statusCode = typeof twilioError.status === "number" ? twilioError.status : 502

      return NextResponse.json(
        {
          success: false,
          error: "TwilioError",
          details: {
            code: twilioError.code,
            status: twilioError.status,
            message: twilioError.message,
            moreInfo: twilioError.moreInfo,
          },
        },
        { status: statusCode },
      )
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error inesperado al enviar SMS`, error)
    return NextResponse.json({ success: false, error: "FailedToSendSMS" }, { status: 500 })
  }
}
