"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // contenedor
        "inline-flex h-9 w-fit items-center justify-center p-[3px] flex",
        // paleta
        "bg-muted text-muted-foreground",
        // forma (Figma sugiere xl; antes teníamos lg)
        "rounded-xl",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // base
        "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-2 py-1 text-sm font-medium",
        "transition-[color,box-shadow] outline-none",
        // altura/encastre con el List (de Figma)
        "h-[calc(100%-1px)]",
        // forma
        "rounded-xl border border-transparent",
        // estados
        "text-muted-foreground data-[state=active]:text-foreground",
        // activo: mezclamos nuestro bg/border/shadow con variantes de Figma
        "data-[state=active]:bg-card dark:data-[state=active]:bg-input/30",
        "data-[state=active]:border-border dark:data-[state=active]:border-input",
        "data-[state=active]:shadow-sm",
        // focus accesible (mezcla)
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
        // disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // íconos
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
