import { AlertTriangleIcon, CalendarDaysIcon, UsersIcon, WalletIcon, type LucideIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirUsuario } from "@/lib/auth"
import { ZONA_HORARIA, formatearFechaLarga, formatearHora, formatearMonto } from "@/lib/formato"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Inicio" }

const ETIQUETA_TIPO = { practica: "Práctica", clase: "Clase", torneo: "Torneo" } as const

function inicioDeMesAR() {
  const [anio, mes] = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
  return `${anio}-${mes}-01T00:00:00-03:00`
}

export default async function InicioPage() {
  const usuario = await requerirUsuario()
  const supabase = await createClient()
  const ahora = new Date().toISOString()

  const [jugadores, adeudados, pagadosMes, proximas, alertas] = await Promise.all([
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("cobros").select("monto, estado").in("estado", ["pendiente", "vencido"]),
    supabase.from("cobros").select("monto").eq("estado", "pagado").gte("pagado_at", inicioDeMesAR()),
    supabase
      .from("actividades_resumen")
      .select("id, tipo, nombre, inicio, participantes")
      .eq("estado", "programada")
      .gte("inicio", ahora)
      .order("inicio")
      .limit(5),
    supabase
      .from("jugadores_resumen")
      .select("id", { count: "exact", head: true })
      .eq("activo", true)
      .in("apto_estado", ["vencido", "sin_apto"]),
  ])

  const error = jugadores.error ?? adeudados.error ?? pagadosMes.error ?? proximas.error ?? alertas.error
  if (error) throw new Error(error.message)

  const pendiente = (adeudados.data ?? []).reduce((t, c) => t + Number(c.monto), 0)
  const vencidos = (adeudados.data ?? []).filter((c) => c.estado === "vencido")
  const recaudado = (pagadosMes.data ?? []).reduce((t, c) => t + Number(c.monto), 0)

  const primerNombre = usuario.nombre.split(" ")[0]

  return (
    <>
      <EncabezadoPagina titulo={`Hola, ${primerNombre}`} descripcion={formatearFechaLarga(new Date())} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador titulo="Jugadores activos" valor={String(jugadores.count ?? 0)} icono={UsersIcon} href="/jugadores" />
        <Indicador titulo="Recaudado este mes" valor={formatearMonto(recaudado)} icono={WalletIcon} href="/cobros" />
        <Indicador
          titulo="Pendiente de cobro"
          valor={formatearMonto(pendiente)}
          detalle={`${vencidos.length} vencidos`}
          icono={WalletIcon}
          href="/cobros"
          tono={vencidos.length ? "alerta" : undefined}
        />
        <Indicador
          titulo="Sin apto vigente"
          valor={String(alertas.count ?? 0)}
          detalle="jugadores activos"
          icono={AlertTriangleIcon}
          href="/jugadores"
          tono={alertas.count ? "alerta" : undefined}
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-2xl font-semibold">Próximas actividades</CardTitle>
          <Link href="/actividades" className="text-sm font-medium text-dorado-oscuro hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent>
          {proximas.data?.length ? (
            <ul className="divide-y divide-border">
              {proximas.data.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.tipo === "torneo" ? `/torneos/${a.id}` : `/actividades/${a.id}`}
                    className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-marino text-crema">
                      <CalendarDaysIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatearFechaLarga(a.inicio)} · {formatearHora(a.inicio)} h
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {a.tipo && <Badge variant="secondary">{ETIQUETA_TIPO[a.tipo]}</Badge>}
                      <span className="text-xs text-muted-foreground">{a.participantes ?? 0} anotados</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay actividades programadas.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Indicador({
  titulo,
  valor,
  detalle,
  icono: Icono,
  href,
  tono,
}: {
  titulo: string
  valor: string
  detalle?: string
  icono: LucideIcon
  href: string
  tono?: "alerta"
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full gap-2 py-4 transition-shadow group-hover:shadow-md">
        <CardContent className="px-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{titulo}</p>
            <Icono className={tono === "alerta" ? "size-4 text-alerta" : "size-4 text-dorado-oscuro"} />
          </div>
          <p className="mt-2 font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{valor}</p>
          {detalle && (
            <p className={tono === "alerta" ? "mt-0.5 text-xs text-alerta" : "mt-0.5 text-xs text-muted-foreground"}>
              {detalle}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
