// src/lib/audio-service.ts
export interface AudioConfig {
  enabled: boolean
  volume: number
  ticketCalledSound: string
  // dejamos estos campos por compatibilidad, pero NO se usan
  ticketCompletedSound: string
  alertSound: string
  backgroundMusic: boolean
}

export interface AudioEvent {
  type: "ticket-called" | "ticket-completed" | "alert" | "notification"
  ticketNumber?: string
  serviceName?: string
  message?: string
}

class AudioService {
  private audioContext: AudioContext | null = null
  private config: AudioConfig = {
    enabled: true,
    volume: 0.7,
    // ⬇️ RUTA CORRECTA (carpeta singular "sound")
    ticketCalledSound: "/sound/ticket-called.mp3",
    // no usados
    ticketCompletedSound: "",
    alertSound: "",
    backgroundMusic: false,
  }
  private audioCache: Map<string, AudioBuffer> = new Map()
  private isInitialized = false

  async initialize(): Promise<boolean> {
    try {
      const ctx = await this.ensureAudioContext()
      if (!ctx) return false
      await this.preloadSounds()
      this.isInitialized = true
      return true
    } catch (error) {
      console.error("Error initializing audio service:", error)
      return false
    }
  }

  private async ensureAudioContext(): Promise<AudioContext | null> {
    if (!this.config.enabled || typeof window === "undefined") return null
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (error) {
        console.error("AudioContext not available", error)
        return null
      }
    }
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume()
      } catch (error) {
        console.error("Unable to resume AudioContext", error)
        return null
      }
    }
    return this.audioContext
  }

  private async preloadSounds() {
    const sounds = [
      // ⬇️ Solo precargamos "ticket-called"
      { key: "ticket-called", url: this.config.ticketCalledSound },
    ]

    for (const sound of sounds) {
      if (!sound.url) continue

      try {
        if (process.env.NODE_ENV === "development") {
          // Dev: si querés, podés dejar sintético
          const buffer = this.createSyntheticSound(sound.key)
          this.audioCache.set(sound.key, buffer)
        } else {
          // Prod: verificamos existencia con HEAD para evitar EncodingError
          const head = await fetch(sound.url, { method: "HEAD", cache: "no-store" })
          if (!head.ok) throw new Error(`HTTP ${head.status} for ${sound.url}`)

          const response = await fetch(sound.url, { cache: "no-store" })
          const arrayBuffer = await response.arrayBuffer()
          // decodeAudioData promisificado por compatibilidad
          const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
            this.audioContext!.decodeAudioData(arrayBuffer, resolve, reject)
          })
          this.audioCache.set(sound.key, audioBuffer)
        }
      } catch (error) {
        console.warn(`Failed to load sound: ${sound.key}`, error)
        const buffer = this.createSyntheticSound(sound.key) // fallback
        this.audioCache.set(sound.key, buffer)
      }
    }
  }

  private createSyntheticSound(type: string): AudioBuffer {
    if (!this.audioContext) throw new Error("Audio context not initialized")
    const sampleRate = this.audioContext.sampleRate
    let duration = 1.2
    let frequency = 800 // un ding corto

    // tono suave tipo “ding”
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      const env = Math.exp(-t * 5) // envolvente
      data[i] = 0.35 * env * Math.sin(2 * Math.PI * frequency * t)
    }
    return buffer
  }

  private async playSound(type: string, options: { volume?: number } = {}): Promise<boolean> {
    if (!this.config.enabled || !this.isInitialized) return false
    const ctx = await this.ensureAudioContext()
    if (!ctx) return false
    try {
      const buffer = this.audioCache.get(type)
      if (!buffer) return false

      const source = ctx.createBufferSource()
      const gainNode = ctx.createGain()

      source.buffer = buffer
      gainNode.gain.value = (options.volume ?? this.config.volume)

      source.connect(gainNode)
      gainNode.connect(ctx.destination)

      source.start()
      return true
    } catch (error) {
      console.error("Error playing sound:", error)
      return false
    }
  }

  async playTicketCalled(_ticketNumber?: string, _serviceName?: string): Promise<boolean> {
    return await this.playSound("ticket-called")
  }

  async playAttentionAlert(): Promise<boolean> {
    const ctx = await this.ensureAudioContext()
    if (!ctx) return false
    try {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const now = ctx.currentTime

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, now)
      oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.5)

      gain.gain.setValueAtTime(this.config.volume, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)

      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.start(now)
      oscillator.stop(now + 0.6)
      return true
    } catch (error) {
      console.error("Error playing attention alert:", error)
      return false
    }
  }

  // ⬇️ No-ops para no intentar cargar otros MP3
  async playTicketCompleted(): Promise<boolean> { return false }
  async playAlert(): Promise<boolean> { return this.playAttentionAlert() }

  // TTS opcional (lo dejo igual)
  async playTextToSpeech(text: string): Promise<boolean> {
    if (!this.config.enabled || !("speechSynthesis" in window)) return false
    try {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "es-ES"
      utterance.volume = this.config.volume
      utterance.rate = 0.9
      utterance.pitch = 1
      speechSynthesis.speak(utterance)
      return true
    } catch (error) {
      console.error("Error with text-to-speech:", error)
      return false
    }
  }

  async announceTicket(ticketNumber: string, serviceName: string, position?: string): Promise<void> {
    await this.playTicketCalled(ticketNumber, serviceName)
    setTimeout(async () => {
      const announcement = position
        ? `Turno ${ticketNumber} para ${serviceName}, diríjase al ${position}`
        : `Turno ${ticketNumber} para ${serviceName}, diríjase al mostrador`
      await this.playTextToSpeech(announcement)
    }, 1000)
  }

  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume))
  }
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }
  getConfig(): AudioConfig { return { ...this.config } }
  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  async requestAudioPermission(): Promise<boolean> {
    try {
      if (this.audioContext?.state === "suspended") {
        await this.audioContext.resume()
      }
      return true
    } catch (error) {
      console.error("Error requesting audio permission:", error)
      return false
    }
  }
}

export const audioService = new AudioService()

if (typeof window !== "undefined") {
  const initializeOnInteraction = async () => {
    await audioService.initialize()
    document.removeEventListener("click", initializeOnInteraction)
    document.removeEventListener("keydown", initializeOnInteraction)
  }
  document.addEventListener("click", initializeOnInteraction, { once: true })
  document.addEventListener("keydown", initializeOnInteraction, { once: true })
}
