import { CalendarDaysIcon, ChevronLeftIcon, StickyNoteIcon, TagIcon, TrophyIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { AccionesActividad } from "@/components/actividades/detalle/acciones-actividad"
import { TabCobros } from "@/components/actividades/detalle/tab-cobros"
import { TabParticipantes } from "@/components/actividades/detalle/tab-participantes"
import { InsigniaEstadoActividad, ProgresoCobro } from "@/components/actividades/insignias"
import { Pestanas } from "@/components/app/pestanas"
import { TabCategorias } from "@/components/torneos/detalle/tab-categorias"
import { TabFixture } from "@/components/torneos/detalle/tab-fixture"
import { TabGeneral } from "@/components/torneos/detalle/tab-general"
import { TabPosiciones } from "@/components/torneos/detalle/tab-posiciones"
import { requerirUsuario } from "@/lib/auth"
import { formatearFechaLarga, formatearHora, formatearMonto } from "@/lib/formato"
import { createClient } from "@/lib/supabase/server"
import { cargarTorneo } from "@/lib/torneos/cargar"

const UUID = /^[0-9a-f-]{36}$/i

export async function generateMetadata({ params }: PageProps<"/torneos/[id]">): Promise<Metadata> {
  const { id } = await params
  if (!UUID.test(id)) return { title: "Torneo" }
  const supabase = await createClient()
  const { data } = await supabase.from("actividades").select("nombre").eq("id", id).maybeSingle()
  return { title: data?.nombre ?? "Torneo" }
}

export default async function DetalleTorneoPage({ params, searchParams }: PageProps<"/torneos/[id]">) {
  await requerirUsuario()
  const { id } = await params
  const { tab } = await searchParams
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const datos = await cargarTorneo(supabase, id)
  if (!datos) notFound()
  const { torneo, categorias, equipos, participantes, jugadores, partidos, posiciones, goleadores, golesPorPartido, cobros } = datos

  const editable = torneo.estado !== "cancelada"
  const esperado = cobros.filter((c) => ["pendiente", "vencido", "pagado"].includes(c.estado)).reduce((t, c) => t + c.monto, 0)
  const cobrado = cobros
    .filter((c) => ["pendiente", "vencido", "pagado"].includes(c.estado))
    .reduce((t, c) => t + c.monto_pagado, 0)
  const impagos = cobros.filter((c) => c.estado === "pendiente" || c.estado === "vencido")
  const especiales = participantes.filter((p) => p.precio !== null).length

  return (
    <>
      <Link href="/torneos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Torneos
      </Link>

      <div className="mb-6 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marino text-dorado">
            <TrophyIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1 basis-60">
            <h1 className="font-heading text-2xl leading-tight font-semibold sm:text-4xl">{torneo.nombre}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <InsigniaEstadoActividad estado={torneo.estado} />
            </div>
          </div>
          <AccionesActividad
            id={torneo.id}
            nombre={torneo.nombre}
            estado={torneo.estado}
            rutaEditar={`/torneos/${torneo.id}/editar`}
            impagos={{ cantidad: impagos.length, monto: impagos.reduce((t, c) => t + c.monto, 0) }}
          />
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato icono={CalendarDaysIcon} etiqueta="Empieza">
            {formatearFechaLarga(torneo.inicio)} · {formatearHora(torneo.inicio)} h
          </Dato>
          <Dato icono={CalendarDaysIcon} etiqueta="Termina">
            {torneo.fin ? `${formatearFechaLarga(torneo.fin)} · ${formatearHora(torneo.fin)} h` : "—"}
          </Dato>
          <Dato icono={TagIcon} etiqueta={especiales ? "Precio base" : "Precio por jugador"}>
            {torneo.precio > 0 ? formatearMonto(torneo.precio) : "Sin cargo"}
            {especiales > 0 && (
              <span className="block text-xs font-normal text-muted-foreground">
                {especiales === 1 ? "1 paga" : `${especiales} pagan`} otro precio
              </span>
            )}
          </Dato>
          <div>
            <dt className="text-xs text-muted-foreground">Cobrado</dt>
            <dd className="mt-0.5">
              <ProgresoCobro cobrado={cobrado} esperado={esperado} />
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-muted-foreground">
          <b className="text-foreground tabular-nums">{categorias.length}</b> categorías ·{" "}
          <b className="text-foreground tabular-nums">{equipos.length}</b> equipos ·{" "}
          <b className="text-foreground tabular-nums">{participantes.length}</b> jugadores ·{" "}
          <b className="text-foreground tabular-nums">
            {partidos.filter((p) => p.estado === "jugado").length}/{partidos.length}
          </b>{" "}
          partidos jugados
        </p>

        {torneo.notas && (
          <p className="mt-4 flex gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">
            <StickyNoteIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {torneo.notas}
          </p>
        )}
      </div>

      <Pestanas
        inicial={typeof tab === "string" ? tab : undefined}
        pestanas={[
          {
            valor: "general",
            titulo: "General",
            contenido: <TabGeneral categorias={categorias} equipos={equipos} partidos={partidos} goleadores={goleadores} />,
          },
          {
            valor: "categorias",
            titulo: "Categorías",
            contador: categorias.length,
            contenido: (
              <TabCategorias
                torneoId={torneo.id}
                categorias={categorias}
                equipos={equipos}
                participantes={participantes}
                editable={editable}
              />
            ),
          },
          {
            valor: "equipos",
            titulo: "Equipos",
            contador: equipos.length,
            contenido: (
              <TabParticipantes
                actividad={torneo}
                equipos={equipos}
                participantes={participantes}
                jugadores={jugadores}
                categorias={categorias}
              />
            ),
          },
          {
            valor: "fixture",
            titulo: "Fixture",
            contador: partidos.filter((p) => p.estado !== "jugado").length,
            contenido: (
              <TabFixture
                torneoId={torneo.id}
                inicio={torneo.inicio}
                fin={torneo.fin}
                categorias={categorias}
                equipos={equipos}
                partidos={partidos}
                participantes={participantes}
                golesPorPartido={golesPorPartido}
                editable={editable}
              />
            ),
          },
          {
            valor: "posiciones",
            titulo: "Posiciones",
            contenido: (
              <TabPosiciones
                categorias={categorias}
                equipos={equipos}
                posiciones={posiciones}
                goleadores={goleadores}
                partidos={partidos}
              />
            ),
          },
          {
            valor: "cobros",
            titulo: "Cobros",
            contador: cobros.filter((c) => c.estado === "vencido").length,
            alerta: true,
            contenido: <TabCobros cobros={cobros} precio={torneo.precio} />,
          },
        ]}
      />
    </>
  )
}

function Dato({ icono: Icono, etiqueta, children }: { icono: typeof CalendarDaysIcon; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icono className="mt-0.5 size-4 shrink-0 text-dorado-oscuro" />
      <div>
        <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  )
}
