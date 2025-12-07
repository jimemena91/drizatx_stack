import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { SystemSettingsService } from '../system-settings/system-settings.service'
import { PrintTicketDto } from './dto/print-ticket.dto'

/** Valida que sea http(s) */
const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const truthyStrings = new Set(['true', '1', 'yes', 'si', 'sí', 'on'])
const falsyStrings = new Set(['false', '0', 'no', 'off'])

@Injectable()
export class TerminalService {
  private readonly logger = new Logger(TerminalService.name)

  /** Env (si están presentes, tienen prioridad) */
  private readonly envWebhookUrl: string | null
  private readonly envWebhookToken: string | null
  private readonly envBrowserPrintingEnabled: boolean | null

  /** Flags para evitar spam de logs */
  private hasWarnedAboutMissingWebhook = false
  private hasWarnedAboutInvalidWebhook = false
  private hasLoggedBrowserDelegation = false

  constructor(private readonly systemSettings: SystemSettingsService) {
    // URL del webhook (env)
    const rawUrl = process.env.TERMINAL_PRINT_WEBHOOK_URL?.trim() ?? ''
    if (rawUrl && !isHttpUrl(rawUrl)) {
      this.logger.warn(
        `[terminal] Ignorando TERMINAL_PRINT_WEBHOOK_URL inválida. Debe comenzar con http:// o https:// (recibido: ${rawUrl}).`
      )
      this.envWebhookUrl = null
    } else {
      this.envWebhookUrl = rawUrl || null
    }

    // Token del webhook (env)
    const rawToken = process.env.TERMINAL_PRINT_WEBHOOK_TOKEN?.trim() ?? ''
    this.envWebhookToken = rawToken || null

    // Habilitar delegación al navegador (env opcional)
    const normalizedBrowserPrinting = process.env.TERMINAL_KIOSK_PRINTING_ENABLED?.trim().toLowerCase()
    if (normalizedBrowserPrinting && truthyStrings.has(normalizedBrowserPrinting)) {
      this.envBrowserPrintingEnabled = true
    } else if (normalizedBrowserPrinting && falsyStrings.has(normalizedBrowserPrinting)) {
      this.envBrowserPrintingEnabled = false
    } else {
      this.envBrowserPrintingEnabled = null // “no definido”
    }
  }

