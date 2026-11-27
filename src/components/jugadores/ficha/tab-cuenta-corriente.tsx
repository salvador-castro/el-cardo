import { PaperclipIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import type { ComponentProps } from "react"

import { AnularPago, RegistrarDevolucion } from "@/components/cobros/dialogos-pago"
import {
  ETIQUETA_CONCEPTO,
  ETIQUETA_MEDIO_PAGO,
  InsigniaEstadoCobro,
  saldoCobro,
  type ConceptoCobro,
  type EstadoCobro,
  type MedioPago,
} from "@/components/cobros/insignias-cobro"
import { ModalCobrar } from "@/components/cobros/modal-cobrar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatearFecha, formatearMonto } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { EnviarMensaje } from "./enviar-mensaje"

type Cobro = {
  id: string
  concepto: ConceptoCobro
  descripcion: string
  periodo: string | null
  monto: number
  monto_pagado: number
  vencimiento: string
  estado: EstadoCobro
  medio_pago: MedioPago | null
  pagado_at: string | null
  nota: string | null
}

type Pago = {
  id: string
  monto: number
  medio: MedioPago
  pagado_at: string
  nota: string | null
  anulado: boolean
  anulado_motivo: string | null
  mp_payment_id: string | null
  comprobante_url: string | null
  aplicaciones: { monto: number; cobro: { id: string; descripcion: string; estado: EstadoCobro } }[]
}

type Devolucion = { id: string; monto: number; medio: MedioPago; fecha: string; nota: string | null }

export function TabCuentaCorriente({
  jugador,
  cobros,
  pagos,
  devoluciones,
  saldoAFavor,
  contacto,
}: {
  jugador: { id: string; nombre: string }
  cobros: Cobro[]
  pagos: Pago[]
  devoluciones: Devolucion[]
  saldoAFavor: number
  contacto: ComponentProps<typeof EnviarMensaje>
}) {
  const impagos = cobros.filter((c) => c.estado === "pendiente" || c.estado === "vencido")
  const resto = cobros.filter((c) => c.estado !== "pendiente" && c.estado !== "vencido")
  const totalAdeudado = impagos.reduce((t, c) => t + saldoCobro(c), 0)
  const totalPagado = pagos.filter((p) => !p.anulado).reduce((t, p) => t + p.monto, 0)
  const vencidos = impagos.filter((c) => c.estado === "vencido").length

  return (
    <div className="space-y-4">
      <div className={cn("grid gap-3 sm:items-stretch", saldoAFavor > 0 ? "sm:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]")}>
        <div className={cn("rounded-xl border bg-card px-4 py-3", totalAdeudado > 0 && "border-destructive/30")}>
          <p className="text-xs text-muted-foreground">Adeudado</p>
          <p className={cn("font-heading text-3xl font-semibold tabular-nums", totalAdeudado > 0 && "text-destructive")}>
            {formatearMonto(totalAdeudado)}
          </p>
          {vencidos > 0 && <p className="text-xs text-destructive">{vencidos} vencidos</p>}
        </div>
        {saldoAFavor > 0 && (
          <div className="rounded-xl border border-exito/40 bg-exito-suave/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">Saldo a favor</p>
            <p className="font-heading text-3xl font-semibold text-exito tabular-nums">{formatearMonto(saldoAFavor)}</p>
            <RegistrarDevolucion jugadorId={jugador.id} saldo={saldoAFavor} />
          </div>
        )}
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Pagado (histórico)</p>
          <p className="font-heading text-3xl font-semibold tabular-nums">{formatearMonto(totalPagado)}</p>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <ModalCobrar
            jugador={jugador}
            cobros={impagos}
            saldoAFavor={saldoAFavor}
            trigger={
              <Button size="lg" className="flex-1" disabled={impagos.length === 0}>
                <WalletIcon /> Cobrar
              </Button>
            }
          />
          <EnviarMensaje {...contacto} className="flex-1" />
        </div>
      </div>

      <ListaCobros titulo="Pendientes" cobros={impagos} vacio="No tiene cobros pendientes." />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl font-semibold">Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 && devoluciones.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no registró pagos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pagos.map((p) => (
                <li key={p.id} className={cn("flex items-start gap-3 py-3", p.anulado && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatearFecha(p.pagado_at)} · {ETIQUETA_MEDIO_PAGO[p.medio]}
                      {p.anulado && <Badge variant="outline" className="ml-2">Anulado</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.aplicaciones.length
                        ? p.aplicaciones
                            .map((a) => `${a.cobro.descripcion} (${formatearMonto(a.monto)}${a.cobro.estado === "anulado" ? ", anulado: a favor" : ""})`)
                            .join(" · ")
                        : "Sin aplicar: queda a favor"}
                    </p>
                    {(p.nota || p.anulado_motivo) && (
                      <p className="text-xs text-muted-foreground italic">{p.anulado ? `Anulado: ${p.anulado_motivo}` : p.nota}</p>
                    )}
                    {p.comprobante_url && (
                      <a
                        href={p.comprobante_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-dorado-oscuro hover:underline"
                      >
                        <PaperclipIcon className="size-3" /> Comprobante
                      </a>
                    )}
                  </div>
                  <span className={cn("font-medium tabular-nums", p.anulado && "line-through")}>{formatearMonto(p.monto)}</span>
                  {!p.anulado && p.medio !== "mercadopago" && <AnularPago pagoId={p.id} monto={p.monto} />}
                </li>
              ))}
              {devoluciones.map((d) => (
                <li key={d.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatearFecha(d.fecha)} · Devolución por {ETIQUETA_MEDIO_PAGO[d.medio].toLowerCase()}
                    </p>
                    {d.nota && <p className="text-xs text-muted-foreground italic">{d.nota}</p>}
                  </div>
                  <span className="font-medium text-destructive tabular-nums">−{formatearMonto(d.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ListaCobros titulo="Historial de cobros" cobros={resto} vacio="Sin movimientos." />
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
            {cobros.map((c) => {
              const impago = c.estado === "pendiente" || c.estado === "vencido"
              return (
                <li key={c.id} className={cn("flex items-center gap-3 py-3", c.estado === "anulado" && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <Link href={`/cobros/${c.id}`} className="block truncate font-medium hover:underline">
                      {c.descripcion}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {ETIQUETA_CONCEPTO[c.concepto]} ·{" "}
                      {c.estado === "pagado" && c.pagado_at
                        ? `Pagado el ${formatearFecha(c.pagado_at)}${c.medio_pago ? ` · ${ETIQUETA_MEDIO_PAGO[c.medio_pago]}` : ""}`
                        : `Vence ${formatearFecha(c.vencimiento)}`}
                      {impago && c.monto_pagado > 0 && ` · pagó ${formatearMonto(c.monto_pagado)} de ${formatearMonto(c.monto)}`}
                    </p>
                    {c.nota && <p className="truncate text-xs text-muted-foreground italic">{c.nota}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium tabular-nums">{formatearMonto(impago ? saldoCobro(c) : c.monto)}</span>
                    <InsigniaEstadoCobro estado={c.estado} parcial={c.monto_pagado > 0} />
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{vacio}</p>
        )}
      </CardContent>
    </Card>
  )
}
