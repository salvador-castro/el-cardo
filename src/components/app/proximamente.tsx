import { HammerIcon } from "lucide-react"

// Marcador para los módulos que se construyen en etapas siguientes.
export function Proximamente({ etapa, detalle }: { etapa: number; detalle: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-dorado/15 text-dorado-oscuro">
        <HammerIcon className="size-6" />
      </span>
      <p className="font-marca text-[0.65rem] text-dorado-oscuro">Etapa {etapa}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{detalle}</p>
    </div>
  )
}
