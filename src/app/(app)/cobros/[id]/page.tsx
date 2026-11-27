import { ChevronLeftIcon, WalletIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccionesCobro } from "@/components/cobros/acciones-cobro"
import {
  ETIQUETA_CONCEPTO,
  ETIQUETA_MEDIO_PAGO,
  InsigniaEstadoCobro,
  saldoCobro,
  type CobroImpago,
} from "@/components/cobros/insignias-cobro"
import { ModalCobrar } from "@/components/cobros/modal-cobrar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirUsuario } from "@/lib/auth"
import { formatearFecha, formatearHora, formatearMonto } from "@/lib/formato"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"

export const metadata: Metadata = { title: "Cobro" }

const ETIQUETA_EVENTO: Record<Enums<"tipo_evento_cobro">, string> = {
  creado: "Creado",
  link_generado: "Link de pago generado",
  enviado: "Enviado",
  pagado: "Pagado",
  vencido: "Venció",
  anulado: "Anulado",
  bonificado: "Bonificado",
  reactivado: "Volvió a estar pendiente",
  monto_modificado: "Cambió el monto",
  link_invalidado: "Link de pago anulado",
  pago_a_revisar: "Pago a revisar",
  pago_parcial: "Pago parcial",
  pago_anulado: "Pago anulado",
}

export default async function DetalleCobroPage({ params }: PageProps<"/cobros/[id]">) {
  await requerirUsuario()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const { data: c, error } = await supabase
    .from("cobros")
    .select(
      "id, concepto, descripcion, periodo, monto, monto_pagado, vencimiento, estado, medio_pago, pagado_at, nota, created_at, jugador:jugadores(id, nombre, apellido), actividad:actividades(id, nombre, tipo)",
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!c) notFound()

  const [eventosRes, aplicacionesRes, impagosRes, jugadorRes] = await Promise.all([
    supabase
      .from("cobro_eventos")
      .select("id, tipo, detalle, created_at, usuario:perfiles(nombre)")
      .eq("cobro_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("pago_aplicaciones")
      .select("monto, pago:pagos(id, monto, medio, pagado_at, nota, anulado)")
      .eq("cobro_id", id),
    supabase
      .from("cobros")
      .select("id, descripcion, vencimiento, estado, monto, monto_pagado")
      .eq("jugador_id", c.jugador.id)
      .in("estado", ["pendiente", "vencido"]),
    supabase.from("jugadores_resumen").select("saldo_a_favor").eq("id", c.jugador.id).maybeSingle(),
  ])

  const monto = Number(c.monto)
  const pagado = Number(c.monto_pagado)
  const impago = c.estado === "pendiente" || c.estado === "vencido"
  const saldo = impago ? saldoCobro({ monto, monto_pagado: pagado }) : 0
  const impagos: CobroImpago[] = (impagosRes.data ?? []).map((x) => ({ ...x, monto: Number(x.monto), monto_pagado: Number(x.monto_pagado) }))
  const nombreJugador = `${c.jugador.nombre} ${c.jugador.apellido}`
  const rutaActividad = c.actividad ? `/${c.actividad.tipo === "torneo" ? "torneos" : "actividades"}/${c.actividad.id}` : null

  return (
    <>
      <Link
        href={`/jugadores/${c.jugador.id}?tab=cuenta`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" /> {nombreJugador}
      </Link>

      <div className="mb-6 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{ETIQUETA_CONCEPTO[c.concepto]}</p>
            <h1 className="font-heading text-2xl leading-tight font-semibold sm:text-4xl">{c.descripcion}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/jugadores/${c.jugador.id}`} className="font-medium text-foreground hover:underline">
                {nombreJugador}
              </Link>
              {c.actividad && rutaActividad && (
                <>
                  {" · "}
                  <Link href={rutaActividad} className="hover:underline">
                    {c.actividad.nombre}
                  </Link>
                </>
              )}
            </p>
            <div className="mt-2">
              <InsigniaEstadoCobro estado={c.estado} parcial={pagado > 0} />
            </div>
          </div>
          <div className="text-right">
            <p className="font-heading text-4xl font-semibold tabular-nums">{formatearMonto(impago ? saldo : monto)}</p>
            <p className="text-xs text-muted-foreground">
              {impago ? (pagado > 0 ? `falta pagar · pagó ${formatearMonto(pagado)} de ${formatearMonto(monto)}` : "a pagar") : "monto"}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Vencimiento</dt>
            <dd className={cn("font-medium", c.estado === "vencido" && "text-destructive")}>{formatearFecha(c.vencimiento)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{c.estado === "pagado" ? "Pagado" : "Creado"}</dt>
            <dd className="font-medium">
              {c.estado === "pagado" && c.pagado_at
                ? `${formatearFecha(c.pagado_at)}${c.medio_pago ? ` · ${ETIQUETA_MEDIO_PAGO[c.medio_pago]}` : ""}`
                : formatearFecha(c.created_at)}
            </dd>
          </div>
          {c.nota && (
            <div>
              <dt className="text-xs text-muted-foreground">Nota</dt>
              <dd className="font-medium">{c.nota}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {impago && (
            <ModalCobrar
              jugador={{ id: c.jugador.id, nombre: nombreJugador }}
              cobros={impagos}
              saldoAFavor={Number(jugadorRes.data?.saldo_a_favor ?? 0)}
              preseleccion={[c.id]}
              trigger={
                <Button size="lg">
                  <WalletIcon /> Cobrar
                </Button>
              }
            />
          )}
          <AccionesCobro cobroId={c.id} monto={monto} montoPagado={pagado} impago={impago} anulado={c.estado === "anulado"} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold">Pagos aplicados</CardTitle>
          </CardHeader>
          <CardContent>
            {(aplicacionesRes.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Todavía no tiene pagos.</p>
            ) : (
              <ul className="divide-y">
                {(aplicacionesRes.data ?? []).map((a) => (
                  <li key={a.pago.id} className={cn("flex items-center gap-3 py-2.5", a.pago.anulado && "opacity-60")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatearFecha(a.pago.pagado_at)} · {ETIQUETA_MEDIO_PAGO[a.pago.medio]}
                        {a.pago.anulado && " · anulado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Number(a.monto) < Number(a.pago.monto)
                          ? `De un pago de ${formatearMonto(Number(a.pago.monto))} que cubrió varios cobros`
                          : (a.pago.nota ?? "")}
                      </p>
                    </div>
                    <span className={cn("font-medium tabular-nums", a.pago.anulado && "line-through")}>
                      {formatearMonto(Number(a.monto))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl font-semibold">Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(eventosRes.data ?? []).map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-dorado" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {ETIQUETA_EVENTO[e.tipo]}
                      {e.detalle && <span className="font-normal text-muted-foreground"> · {e.detalle}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatearFecha(e.created_at)} {formatearHora(e.created_at)} h{e.usuario ? ` · ${e.usuario.nombre}` : " · Sistema"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
