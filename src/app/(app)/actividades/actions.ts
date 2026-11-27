"use server"

import { revalidatePath } from "next/cache"

import { requerirUsuario } from "@/lib/auth"
import { esColorCamiseta, type ColorCamiseta } from "@/lib/actividades/colores"
import type { Asistencia, EstadoActividad } from "@/lib/actividades/constantes"
import { aInicioISO, esquemaActividad, esquemaPartido, fechaHoraAR, type DatosActividad, type DatosPartido } from "@/lib/actividades/esquema"
import { createClient } from "@/lib/supabase/server"
import type { Resultado } from "../jugadores/actions"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const sonIds = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.every((i) => typeof i === "string" && UUID.test(i))

function mensajeError(error: { code?: string; message: string }): string {
  // Mensajes de los triggers y funciones (raise exception): ya están en español.
  if (error.code === "P0001") return error.message
  if (error.code === "23505" && error.message.includes("equipos_actividad_id_nombre")) {
    return "Ya hay un equipo con ese nombre en esta actividad."
  }
  if (error.code === "23505" && error.message.includes("participaciones")) return "El jugador ya está anotado."
  if (error.code === "23514" && error.message.includes("partidos_jugado_con_resultado")) {
    return "El equipo tiene partidos con resultado cargado. Borrá esos partidos primero."
  }
  if (error.code === "42501") return "No tenés permisos para hacer esto."
  return "No se pudo guardar. Probá de nuevo."
}

// Lo que cambia en una actividad impacta en su detalle, el listado, el inicio y las fichas/deudas.
function revalidar(actividadId?: string) {
  revalidatePath("/actividades")
  if (actividadId) revalidatePath(`/actividades/${actividadId}`)
  revalidatePath("/")
  revalidatePath("/jugadores")
  revalidatePath("/jugadores/[id]", "page")
  revalidatePath("/torneos")
  if (actividadId) revalidatePath(`/torneos/${actividadId}`)
}

function aFila(d: DatosActividad) {
  return {
    nombre: d.nombre,
    inicio: aInicioISO(d.fecha, d.hora),
    precio: d.precio,
    notas: d.notas === "" ? null : d.notas,
    profesor_id: d.tipo === "clase" && d.profesor_id ? d.profesor_id : null,
  }
}

// ---------------------------------------------------------------------------
// Actividad
// ---------------------------------------------------------------------------

export async function crearActividad(datos: DatosActividad): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  const parsed = esquemaActividad.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("actividades")
    .insert({ tipo: parsed.data.tipo, ...aFila(parsed.data) })
    .select("id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar()
  return { ok: true, datos: { id: data.id } }
}

export async function actualizarActividad(id: string, datos: DatosActividad): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  if (!UUID.test(id)) return { ok: false, error: "Actividad inválida." }
  const parsed = esquemaActividad.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  // El tipo no se cambia (lo impide la base): solo se actualizan los demás datos.
  const { error } = await supabase.from("actividades").update(aFila(parsed.data)).eq("id", id)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(id)
  return { ok: true, datos: { id } }
}

