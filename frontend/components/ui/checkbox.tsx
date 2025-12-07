"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      // `group` permite estilizar el ícono según el estado (incluye indeterminate)
      className={cn(
        "group size-4 shrink-0 rounded-[4px] border outline-none transition-colors shadow-xs",
        // Base tokens (coherente con tu paleta)
        "bg-input-background dark:bg-input/30 border-input",
        // Hover sutil
        "hover:bg-muted/50",
        // Estados (checked/indeterminate)
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground",
        // Accesibilidad (focus ring)
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
        // Estados de error
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        // Deshabilitado
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        {/* Checked */}
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden" />
        {/* Indeterminate */}
        <MinusIcon className="size-3.5 hidden group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
