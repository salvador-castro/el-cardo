"use server"

import { revalidatePath } from "next/cache"

import { aInicioISO } from "@/lib/actividades/esquema"
import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  esquemaCategoria,
  esquemaPartidoTorneo,
  esquemaResultado,
  esquemaTorneo,
  type DatosCategoria,
  type DatosPartidoTorneo,
  type DatosResultado,
  type DatosTorneo,
  type LadoPartido,
} from "@/lib/torneos/esquema"
import type { TablesUpdate } from "@/types/database"
import type { Resultado } from "../jugadores/actions"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mensajeError(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message
  if (error.code === "23505" && error.message.includes("torneo_categorias")) return "Ya hay una categoría con ese nombre."
  if (error.code === "23505" && error.message.includes("torneo_zonas")) return "Ya hay una zona con ese nombre en la categoría."
  if (error.code === "23505" && error.message.includes("goleadores")) return "Un goleador está repetido."
  if (error.code === "23514" && error.message.includes("partidos_jugado_con_resultado")) {
    return "El partido necesita los dos equipos para cargar el resultado."
  }
  if (error.code === "23514" && error.message.includes("partidos_equipos_distintos")) return "Elegí dos equipos distintos."
  if (error.code === "42501") return "No tenés permisos para hacer esto."
  return "No se pudo guardar. Probá de nuevo."
}

function revalidar(torneoId?: string) {
  revalidatePath("/torneos")
  if (torneoId) revalidatePath(`/torneos/${torneoId}`)
  revalidatePath("/")
  revalidatePath("/jugadores")
  revalidatePath("/jugadores/[id]", "page")
}

// ---------------------------------------------------------------------------
// Torneo
// ---------------------------------------------------------------------------

function aFilaTorneo(d: DatosTorneo) {
  return {
    nombre: d.nombre,
    inicio: aInicioISO(d.fecha_inicio, d.hora_inicio),
    fin: aInicioISO(d.fecha_fin, d.hora_fin),
    precio: d.precio,
    notas: d.notas === "" ? null : d.notas,
  }
}

export async function crearTorneo(datos: DatosTorneo): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  const parsed = esquemaTorneo.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("actividades")
    .insert({ tipo: "torneo", ...aFilaTorneo(parsed.data) })
    .select("id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar()
  return { ok: true, datos: { id: data.id } }
}

export async function actualizarTorneo(id: string, datos: DatosTorneo): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  if (!UUID.test(id)) return { ok: false, error: "Torneo inválido." }
  const parsed = esquemaTorneo.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  const { error } = await supabase.from("actividades").update(aFilaTorneo(parsed.data)).eq("id", id).eq("tipo", "torneo")
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(id)
  return { ok: true, datos: { id } }
}

// ---------------------------------------------------------------------------
// Categorías y zonas
// ---------------------------------------------------------------------------

export async function guardarCategoria(
  torneoId: string,
  categoriaId: string | null,
  datos: DatosCategoria,
): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  if (!UUID.test(torneoId) || (categoriaId && !UUID.test(categoriaId))) return { ok: false, error: "Datos inválidos." }
  const parsed = esquemaCategoria.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  if (categoriaId) {
    const { error } = await supabase
      .from("torneo_categorias")
      .update(parsed.data)
      .eq("id", categoriaId)
      .eq("actividad_id", torneoId)
    if (error) return { ok: false, error: mensajeError(error) }
    revalidar(torneoId)
    return { ok: true, datos: { id: categoriaId } }
  }

  const { count } = await supabase
    .from("torneo_categorias")
    .select("id", { count: "exact", head: true })
    .eq("actividad_id", torneoId)
  const { data, error } = await supabase
    .from("torneo_categorias")
    .insert({ ...parsed.data, actividad_id: torneoId, orden: (count ?? 0) + 1 })
    .select("id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(torneoId)
  return { ok: true, datos: { id: data.id } }
}

