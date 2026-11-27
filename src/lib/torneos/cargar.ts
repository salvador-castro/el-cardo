import "server-only"

import type { CobroActividad } from "@/components/actividades/detalle/tab-cobros"
import { colorPorNombre, esColorCamiseta } from "@/lib/actividades/colores"
import type { JugadorOpcion } from "@/lib/actividades/constantes"
import type { ActividadDetalle, CategoriaDetalle, EquipoDetalle, ParticipanteDetalle } from "@/lib/actividades/detalle"
import type { EstadoApto } from "@/lib/jugadores/constantes"
import type { createClient } from "@/lib/supabase/server"
import type { FilaPosicion, Goleador, PartidoTorneo } from "./constantes"

type Cliente = Awaited<ReturnType<typeof createClient>>

export type TorneoCompleto = {
  torneo: ActividadDetalle & { fin: string | null }
  categorias: CategoriaDetalle[]
  equipos: EquipoDetalle[]
  participantes: ParticipanteDetalle[]
  jugadores: JugadorOpcion[]
  partidos: PartidoTorneo[]
  posiciones: FilaPosicion[]
  goleadores: Goleador[]
  // Goles de cada jugador en cada partido (para editar resultados).
  golesPorPartido: { partido_id: string; jugador_id: string; cantidad: number }[]
  cobros: CobroActividad[]
}

const lado = (v: string | null) => (v === "ganador" || v === "perdedor" ? v : null)

// Todo lo que necesita el detalle de un torneo. Devuelve null si no existe o no es un torneo.
export async function cargarTorneo(supabase: Cliente, id: string): Promise<TorneoCompleto | null> {
  const [act, cats, zonas, eqs, parts, cobs, jugs, ptds, pos, gols, golp] = await Promise.all([
    supabase.from("actividades").select("id, tipo, nombre, inicio, fin, estado, precio, notas").eq("id", id).maybeSingle(),
    supabase
      .from("torneo_categorias")
      .select("id, nombre, tope_handicap, orden, formato, puntos_victoria, puntos_empate, puntos_derrota")
      .eq("actividad_id", id)
      .order("orden"),
    supabase.from("torneo_zonas").select("id, nombre, orden, categoria_id, categoria:torneo_categorias!inner(actividad_id)").eq("categoria.actividad_id", id).order("orden"),
    supabase.from("equipos").select("id, nombre, color, categoria_id, zona_id").eq("actividad_id", id).order("nombre"),
    supabase.from("participaciones").select("id, jugador_id, equipo_id, asistencia, bonificado, precio").eq("actividad_id", id),
    supabase
      .from("cobros")
      .select("id, participacion_id, monto, vencimiento, estado, medio_pago, pagado_at, nota, jugador:jugadores(id, nombre, apellido)")
      .eq("actividad_id", id)
      .order("created_at"),
    supabase.from("jugadores_resumen").select("id, nombre, apellido, handicap, tipo, club_origen, apto_estado, activo"),
    supabase
      .from("partidos")
      .select(
        "id, categoria_id, zona_id, fase, inicio, cancha, chukkers, orden, equipo_a_id, equipo_b_id, placeholder_a, placeholder_b, goles_a, goles_b, goles_chukkers, estado, desde_a_partido, desde_a_resultado, desde_a_zona, desde_a_puesto, desde_b_partido, desde_b_resultado, desde_b_zona, desde_b_puesto",
      )
      .eq("actividad_id", id),
    supabase.from("posiciones").select("equipo_id, categoria_id, zona_id, posicion, pj, pg, pe, pp, gf, gc, dif, pts").eq("actividad_id", id),
    supabase.from("goleadores_torneo").select("categoria_id, jugador_id, jugador, goles").eq("actividad_id", id).order("goles", { ascending: false }),
    supabase
      .from("goleadores")
      .select("partido_id, jugador_id, cantidad, partido:partidos!inner(actividad_id)")
      .eq("partido.actividad_id", id),
  ])

  const error =
    act.error ??
    cats.error ??
    zonas.error ??
    eqs.error ??
    parts.error ??
    cobs.error ??
    jugs.error ??
    ptds.error ??
    pos.error ??
    gols.error ??
    golp.error
  if (error) throw new Error(error.message)
  const a = act.data
  if (!a || a.tipo !== "torneo") return null

  const categorias: CategoriaDetalle[] = (cats.data ?? []).map((c) => ({
    ...c,
    formato: (["puntos", "eliminacion", "zonas_llave"].includes(c.formato) ? c.formato : "puntos") as CategoriaDetalle["formato"],
    zonas: (zonas.data ?? []).filter((z) => z.categoria_id === c.id).map((z) => ({ id: z.id, nombre: z.nombre, orden: z.orden })),
  }))

  const jugadores: JugadorOpcion[] = (jugs.data ?? []).map((j) => ({
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

  const cobroPorParticipacion = new Map<string, NonNullable<ParticipanteDetalle["cobro"]>>()
  for (const c of cobs.data ?? []) {
    if (c.participacion_id && c.estado !== "anulado") {
      cobroPorParticipacion.set(c.participacion_id, { estado: c.estado, monto: Number(c.monto) })
    }
  }

  const participantes: ParticipanteDetalle[] = (parts.data ?? [])
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

  return {
    torneo: {
      id: a.id,
      tipo: a.tipo,
      nombre: a.nombre,
      inicio: a.inicio,
      fin: a.fin,
      estado: a.estado,
      precio: Number(a.precio),
      notas: a.notas,
      profesor: null,
    },
    categorias,
    equipos: (eqs.data ?? []).map((e) => ({
      ...e,
      color: esColorCamiseta(e.color) ? e.color : colorPorNombre(e.nombre),
    })),
    participantes,
    jugadores,
    partidos: (ptds.data ?? []).map((p) => ({
      ...p,
      goles_chukkers: Array.isArray(p.goles_chukkers) ? (p.goles_chukkers as { a: number; b: number }[]) : null,
      desde_a_resultado: lado(p.desde_a_resultado),
      desde_b_resultado: lado(p.desde_b_resultado),
    })),
    posiciones: (pos.data ?? [])
      .filter((p) => p.equipo_id && p.categoria_id)
      .map((p) => ({
        equipo_id: p.equipo_id!,
        categoria_id: p.categoria_id!,
        zona_id: p.zona_id,
        posicion: p.posicion ?? 0,
        pj: p.pj ?? 0,
        pg: p.pg ?? 0,
        pe: p.pe ?? 0,
        pp: p.pp ?? 0,
        gf: p.gf ?? 0,
        gc: p.gc ?? 0,
        dif: p.dif ?? 0,
        pts: p.pts ?? 0,
      })),
    goleadores: (gols.data ?? [])
      .filter((g) => g.jugador_id)
      .map((g) => ({ categoria_id: g.categoria_id, jugador_id: g.jugador_id!, jugador: g.jugador ?? "", goles: g.goles ?? 0 })),
    golesPorPartido: (golp.data ?? []).map((g) => ({ partido_id: g.partido_id, jugador_id: g.jugador_id, cantidad: g.cantidad })),
    cobros: (cobs.data ?? []).map((c) => ({
      id: c.id,
      jugador: c.jugador,
      monto: Number(c.monto),
      vencimiento: c.vencimiento,
      estado: c.estado,
      medio_pago: c.medio_pago,
      pagado_at: c.pagado_at,
      nota: c.nota,
    })),
  }
}
