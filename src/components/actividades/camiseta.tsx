import { CheckIcon, ShirtIcon } from "lucide-react"

import { COLOR_CAMISETA, COLORES_CAMISETA, type ColorCamiseta } from "@/lib/actividades/colores"
import { cn } from "@/lib/utils"

export function Camiseta({ color, className }: { color: ColorCamiseta | null; className?: string }) {
  if (!color) return <ShirtIcon className={cn("size-5 text-muted-foreground/50", className)} aria-hidden />
  return (
    <ShirtIcon
      className={cn("size-5 stroke-[1.5] text-foreground/70", className)}
      style={{ fill: COLOR_CAMISETA[color].hex }}
      aria-label={`Camiseta ${COLOR_CAMISETA[color].etiqueta.toLowerCase()}`}
    />
  )
}

// Selector de color de camiseta (lista fija).
export function SelectorCamiseta({
  valor,
  onChange,
  etiqueta,
}: {
  valor: ColorCamiseta | null
  onChange: (c: ColorCamiseta) => void
  etiqueta: string
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="grid grid-cols-5 gap-1.5">
      {COLORES_CAMISETA.map((c) => {
        const elegido = valor === c
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={elegido}
            title={COLOR_CAMISETA[c].etiqueta}
            onClick={() => onChange(c)}
            className={cn(
              "relative flex h-10 items-center justify-center rounded-lg border transition-colors hover:bg-muted/60",
              elegido && "border-marino bg-dorado/10 ring-2 ring-marino/30",
            )}
          >
            <Camiseta color={c} className="size-6" />
            {elegido && (
              <CheckIcon className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-marino p-0.5 text-crema" />
            )}
            <span className="sr-only">{COLOR_CAMISETA[c].etiqueta}</span>
          </button>
        )
      })}
    </div>
  )
}