export async function eliminarCategoria(categoriaId: string): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(categoriaId)) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const [equipos, partidos, categoria] = await Promise.all([
    supabase.from("equipos").select("id", { count: "exact", head: true }).eq("categoria_id", categoriaId),
    supabase.from("partidos").select("id", { count: "exact", head: true }).eq("categoria_id", categoriaId),
    supabase.from("torneo_categorias").select("actividad_id").eq("id", categoriaId).single(),
  ])
  if (categoria.error) return { ok: false, error: "La categoría no existe." }
  if (equipos.count) return { ok: false, error: "La categoría tiene equipos: pasalos a otra categoría o eliminalos primero." }
  if (partidos.count) return { ok: false, error: "La categoría tiene partidos: eliminalos primero." }

  const { error } = await supabase.from("torneo_categorias").delete().eq("id", categoriaId)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(categoria.data.actividad_id)
  return { ok: true, datos: undefined }
}

export async function guardarZona(categoriaId: string, zonaId: string | null, nombre: string): Promise<Resultado> {
  await requerirUsuario()
  const limpio = typeof nombre === "string" ? nombre.trim() : ""
  if (!UUID.test(categoriaId) || (zonaId && !UUID.test(zonaId))) return { ok: false, error: "Datos inválidos." }
  if (!limpio || limpio.length > 40) return { ok: false, error: "Ingresá el nombre de la zona." }

  const supabase = await createClient()
  const { data: categoria, error: errCat } = await supabase
    .from("torneo_categorias")
    .select("actividad_id")
    .eq("id", categoriaId)
    .single()
  if (errCat) return { ok: false, error: "La categoría no existe." }

  if (zonaId) {
    const { error } = await supabase.from("torneo_zonas").update({ nombre: limpio }).eq("id", zonaId).eq("categoria_id", categoriaId)
    if (error) return { ok: false, error: mensajeError(error) }
  } else {
    const { count } = await supabase
      .from("torneo_zonas")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", categoriaId)
    const { error } = await supabase.from("torneo_zonas").insert({ categoria_id: categoriaId, nombre: limpio, orden: (count ?? 0) + 1 })
    if (error) return { ok: false, error: mensajeError(error) }
  }

  revalidar(categoria.actividad_id)
  return { ok: true, datos: undefined }
}

export async function eliminarZona(zonaId: string): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(zonaId)) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const [zona, equipos, partidos] = await Promise.all([
    supabase.from("torneo_zonas").select("categoria:torneo_categorias(actividad_id)").eq("id", zonaId).single(),
    supabase.from("equipos").select("id", { count: "exact", head: true }).eq("zona_id", zonaId),
    supabase.from("partidos").select("id", { count: "exact", head: true }).eq("zona_id", zonaId),
  ])
  if (zona.error) return { ok: false, error: "La zona no existe." }
  if (equipos.count) return { ok: false, error: "La zona tiene equipos: sacalos de la zona primero." }
  if (partidos.count) return { ok: false, error: "La zona tiene partidos: eliminalos primero." }

  const { error } = await supabase.from("torneo_zonas").delete().eq("id", zonaId)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(zona.data.categoria?.actividad_id)
  return { ok: true, datos: undefined }
}

export async function asignarZona(equipoId: string, zonaId: string | null): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(equipoId) || (zonaId && !UUID.test(zonaId))) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase.from("equipos").update({ zona_id: zonaId }).eq("id", equipoId).select("actividad_id").single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.actividad_id)
  return { ok: true, datos: undefined }
}

export async function generarTodosContraTodos(categoriaId: string, zonaId: string | null): Promise<Resultado<{ creados: number }>> {
  await requerirUsuario()
  if (!UUID.test(categoriaId) || (zonaId && !UUID.test(zonaId))) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("generar_todos_contra_todos", {
    p_categoria_id: categoriaId,
    ...(zonaId ? { p_zona_id: zonaId } : {}),
  })
  if (error) return { ok: false, error: mensajeError(error) }

  const { data: categoria } = await supabase.from("torneo_categorias").select("actividad_id").eq("id", categoriaId).single()
  revalidar(categoria?.actividad_id)
  return { ok: true, datos: { creados: data } }
}

