import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  className,
}: {
  titulo: string
  descripcion?: ReactNode
  acciones?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}
