import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type SpinnerProps = {
  className?: string
  label?: string
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)} role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
    </div>
  )
}