// ---------------------------------------------------------------------------
// Partidos
// ---------------------------------------------------------------------------

function columnasLado(lado: LadoPartido, sufijo: "a" | "b"): TablesUpdate<"partidos"> {
  const base = {
    [`desde_${sufijo}_partido`]: null,
    [`desde_${sufijo}_resultado`]: null,
    [`desde_${sufijo}_zona`]: null,
    [`desde_${sufijo}_puesto`]: null,
    [`placeholder_${sufijo}`]: null,
  }
  if (lado.tipo === "equipo") return { ...base, [`equipo_${sufijo}_id`]: lado.equipo_id }
  if (lado.tipo === "puesto") {
    return { ...base, [`desde_${sufijo}_zona`]: lado.zona_id, [`desde_${sufijo}_puesto`]: lado.puesto }
  }
  return { ...base, [`desde_${sufijo}_partido`]: lado.partido_id, [`desde_${sufijo}_resultado`]: lado.tipo }
}

export async function guardarPartidoTorneo(
  torneoId: string,
  partidoId: string | null,
  datos: DatosPartidoTorneo,
): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(torneoId) || (partidoId && !UUID.test(partidoId))) return { ok: false, error: "Datos inválidos." }
  const parsed = esquemaPartidoTorneo.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const d = parsed.data
  if (d.fase === "grupos" && (d.a.tipo !== "equipo" || d.b.tipo !== "equipo")) {
    return { ok: false, error: "En la fase de grupos los dos lados son equipos." }
  }
  if (d.hora && !d.fecha) return { ok: false, error: "Elegí el día del partido." }

  const fila: TablesUpdate<"partidos"> = {
    categoria_id: d.categoria_id,
    zona_id: d.fase === "grupos" ? d.zona_id : null,
    fase: d.fase,
    inicio: d.fecha ? aInicioISO(d.fecha, d.hora || "00:00") : null,
    cancha: d.cancha === "" ? null : d.cancha,
    chukkers: d.chukkers,
    ...columnasLado(d.a, "a"),
    ...columnasLado(d.b, "b"),
  }

  const supabase = await createClient()
  if (partidoId) {
    const { error } = await supabase.from("partidos").update(fila).eq("id", partidoId).eq("actividad_id", torneoId)
    if (error) return { ok: false, error: mensajeError(error) }
  } else {
    const { count } = await supabase
      .from("partidos")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", d.categoria_id)
    const { error } = await supabase
      .from("partidos")
      .insert({ ...fila, actividad_id: torneoId, categoria_id: d.categoria_id, orden: (count ?? 0) + 1 })
    if (error) return { ok: false, error: mensajeError(error) }
  }

  revalidar(torneoId)
  return { ok: true, datos: undefined }
}

// Resultado con goles por chukker y goleadores (opcionales), en una transacción.
export async function guardarResultado(partidoId: string, datos: DatosResultado): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(partidoId)) return { ok: false, error: "Datos inválidos." }
  const parsed = esquemaResultado.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.rpc("guardar_resultado", {
    p_partido_id: partidoId,
    p_goles_a: d.goles_a,
    p_goles_b: d.goles_b,
    p_goles_chukkers: d.goles_chukkers,
    p_goleadores: d.goleadores,
  })
  if (error) return { ok: false, error: mensajeError(error) }

  const { data } = await supabase.from("partidos").select("actividad_id").eq("id", partidoId).single()
  revalidar(data?.actividad_id)
  return { ok: true, datos: undefined }
}

export async function borrarResultado(partidoId: string): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(partidoId)) return { ok: false, error: "Datos inválidos." }

  const supabase = await createClient()
  const { error: errGol } = await supabase.from("goleadores").delete().eq("partido_id", partidoId)
  if (errGol) return { ok: false, error: mensajeError(errGol) }
  const { data, error } = await supabase
    .from("partidos")
    .update({ goles_a: null, goles_b: null, goles_chukkers: null, estado: "programado" })
    .eq("id", partidoId)
    .select("actividad_id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.actividad_id)
  return { ok: true, datos: undefined }
}
