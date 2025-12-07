// components/ui/skeleton.tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // Mantiene animación y shape
        "animate-pulse rounded-md",
        // Paleta adaptada al nuevo esquema (Figma sugirió `bg-accent`)
        // pero conservamos compatibilidad: si usabas `bg-muted`, seguirá siendo
        // fácil de sobreescribir vía className.
        "bg-accent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
