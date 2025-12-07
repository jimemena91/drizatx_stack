"use client"

import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type ButtonVariant = React.ComponentProps<typeof Button>["variant"]
type ButtonSize = React.ComponentProps<typeof Button>["size"]

type Props = {
  operatorId: number
  onChanged?: () => void
  disabled?: boolean
  triggerLabel?: string
  triggerVariant?: ButtonVariant
  triggerSize?: ButtonSize
  triggerClassName?: string
  triggerIcon?: ReactNode
}

export default function ChangePasswordDialog({
  operatorId,
  onChanged,
  disabled,
  triggerLabel = "Cambiar contraseña",
  triggerVariant = "secondary",
  triggerSize = "default",
  triggerClassName,
  triggerIcon,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState("")
  const [pwd2, setPwd2] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const showError = (description: string) =>
    toast({
      title: "No se pudo actualizar la contraseña",
      description,
      variant: "destructive",
    })

  const validate = () => {
    if (pwd.length < 3) return "La contraseña debe tener al menos 3 caracteres."
    if (pwd !== pwd2) return "Las contraseñas no coinciden."
    return null
  }

  const onSubmit = async () => {
    const err = validate()
    if (err) {
      showError(err)
      return
    }
    try {
      setLoading(true)
      await apiClient.patch(`/operators/${operatorId}/password`, { password: pwd })
      toast({
        title: "Contraseña actualizada",
        description: "Guardamos los cambios correctamente.",
      })
      setOpen(false)
      setPwd("")
      setPwd2("")
      onChanged?.()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Error al actualizar la contraseña"
      showError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className={cn("justify-center", triggerClassName)}
          disabled={disabled}
        >
          {triggerIcon}
          <span>{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="La contraseña debe tener al menos 3 caracteres."
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="repeat-password">Repetir contraseña</Label>
            <Input
              id="repeat-password"
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="Repetir contraseña"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
