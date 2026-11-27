import { InfoIcon } from "lucide-react"
import Link from "next/link"

import { ETIQUETA_MEDIO_PAGO, InsigniaEstadoCobro, type EstadoCobro, type MedioPago } from "@/components/cobros/insignias-cobro"
import { formatearFecha, formatearMonto } from "@/lib/formato"
import { cn } from "@/lib/utils"

export type CobroActividad = {
  id: string
  jugador: { id: string; nombre: string; apellido: string }
  monto: number
  monto_pagado: number
  vencimiento: string
  estado: EstadoCobro
  medio_pago: MedioPago | null
  pagado_at: string | null
  nota: string | null
}

const ORDEN: Record<EstadoCobro, number> = { vencido: 0, pendiente: 1, pagado: 2, bonificado: 3, anulado: 4 }

// Solo consulta: los cobros se gestionan en el módulo de Cobros (etapa 5).
export function TabCobros({ cobros, precio }: { cobros: CobroActividad[]; precio: number }) {
  const suma = (estados: EstadoCobro[]) =>
    cobros.filter((c) => estados.includes(c.estado)).reduce((t, c) => t + c.monto, 0)
  const esperado = suma(["pendiente", "vencido", "pagado"])
  const cobrado = cobros
    .filter((c) => ["pendiente", "vencido", "pagado"].includes(c.estado))
    .reduce((t, c) => t + c.monto_pagado, 0)
  const vencido = suma(["vencido"])

  const lista = [...cobros].sort(
    (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.jugador.apellido.localeCompare(b.jugador.apellido, "es"),
  )

  if (precio <= 0 && cobros.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
        La actividad es sin cargo: no genera cobros.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Resumen etiqueta="Esperado" valor={formatearMonto(esperado)} />
        <Resumen etiqueta="Cobrado" valor={formatearMonto(cobrado)} clase="text-exito" />
        <Resumen etiqueta="Falta cobrar" valor={formatearMonto(esperado - cobrado)} />
        <Resumen etiqueta="Vencido" valor={formatearMonto(vencido)} clase={vencido > 0 ? "text-destructive" : undefined} />
      </div>

      <p className="flex items-start gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        Cada jugador anotado genera su cobro. Para cobrar, tocá el nombre del jugador y usá «Cobrar» en su cuenta corriente.
      </p>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay cobros: se generan al anotar jugadores.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {lista.map((c) => (
            <li key={c.id} className={cn("flex items-center gap-3 px-4 py-3", c.estado === "anulado" && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <Link href={`/jugadores/${c.jugador.id}?tab=cuenta`} className="block truncate font-medium hover:underline">
                  {c.jugador.apellido}, {c.jugador.nombre}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {c.estado === "pagado"
                    ? `Pagado ${formatearFecha(c.pagado_at)}${c.medio_pago ? ` · ${ETIQUETA_MEDIO_PAGO[c.medio_pago]}` : ""}`
                    : c.estado === "anulado"
                      ? (c.nota ?? "Anulado")
                      : `Vence ${formatearFecha(c.vencimiento)}${c.monto_pagado > 0 ? ` · pagó ${formatearMonto(c.monto_pagado)}` : ""}`}
                </p>
              </div>
              <span className={cn("font-medium tabular-nums", c.estado === "anulado" && "line-through")}>
                {formatearMonto(c.monto)}
              </span>
              <InsigniaEstadoCobro estado={c.estado} parcial={c.monto_pagado > 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Resumen({ etiqueta, valor, clase }: { etiqueta: string; valor: string; clase?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className={cn("font-heading text-2xl font-semibold tabular-nums", clase)}>{valor}</p>
    </div>
  )
}
