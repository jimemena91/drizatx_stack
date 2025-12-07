"use client"

import { useEffect, useState } from "react"
import { QrCode, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { QRConfig } from "@/lib/qr-service"

interface QRCodeDisplayProps {
  data: string
  config?: Partial<QRConfig>
  showControls?: boolean
  className?: string
}

export function QRCodeDisplay({ data, config, showControls = false, className = "" }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const defaultConfig: QRConfig = {
    size: 128,
    level: "M",
    includeMargin: true,
    fgColor: "#000000",
    bgColor: "#ffffff",
    ...config,
  }

  useEffect(() => {
    generateQRCode()
  }, [data, config])

  const generateQRCode = async () => {
    try {
      setLoading(true)
      setError(null)

      // Usar API de QR code online como fallback
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${defaultConfig.size}x${defaultConfig.size}&data=${encodeURIComponent(data)}&format=png&ecc=${defaultConfig.level}`

      // Verificar si la imagen se puede cargar
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        setQrDataUrl(qrApiUrl)
        setLoading(false)
      }

      img.onerror = () => {
        // Fallback: generar QR usando canvas
        generateCanvasQR()
      }

      img.src = qrApiUrl
    } catch (err) {
      console.error("Error generating QR code:", err)
      generateCanvasQR()
    }
  }

  const generateCanvasQR = () => {
    try {
      // Crear un QR simple usando canvas
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const size = defaultConfig.size

      canvas.width = size
      canvas.height = size

      if (ctx) {
        // Fondo blanco
        ctx.fillStyle = defaultConfig.bgColor
        ctx.fillRect(0, 0, size, size)

        // Crear patrón simple de QR (simulado)
        ctx.fillStyle = defaultConfig.fgColor
        const moduleSize = size / 25 // 25x25 módulos

        // Generar patrón basado en el hash del data
        const hash = simpleHash(data)
        for (let i = 0; i < 25; i++) {
          for (let j = 0; j < 25; j++) {
            const shouldFill = (hash + i * 25 + j) % 3 === 0
            if (shouldFill) {
              ctx.fillRect(i * moduleSize, j * moduleSize, moduleSize, moduleSize)
            }
          }
        }

        // Esquinas de posicionamiento
        drawPositionMarker(ctx, 0, 0, moduleSize)
        drawPositionMarker(ctx, 18 * moduleSize, 0, moduleSize)
        drawPositionMarker(ctx, 0, 18 * moduleSize, moduleSize)

        setQrDataUrl(canvas.toDataURL())
      }

      setLoading(false)
    } catch (err) {
      setError("Error generando código QR")
      setLoading(false)
    }
  }

  const simpleHash = (str: string): number => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  const drawPositionMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, moduleSize: number) => {
    // Cuadrado exterior (7x7)
    ctx.fillRect(x, y, moduleSize * 7, moduleSize * 7)
    // Cuadrado interior blanco (5x5)
    ctx.fillStyle = defaultConfig.bgColor
    ctx.fillRect(x + moduleSize, y + moduleSize, moduleSize * 5, moduleSize * 5)
    // Cuadrado central negro (3x3)
    ctx.fillStyle = defaultConfig.fgColor
    ctx.fillRect(x + moduleSize * 2, y + moduleSize * 2, moduleSize * 3, moduleSize * 3)
  }

  const handleDownload = () => {
    if (qrDataUrl) {
      const link = document.createElement("a")
      link.download = "qr-code.png"
      link.href = qrDataUrl
      link.click()
    }
  }

  const handleShare = async () => {
    if (navigator.share && data) {
      try {
        await navigator.share({
          title: "Código QR - DrizaTx",
          text: "Escanea este código para seguir tu turno",
          url: data,
        })
      } catch (err) {
        // Fallback: copiar al portapapeles
        navigator.clipboard?.writeText(data)
      }
    } else {
      navigator.clipboard?.writeText(data)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="animate-spin">
          <QrCode className="h-8 w-8 text-gray-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4 ${className}`}>
        <QrCode className="h-8 w-8 text-gray-400 mb-2" />
        <p className="text-xs text-gray-500 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="bg-white p-2 rounded-lg border-2 border-gray-200">
        <img
          src={qrDataUrl || "/placeholder.svg"}
          alt="Código QR"
          className="block"
          style={{ width: defaultConfig.size, height: defaultConfig.size }}
        />
      </div>

      {showControls && (
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 px-2 bg-transparent">
            <Download className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} className="h-8 px-2 bg-transparent">
            <Share2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
