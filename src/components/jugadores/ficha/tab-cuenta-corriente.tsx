import { WalletIcon } from "lucide-react"
import type { ComponentProps } from "react"

import {
  ETIQUETA_CONCEPTO,
  ETIQUETA_MEDIO_PAGO,
  InsigniaEstadoCobro,
  type ConceptoCobro,
  type EstadoCobro,
  type MedioPago,
} from "@/components/cobros/insignias-cobro"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EnviarMensaje } from "./enviar-mensaje"
import { formatearFecha, formatearMonto } from "@/lib/formato"
import { cn } from "@/lib/utils"

type Cobro = {
  id: string
  concepto: ConceptoCobro
  descripcion: string
  periodo: string | null
  monto: number
  vencimiento: string
  estado: EstadoCobro
  medio_pago: MedioPago | null
  pagado_at: string | null
  nota: string | null
}

export function TabCuentaCorriente({
  cobros,
  contacto,
}: {
  cobros: Cobro[]
  contacto: ComponentProps<typeof EnviarMensaje>
}) {
  const impagos = cobros.filter((c) => c.estado === "pendiente" || c.estado === "vencido")
  const resto = cobros.filter((c) => c.estado !== "pendiente" && c.estado !== "vencido")
  const totalAdeudado = impagos.reduce((t, c) => t + Number(c.monto), 0)
  const totalPagado = cobros.filter((c) => c.estado === "pagado").reduce((t, c) => t + Number(c.monto), 0)
  const vencidos = impagos.filter((c) => c.estado === "vencido").length

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-stretch">
        <div className={cn("rounded-xl border bg-card px-4 py-3", totalAdeudado > 0 && "border-destructive/30")}>
          <p className="text-xs text-muted-foreground">Adeudado</p>
          <p className={cn("font-heading text-3xl font-semibold tabular-nums", totalAdeudado > 0 && "text-destructive")}>
            {formatearMonto(totalAdeudado)}
          </p>
          {vencidos > 0 && <p className="text-xs text-destructive">{vencidos} vencidos</p>}
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Pagado (histórico)</p>
          <p className="font-heading text-3xl font-semibold tabular-nums">{formatearMonto(totalPagado)}</p>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span: el tooltip funciona aunque el botón esté deshabilitado */}
              <span className="flex flex-1">
                <Button size="lg" className="w-full" disabled>
                  <WalletIcon /> Cobrar
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Se habilita con Mercado Pago (etapa 5).</TooltipContent>
          </Tooltip>
          <EnviarMensaje {...contacto} className="flex-1" />
        </div>
      </div>

      <ListaCobros titulo="Pendientes" cobros={impagos} vacio="No tiene cobros pendientes." />
      <ListaCobros titulo="Historial" cobros={resto} vacio="Sin movimientos." />
    </div>
  )
}

function ListaCobros({ titulo, cobros, vacio }: { titulo: string; cobros: Cobro[]; vacio: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl font-semibold">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        {cobros.length ? (
          <ul className="divide-y divide-border">
            {cobros.map((c) => (
              <li key={c.id} className={cn("flex items-center gap-3 py-3", c.estado === "anulado" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.descripcion}</p>
                  <p className="text-xs text-muted-foreground">
                    {ETIQUETA_CONCEPTO[c.concepto]} ·{" "}
                    {c.estado === "pagado" && c.pagado_at
                      ? `Pagado el ${formatearFecha(c.pagado_at)}${c.medio_pago ? ` · ${ETIQUETA_MEDIO_PAGO[c.medio_pago]}` : ""}`
                      : `Vence ${formatearFecha(c.vencimiento)}`}
                  </p>
                  {c.nota && <p className="truncate text-xs text-muted-foreground italic">{c.nota}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-medium tabular-nums">{formatearMonto(c.monto)}</span>
                  <InsigniaEstadoCobro estado={c.estado} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{vacio}</p>
        )}
      </CardContent>
    </Card>
  )
}