export async function cambiarEstadoActividad(id: string, estado: EstadoActividad): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(id) || !["programada", "finalizada", "cancelada"].includes(estado)) {
    return { ok: false, error: "Datos inválidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("actividades").update({ estado }).eq("id", id)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(id)
  return { ok: true, datos: undefined }
}

// ---------------------------------------------------------------------------
// Equipos
// ---------------------------------------------------------------------------

export async function guardarEquipo(
  actividadId: string,
  datos: {
    equipoId: string | null
    nombre: string
    jugadores: string[]
    color: ColorCamiseta | null
    // Torneos: categoría y zona del equipo.
    categoriaId?: string
    zonaId?: string | null
  },
): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : ""
  if (!UUID.test(actividadId) || (datos.equipoId && !UUID.test(datos.equipoId)) || !sonIds(datos.jugadores)) {
    return { ok: false, error: "Datos inválidos." }
  }
  if (!nombre) return { ok: false, error: "Ingresá el nombre del equipo." }
  if (datos.color !== null && !esColorCamiseta(datos.color)) return { ok: false, error: "Color de camiseta inválido." }
  if ((datos.categoriaId !== undefined && !UUID.test(datos.categoriaId)) || (datos.zonaId && !UUID.test(datos.zonaId))) {
    return { ok: false, error: "Categoría o zona inválida." }
  }
  if (nombre.length > 60) return { ok: false, error: "El nombre es demasiado largo." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("guardar_equipo", {
    p_actividad_id: actividadId,
    p_nombre: nombre,
    p_jugadores: datos.jugadores,
    ...(datos.equipoId ? { p_equipo_id: datos.equipoId } : {}),
  })
  if (error) return { ok: false, error: mensajeError(error) }

  const { error: errColor } = await supabase
    .from("equipos")
    .update({
      color: datos.color,
      ...(datos.categoriaId !== undefined && { categoria_id: datos.categoriaId, zona_id: datos.zonaId ?? null }),
    })
    .eq("id", data)
  if (errColor) {
    revalidar(actividadId)
    return { ok: false, error: `El equipo se guardó, pero no se pudo guardar la camiseta o la categoría. ${mensajeError(errColor)}` }
  }

  revalidar(actividadId)
  return { ok: true, datos: { id: data } }
}

// Se borra el equipo. Sus jugadores siguen anotados sin equipo, o se los quita de la actividad
// (sus cobros impagos se anulan; los pagos quedan registrados).
export async function eliminarEquipo(equipoId: string, quitarJugadores = false): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(equipoId)) return { ok: false, error: "Equipo inválido." }

  const supabase = await createClient()
  const { data: equipo, error: errEquipo } = await supabase
    .from("equipos")
    .select("actividad_id")
    .eq("id", equipoId)
    .single()
  if (errEquipo) return { ok: false, error: "El equipo no existe." }

  // Se controla antes de tocar nada: un equipo con partidos jugados no se puede borrar.
  const { count } = await supabase
    .from("partidos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "jugado")
    .or(`equipo_a_id.eq.${equipoId},equipo_b_id.eq.${equipoId}`)
  if (count) return { ok: false, error: "El equipo tiene partidos con resultado cargado. Borrá esos partidos primero." }

  if (quitarJugadores) {
    const { error } = await supabase.from("participaciones").delete().eq("equipo_id", equipoId)
    if (error) return { ok: false, error: mensajeError(error) }
  }

  const { error } = await supabase.from("equipos").delete().eq("id", equipoId)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(equipo.actividad_id)
  return { ok: true, datos: undefined }
}

// Quita a varios jugadores de una vez (p. ej. todos los anotados sin equipo).
export async function quitarParticipantes(actividadId: string, participaciones: string[]): Promise<Resultado<{ quitados: number }>> {
  await requerirUsuario()
  if (!UUID.test(actividadId) || !sonIds(participaciones)) return { ok: false, error: "Datos inválidos." }
  if (!participaciones.length) return { ok: true, datos: { quitados: 0 } }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("participaciones")
    .delete()
    .eq("actividad_id", actividadId)
    .in("id", participaciones)
    .select("id")
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(actividadId)
  return { ok: true, datos: { quitados: data.length } }
}

export type EquipoAnterior = {
  id: string
  nombre: string
  color: ColorCamiseta | null
  actividad: { id: string; nombre: string; inicio: string; tipo: string }
  jugadores: string[]
}

// Para "Duplicar equipo de una actividad anterior": los últimos equipos de otras actividades.
export async function equiposAnteriores(actividadId: string): Promise<Resultado<EquipoAnterior[]>> {
  await requerirUsuario()
  if (!UUID.test(actividadId)) return { ok: false, error: "Actividad inválida." }

  const supabase = await createClient()
  const { data: equipos, error } = await supabase
    .from("equipos")
    .select("id, nombre, color, created_at, actividad:actividades!inner(id, nombre, inicio, tipo, estado)")
    .neq("actividad_id", actividadId)
    .neq("actividad.estado", "cancelada")
    .order("created_at", { ascending: false })
    .limit(40)
  if (error) return { ok: false, error: "No se pudieron cargar los equipos." }
  if (!equipos.length) return { ok: true, datos: [] }

  const { data: miembros, error: errMiembros } = await supabase
    .from("participaciones")
    .select("equipo_id, jugador_id")
    .in(
      "equipo_id",
      equipos.map((e) => e.id),
    )
  if (errMiembros) return { ok: false, error: "No se pudieron cargar los equipos." }

  const porEquipo = new Map<string, string[]>()
  for (const m of miembros) {
    if (!m.equipo_id) continue
    porEquipo.set(m.equipo_id, [...(porEquipo.get(m.equipo_id) ?? []), m.jugador_id])
  }

  const datos = equipos
    .map((e) => ({
      id: e.id,
      nombre: e.nombre,
      color: esColorCamiseta(e.color) ? e.color : null,
      actividad: { id: e.actividad.id, nombre: e.actividad.nombre, inicio: e.actividad.inicio, tipo: e.actividad.tipo },
      jugadores: porEquipo.get(e.id) ?? [],
    }))
    .filter((e) => e.jugadores.length > 0)
    .sort((a, b) => b.actividad.inicio.localeCompare(a.actividad.inicio))

  return { ok: true, datos }
}

