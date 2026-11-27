import { CalendarDaysIcon, ChevronLeftIcon, ClockIcon, GraduationCapIcon, StickyNoteIcon, TagIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"

import { AccionesActividad } from "@/components/actividades/detalle/acciones-actividad"
import { PestanasActividad } from "@/components/actividades/detalle/pestanas-actividad"
import { TabAsistencia } from "@/components/actividades/detalle/tab-asistencia"
import { TabCobros, type CobroActividad } from "@/components/actividades/detalle/tab-cobros"
import { TabParticipantes } from "@/components/actividades/detalle/tab-participantes"
import { TabPartidos } from "@/components/actividades/detalle/tab-partidos"
import { IconoTipoActividad, InsigniaEstadoActividad, InsigniaTipoActividad, ProgresoCobro } from "@/components/actividades/insignias"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import { colorPorNombre, esColorCamiseta } from "@/lib/actividades/colores"
import type { ActividadDetalle, ParticipanteDetalle, PartidoDetalle } from "@/lib/actividades/detalle"
import { requerirUsuario } from "@/lib/auth"
import { formatearFechaLarga, formatearHora, formatearMonto } from "@/lib/formato"
import type { EstadoApto } from "@/lib/jugadores/constantes"
import { createClient } from "@/lib/supabase/server"

const UUID = /^[0-9a-f-]{36}$/i

export async function generateMetadata({ params }: PageProps<"/actividades/[id]">): Promise<Metadata> {
  const { id } = await params
  if (!UUID.test(id)) return { title: "Actividad" }
  const supabase = await createClient()
  const { data } = await supabase.from("actividades").select("nombre").eq("id", id).maybeSingle()
  return { title: data?.nombre ?? "Actividad" }
}

export default async function DetalleActividadPage({ params, searchParams }: PageProps<"/actividades/[id]">) {
  await requerirUsuario()
  const { id } = await params
  const { tab } = await searchParams
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const [actividadRes, equiposRes, participacionesRes, cobrosRes, jugadoresRes, partidosRes] = await Promise.all([
    supabase
      .from("actividades")
      .select("id, tipo, nombre, inicio, estado, precio, notas, profesor:jugadores!actividades_profesor_id_fkey(id, nombre, apellido, handicap)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("equipos").select("id, nombre, color").eq("actividad_id", id).order("created_at"),
    supabase.from("participaciones").select("id, jugador_id, equipo_id, asistencia, bonificado, precio").eq("actividad_id", id),
    supabase
      .from("cobros")
      .select("id, participacion_id, monto, vencimiento, estado, medio_pago, pagado_at, nota, created_at, jugador:jugadores(id, nombre, apellido)")
      .eq("actividad_id", id)
      .order("created_at"),
    // Todos los jugadores (los inactivos se muestran si ya estaban anotados, pero no se pueden elegir).
    supabase.from("jugadores_resumen").select("id, nombre, apellido, handicap, tipo, club_origen, apto_estado, activo"),
    supabase
      .from("partidos")
      .select("id, equipo_a_id, equipo_b_id, color_a, color_b, inicio, cancha, goles_a, goles_b, estado")
      .eq("actividad_id", id)
      .order("inicio", { ascending: true, nullsFirst: false })
      .order("orden")
      .order("created_at"),
  ])

  const error =
    actividadRes.error ?? equiposRes.error ?? participacionesRes.error ?? cobrosRes.error ?? jugadoresRes.error ?? partidosRes.error
  if (error) throw new Error(error.message)
  const a = actividadRes.data
  if (!a || a.tipo === "torneo") notFound()
  const equipos = (equiposRes.data ?? []).map((e) => ({
    ...e,
    color: esColorCamiseta(e.color) ? e.color : colorPorNombre(e.nombre),
  }))
  const filasCobros = cobrosRes.data ?? []
  const partidos: PartidoDetalle[] = (partidosRes.data ?? []).map((p) => ({
    ...p,
    color_a: esColorCamiseta(p.color_a) ? p.color_a : null,
    color_b: esColorCamiseta(p.color_b) ? p.color_b : null,
  }))

  const actividad: ActividadDetalle = {
    id: a.id,
    tipo: a.tipo,
    nombre: a.nombre,
    inicio: a.inicio,
    estado: a.estado,
    precio: Number(a.precio),
    notas: a.notas,
    profesor: a.profesor,
  }

  const jugadores: JugadorOpcion[] = (jugadoresRes.data ?? []).map((j) => ({
    id: j.id!,
    nombre: j.nombre ?? "",
    apellido: j.apellido ?? "",
    handicap: j.handicap ?? 0,
    tipo: j.tipo!,
    club_origen: j.club_origen,
    apto_estado: (j.apto_estado ?? "sin_apto") as EstadoApto,
    activo: j.activo ?? true,
  }))
  const porId = new Map(jugadores.map((j) => [j.id, j]))

  // Cobro vigente de cada participación (el último que no esté anulado).
  const cobroPorParticipacion = new Map<string, NonNullable<ParticipanteDetalle["cobro"]>>()
  for (const c of filasCobros) {
    if (c.participacion_id && c.estado !== "anulado") {
      cobroPorParticipacion.set(c.participacion_id, { estado: c.estado, monto: Number(c.monto) })
    }
  }

  const participantes: ParticipanteDetalle[] = (participacionesRes.data ?? [])
    .filter((p) => porId.has(p.jugador_id))
    .map((p) => ({
      id: p.id,
      jugador: porId.get(p.jugador_id)!,
      equipo_id: p.equipo_id,
      asistencia: p.asistencia,
      bonificado: p.bonificado,
      precio: p.precio === null ? null : Number(p.precio),
      cobro: cobroPorParticipacion.get(p.id) ?? null,
    }))

  const cobros: CobroActividad[] = filasCobros.map((c) => ({
    id: c.id,
    jugador: c.jugador,
    monto: Number(c.monto),
    vencimiento: c.vencimiento,
    estado: c.estado,
    medio_pago: c.medio_pago,
    pagado_at: c.pagado_at,
    nota: c.nota,
  }))
  const esperado = cobros.filter((c) => ["pendiente", "vencido", "pagado"].includes(c.estado)).reduce((t, c) => t + c.monto, 0)
  const cobrado = cobros.filter((c) => c.estado === "pagado").reduce((t, c) => t + c.monto, 0)
  const impagos = cobros.filter((c) => c.estado === "pendiente" || c.estado === "vencido")
  const presentes = participantes.filter((p) => p.asistencia === "presente").length
  const sinMarcar = participantes.filter((p) => !p.asistencia).length
  const esClase = actividad.tipo === "clase"
  const especiales = participantes.flatMap((p) => (p.precio === null ? [] : [p.precio]))

  return (
    <>
      <Link href="/actividades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Actividades
      </Link>

      <div className="mb-6 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <IconoTipoActividad tipo={actividad.tipo} className="size-12 rounded-xl [&_svg]:size-6" />
          <div className="min-w-0 flex-1 basis-60">
            <h1 className="font-heading text-2xl leading-tight font-semibold sm:text-4xl">{actividad.nombre}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <InsigniaTipoActividad tipo={actividad.tipo} />
              <InsigniaEstadoActividad estado={actividad.estado} />
            </div>
          </div>
          <AccionesActividad
            id={actividad.id}
            nombre={actividad.nombre}
            estado={actividad.estado}
            impagos={{ cantidad: impagos.length, monto: impagos.reduce((t, c) => t + c.monto, 0) }}
          />
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato icono={CalendarDaysIcon} etiqueta="Fecha">
            {formatearFechaLarga(actividad.inicio)}
          </Dato>
          <Dato icono={ClockIcon} etiqueta="Hora">
            {formatearHora(actividad.inicio)} h
          </Dato>
          <Dato icono={TagIcon} etiqueta={especiales.length ? "Precio base" : "Precio por jugador"}>
            {actividad.precio > 0 ? formatearMonto(actividad.precio) : "Sin cargo"}
            {especiales.length > 0 && (
              <span className="block text-xs font-normal text-muted-foreground">
                {especiales.length === 1 ? "1 paga" : `${especiales.length} pagan`} otro precio (
                {[...new Set(especiales)]
                  .sort((x, y) => x - y)
                  .map((v) => (v === 0 ? "sin cargo" : formatearMonto(v)))
                  .join(", ")}
                )
              </span>
            )}
          </Dato>
          {esClase ? (
            <Dato icono={GraduationCapIcon} etiqueta="Profesor">
              {actividad.profesor ? `${actividad.profesor.nombre} ${actividad.profesor.apellido}` : "—"}
            </Dato>
          ) : (
            <div>
              <dt className="text-xs text-muted-foreground">Cobrado</dt>
              <dd className="mt-0.5">
                <ProgresoCobro cobrado={cobrado} esperado={esperado} />
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <b className="text-foreground tabular-nums">{participantes.length}</b> {esClase ? "alumnos" : "anotados"}
          </span>
          {presentes > 0 && (
            <span>
              <b className="text-foreground tabular-nums">{presentes}</b> presentes
            </span>
          )}
          {esClase && esperado > 0 && (
            <span>
              Cobrado <b className="text-foreground tabular-nums">{formatearMonto(cobrado)}</b> de {formatearMonto(esperado)}
            </span>
          )}
        </div>

        {actividad.notas && (
          <p className="mt-4 flex gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">
            <StickyNoteIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {actividad.notas}
          </p>
        )}
      </div>

      <PestanasActividad
        inicial={typeof tab === "string" ? tab : undefined}
        tituloParticipantes={esClase ? "Alumnos" : "Equipos"}
        contadores={{
          participantes: participantes.length,
          partidos: partidos.length,
          sinMarcar: actividad.estado === "cancelada" ? 0 : sinMarcar,
          vencidos: cobros.filter((c) => c.estado === "vencido").length,
        }}
        participantes={
          <TabParticipantes actividad={actividad} equipos={equipos} participantes={participantes} jugadores={jugadores} />
        }
        partidos={
          esClase ? undefined : (
            <TabPartidos actividad={actividad} equipos={equipos} participantes={participantes} partidos={partidos} />
          )
        }
        asistencia={<TabAsistencia actividad={actividad} equipos={equipos} participantes={participantes} />}
        cobros={<TabCobros cobros={cobros} precio={actividad.precio} />}
      />
    </>
  )
}

function Dato({
  icono: Icono,
  etiqueta,
  children,
}: {
  icono: typeof CalendarDaysIcon
  etiqueta: string
  children: ReactNode
}) {
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