  /**
   * Punto único de impresión.
   * 1) Si está habilitada la delegación al navegador → no llama webhook (el FE mostrará/gestionará).
   * 2) Si hay webhook válido → postea al bridge local.
   * 3) Si no hay config → simula impresión (no rompe experiencia).
   */
  async sendTicketToPrinter(payload: PrintTicketDto): Promise<void> {
    // 1) ¿Delegamos al navegador?
    if (await this.shouldDelegateToBrowserPrinting()) {
      if (!this.hasLoggedBrowserDelegation) {
        this.logger.log(
          '[terminal] Impresión delegada al navegador (--kiosk-printing habilitado). No se usará webhook remoto.'
        )
        this.hasLoggedBrowserDelegation = true
      }

      this.logger.log(
        `[terminal] Ticket ${payload.ticketNumber} (${payload.serviceName}) preparado para impresión local en el navegador.`
      )
      return
    }

    // 2) Intentamos con webhook (env -> system settings)
    const webhookConfig = await this.resolveWebhookConfig()

    if (!webhookConfig) {
      if (!this.hasWarnedAboutMissingWebhook) {
        this.logger.warn(
          '[terminal] No se configuró ningún webhook de impresión (ni envs ni ajustes del sistema). Se simulará la impresión.'
        )
        this.hasWarnedAboutMissingWebhook = true
      }
      this.logger.log(
        `[terminal] Simulación de impresión: ticket ${payload.ticketNumber} (${payload.serviceName}).`
      )
      return
    }

    const { url: webhookUrl, token: webhookToken } = webhookConfig

    // 3) POST al bridge con timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000) // 7s

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
        },
        body: JSON.stringify({
          ticketId: payload.ticketId,
          serviceId: payload.serviceId,
          ticketNumber: payload.ticketNumber,
          serviceName: payload.serviceName,
          clientName: payload.clientName ?? undefined,
          payload: (payload as any).payload ?? {}, // por compatibilidad si ya lo enviás
          requestedAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const responseText = await response.text().catch(() => '')
        throw new Error(
          `Webhook respondió ${response.status} ${response.statusText}${
            responseText ? ` → ${responseText.slice(0, 200)}` : ''
          }`
        )
      }

      this.logger.log(
        `[terminal] Ticket ${payload.ticketNumber} (${payload.serviceName}) enviado al servicio de impresión.`
      )
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      if (err.name === 'AbortError') {
        this.logger.error(
          `[terminal] Timeout al contactar el webhook de impresión (${webhookUrl}).`,
          err.stack
        )
        throw new InternalServerErrorException(
          'Timeout al intentar contactar el servicio de impresión.'
        )
      }

      const isNetworkFailure =
        err instanceof TypeError || /fetch failed|network/i.test(err.message || '')

      this.logger.error(
        `[terminal] Falló el envío del ticket ${payload.ticketNumber} al webhook: ${err.message}`,
        err.stack
      )

      // Degradación elegante en fallas de red: simulamos (no detenemos el flujo en ventanilla)
      if (isNetworkFailure) {
        this.logger.warn(
          `[terminal] Continuando sin webhook: se simulará la impresión del ticket ${payload.ticketNumber}.`
        )
        this.logger.log(
          `[terminal] Simulación de impresión: ticket ${payload.ticketNumber} (${payload.serviceName}).`
        )
        return
      }

      throw new InternalServerErrorException(
        'No pudimos contactar el servicio de impresión. Intente nuevamente más tarde.'
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Delegación al navegador (solo si está explícitamente habilitado).
   * - Prioriza env TERIMINAL_KIOSK_PRINTING_ENABLED
   * - Si no está en env, consulta system settings: "kioskPrintingEnabled"
   */
  private async shouldDelegateToBrowserPrinting(): Promise<boolean> {
    if (this.envBrowserPrintingEnabled !== null) {
      return this.envBrowserPrintingEnabled
    }

    try {
      const kioskSetting = await this.systemSettings.find('kioskPrintingEnabled')
      const normalized = kioskSetting?.value?.trim().toLowerCase() ?? ''

      if (!normalized) return false
      if (truthyStrings.has(normalized)) return true
      if (falsyStrings.has(normalized)) return false

      return normalized === 'true'
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.logger.warn(
        `[terminal] No se pudo determinar si la impresión por navegador está habilitada: ${err.message}`,
        err.stack
      )
      return false
    }
  }

  /**
   * Resuelve la configuración de webhook (URL y token):
   * - Primero variables de entorno
   * - Luego system settings: "terminal.printWebhookUrl" y "terminal.printWebhookToken"
   */
  private async resolveWebhookConfig(): Promise<{ url: string; token: string | null } | null> {
    // 1) ENV tiene prioridad
    if (this.envWebhookUrl) {
      return { url: this.envWebhookUrl, token: this.envWebhookToken }
    }

    // 2) System settings
    try {
      const [urlSetting, tokenSetting] = await Promise.all([
        this.systemSettings.find('terminal.printWebhookUrl'),
        this.systemSettings.find('terminal.printWebhookToken'),
      ])

      const rawUrl = urlSetting?.value?.trim() ?? ''
      if (!rawUrl) return null

      if (!isHttpUrl(rawUrl)) {
        if (!this.hasWarnedAboutInvalidWebhook) {
          this.logger.warn(
            `[terminal] La URL configurada para 'terminal.printWebhookUrl' es inválida. Debe comenzar con http:// o https:// (recibido: ${rawUrl}).`
          )
          this.hasWarnedAboutInvalidWebhook = true
        }
        return null
      }

      const rawToken = tokenSetting?.value?.trim() ?? ''
      return { url: rawUrl, token: rawToken || null }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.logger.error(
        `[terminal] No se pudo obtener la configuración del webhook de impresión: ${err.message}`,
        err.stack
      )
      throw new InternalServerErrorException(
        'No pudimos obtener la configuración de impresión. Intente nuevamente más tarde.'
      )
    }
  }
}