// ---------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------

export async function agregarParticipantes(
  actividadId: string,
  jugadores: string[],
  equipoId: string | null = null,
  // Precio especial para los jugadores que se agregan (null = el de la actividad).
  precio: number | null = null,
): Promise<Resultado<{ agregados: number }>> {
  await requerirUsuario()
  if (!UUID.test(actividadId) || !sonIds(jugadores) || (equipoId && !UUID.test(equipoId))) {
    return { ok: false, error: "Datos inválidos." }
  }
  if (precio !== null && (typeof precio !== "number" || !Number.isFinite(precio) || precio < 0 || precio > 100_000_000)) {
    return { ok: false, error: "Ingresá un precio válido." }
  }
  if (!jugadores.length) return { ok: false, error: "Elegí al menos un jugador." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("agregar_participantes", {
    p_actividad_id: actividadId,
    p_jugadores: jugadores,
    ...(equipoId ? { p_equipo_id: equipoId } : {}),
  })
  if (error) return { ok: false, error: mensajeError(error) }

  // Solo a los recién anotados (los que ya estaban conservan su precio).
  if (precio !== null) {
    const { error: errPrecio } = await supabase
      .from("participaciones")
      .update({ precio: Math.round(precio * 100) / 100 })
      .eq("actividad_id", actividadId)
      .in("jugador_id", jugadores)
      .is("precio", null)
    if (errPrecio) {
      revalidar(actividadId)
      return { ok: false, error: `Se anotaron, pero no se pudo poner el precio: ${mensajeError(errPrecio)}` }
    }
  }

  revalidar(actividadId)
  return { ok: true, datos: { agregados: data } }
}

// Quita al jugador de la actividad. Su cobro impago se anula (trigger); si ya pagó, el pago queda registrado.
export async function quitarParticipante(participacionId: string): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(participacionId)) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("participaciones")
    .delete()
    .eq("id", participacionId)
    .select("actividad_id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.actividad_id)
  return { ok: true, datos: undefined }
}

export async function moverParticipante(participacionId: string, equipoId: string | null): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(participacionId) || (equipoId && !UUID.test(equipoId))) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("participaciones")
    .update({ equipo_id: equipoId })
    .eq("id", participacionId)
    .select("actividad_id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.actividad_id)
  return { ok: true, datos: undefined }
}

export async function cambiarBonificado(participacionId: string, bonificado: boolean): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(participacionId)) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("participaciones")
    .update({ bonificado: Boolean(bonificado) })
    .eq("id", participacionId)
    .select("actividad_id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.actividad_id)
  return { ok: true, datos: undefined }
}

export async function marcarAsistencia(
  actividadId: string,
  participaciones: string[],
  asistencia: Asistencia | null,
): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(actividadId) || !sonIds(participaciones) || ![null, "presente", "ausente"].includes(asistencia)) {
    return { ok: false, error: "Datos inválidos." }
  }
  if (!participaciones.length) return { ok: true, datos: undefined }

  const supabase = await createClient()
  const { error } = await supabase
    .from("participaciones")
    .update({ asistencia })
    .eq("actividad_id", actividadId)
    .in("id", participaciones)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(actividadId)
  return { ok: true, datos: undefined }
}

// ---------------------------------------------------------------------------
// "Agregar varios": candidatos para cada nombre pegado (búsqueda aproximada con pg_trgm)
// ---------------------------------------------------------------------------

export type Coincidencia = {
  indice: number
  texto: string
  candidatos: { id: string; nombre: string; apellido: string; handicap: number; club_origen: string | null; similitud: number }[]
}

