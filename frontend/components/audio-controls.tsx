"use client"

import { useState, useEffect } from "react"
import { Volume2, VolumeX, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { audioService } from "@/lib/audio-service"

interface AudioControlsProps {
  showSettings?: boolean
  compact?: boolean
}

export function AudioControls({ showSettings = false, compact = false }: AudioControlsProps) {
  const [config, setConfig] = useState(audioService.getConfig())
  const [showPanel, setShowPanel] = useState(showSettings)

  useEffect(() => {
    setConfig(audioService.getConfig())
  }, [])

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100
    audioService.setVolume(newVolume)
    setConfig({ ...config, volume: newVolume })
  }

  const handleEnabledChange = (enabled: boolean) => {
    audioService.setEnabled(enabled)
    setConfig({ ...config, enabled })
  }

  const testSound = async () => {
    await audioService.playTicketCalled("A001", "Atención General")
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => handleEnabledChange(!config.enabled)} className="h-8 w-8 p-0">
          {config.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowPanel(!showPanel)} className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <Card className={showPanel ? "w-80" : "w-auto"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Control de Audio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Sonido habilitado</span>
          <Switch checked={config.enabled} onCheckedChange={handleEnabledChange} />
        </div>

        {config.enabled && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Volumen</span>
                <span className="text-xs text-gray-500">{Math.round(config.volume * 100)}%</span>
              </div>
              <Slider
                value={[config.volume * 100]}
                onValueChange={handleVolumeChange}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <Button variant="outline" size="sm" onClick={testSound} className="w-full bg-transparent">
              Probar Sonido
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
