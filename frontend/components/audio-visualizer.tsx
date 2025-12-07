"use client"

import { useEffect, useState } from "react"
import { Volume2, Music } from "lucide-react"

interface AudioVisualizerProps {
  isPlaying: boolean
  type: "announcement" | "background" | "alert"
  className?: string
}

export function AudioVisualizer({ isPlaying, type, className = "" }: AudioVisualizerProps) {
  const [bars, setBars] = useState<number[]>(Array(8).fill(0))

  useEffect(() => {
    if (!isPlaying) {
      setBars(Array(8).fill(0))
      return
    }

    const interval = setInterval(() => {
      setBars((prev) => prev.map(() => Math.random() * 100))
    }, 100)

    return () => clearInterval(interval)
  }, [isPlaying])

  const getIcon = () => {
    switch (type) {
      case "background":
        return <Music className="h-4 w-4" />
      default:
        return <Volume2 className="h-4 w-4" />
    }
  }

  const getColor = () => {
    switch (type) {
      case "announcement":
        return "bg-yellow-400"
      case "background":
        return "bg-blue-400"
      case "alert":
        return "bg-red-400"
      default:
        return "bg-gray-400"
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${isPlaying ? "animate-pulse" : ""}`}>{getIcon()}</div>

      <div className="flex items-end gap-1 h-6">
        {bars.map((height, index) => (
          <div
            key={index}
            className={`w-1 transition-all duration-100 ${getColor()} ${isPlaying ? "opacity-100" : "opacity-30"}`}
            style={{ height: `${Math.max(height * 0.24, 4)}px` }}
          />
        ))}
      </div>
    </div>
  )
}