export async function buscarCoincidencias(textos: string[]): Promise<Resultado<Coincidencia[]>> {
  await requerirUsuario()
  if (!Array.isArray(textos) || !textos.every((t) => typeof t === "string")) return { ok: false, error: "Datos inválidos." }
  const limpios = textos.map((t) => t.trim().slice(0, 80)).slice(0, 60)
  if (!limpios.length) return { ok: true, datos: [] }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("buscar_jugadores_lista", { p_textos: limpios, p_por_texto: 3 })
  if (error) return { ok: false, error: "No se pudo buscar. Probá de nuevo." }

  const resultado: Coincidencia[] = limpios.map((texto, i) => ({ indice: i + 1, texto, candidatos: [] }))
  for (const fila of data) {
    resultado[fila.indice - 1]?.candidatos.push({
      id: fila.id,
      nombre: fila.nombre,
      apellido: fila.apellido,
      handicap: fila.handicap,
      club_origen: fila.club_origen,
      similitud: fila.similitud,
    })
  }
  return { ok: true, datos: resultado }
}

// ---------------------------------------------------------------------------
// Precio especial por jugador
// ---------------------------------------------------------------------------

// null = vuelve al precio de la actividad. Su cobro impago se ajusta solo (trigger).
export async function cambiarPrecioParticipante(participacionId: string, precio: number | null): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(participacionId)) return { ok: false, error: "Datos inválidos." }
  if (precio !== null && (typeof precio !== "number" || !Number.isFinite(precio) || precio < 0 || precio > 100_000_000)) {
    return { ok: false, error: "Ingresá un precio válido." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("participaciones")
    .update({ precio: precio === null ? null : Math.round(precio * 100) / 100 })
    .eq("id", participacionId)
    .select("actividad_id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.actividad_id)
  return { ok: true, datos: undefined }
}

// ---------------------------------------------------------------------------
// Partidos de práctica (cruce, camisetas y resultado)
// ---------------------------------------------------------------------------

export async function guardarPartido(
  actividadId: string,
  partidoId: string | null,
  datos: DatosPartido,
): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(actividadId) || (partidoId && !UUID.test(partidoId))) return { ok: false, error: "Datos inválidos." }
  const parsed = esquemaPartido.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const d = parsed.data

  const supabase = await createClient()
  const { data: act, error: errAct } = await supabase.from("actividades").select("inicio").eq("id", actividadId).single()
  if (errAct) return { ok: false, error: "La actividad no existe." }

  const jugado = d.goles_a !== null && d.goles_b !== null
  const fila = {
    equipo_a_id: d.equipo_a_id,
    equipo_b_id: d.equipo_b_id,
    color_a: d.color_a,
    color_b: d.color_b,
    inicio: d.hora ? aInicioISO(fechaHoraAR(act.inicio).fecha, d.hora) : null,
    cancha: d.cancha === "" ? null : d.cancha,
    chukkers: d.chukkers,
    goles_a: jugado ? d.goles_a : null,
    goles_b: jugado ? d.goles_b : null,
    estado: jugado ? ("jugado" as const) : ("programado" as const),
  }

  const { error } = partidoId
    ? await supabase.from("partidos").update(fila).eq("id", partidoId).eq("actividad_id", actividadId)
    : await supabase.from("partidos").insert({ ...fila, actividad_id: actividadId, fase: "otro" })
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(actividadId)
  return { ok: true, datos: undefined }
}

export async function eliminarPartido(partidoId: string): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(partidoId)) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase.from("partidos").delete().eq("id", partidoId).select("actividad_id").single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.actividad_id)
  return { ok: true, datos: undefined }
}

// Rotación "a la americana": reemplaza quién descansa en cada chukker.
export async function guardarDescansos(
  partidoId: string,
  descansos: { jugador_id: string; chukker: number }[],
): Promise<Resultado> {
  await requerirUsuario()
  if (
    !UUID.test(partidoId) ||
    !Array.isArray(descansos) ||
    descansos.length > 80 ||
    !descansos.every((d) => UUID.test(d.jugador_id) && Number.isInteger(d.chukker) && d.chukker >= 1 && d.chukker <= 8)
  ) {
    return { ok: false, error: "Datos inválidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("guardar_descansos", { p_partido_id: partidoId, p_descansos: descansos })
  if (error) return { ok: false, error: mensajeError(error) }

  const { data } = await supabase.from("partidos").select("actividad_id").eq("id", partidoId).single()
  revalidar(data?.actividad_id)
  return { ok: true, datos: undefined }
}
