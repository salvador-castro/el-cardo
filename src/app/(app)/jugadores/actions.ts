"use server"

import { revalidatePath } from "next/cache"

import { requerirUsuario } from "@/lib/auth"
import {
  esquemaAltaRapida,
  esquemaDocumento,
  esquemaJugador,
  type DatosAltaRapida,
  type DatosDocumento,
  type DatosJugador,
} from "@/lib/jugadores/esquema"
import { createClient } from "@/lib/supabase/server"
import type { TablesInsert } from "@/types/database"

export type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; error: string }

const nulo = (v: string) => (v.trim() === "" ? null : v.trim())

function mensajeError(error: { code?: string; message: string }): string {
  if (error.code === "23505" && error.message.includes("dni")) return "Ya existe un jugador con ese DNI."
  if (error.code === "42501") return "No tenés permisos para hacer esto."
  return "No se pudo guardar. Probá de nuevo."
}

function aFila(d: DatosJugador): TablesInsert<"jugadores"> {
  return {
    nombre: d.nombre.trim(),
    apellido: d.apellido.trim(),
    dni: nulo(d.dni.replace(/\D/g, "")),
    fecha_nacimiento: nulo(d.fecha_nacimiento),
    telefono: nulo(d.telefono),
    email: nulo(d.email.toLowerCase()),
    direccion: nulo(d.direccion),
    tipo: d.tipo,
    activo: d.activo,
    fecha_alta: d.fecha_alta,
    club_origen: nulo(d.club_origen),
    es_profesor: d.es_profesor,
    notas: nulo(d.notas),
    handicap: d.handicap,
    mano: d.mano === "" ? null : d.mano,
    emergencia_nombre: nulo(d.emergencia_nombre),
    emergencia_vinculo: nulo(d.emergencia_vinculo),
    emergencia_telefono: nulo(d.emergencia_telefono),
    grupo_sanguineo: d.grupo_sanguineo === "" ? null : d.grupo_sanguineo,
    obra_social: nulo(d.obra_social),
    numero_afiliado: nulo(d.numero_afiliado),
  }
}

export async function crearJugador(datos: DatosJugador): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  const parsed = esquemaJugador.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase.from("jugadores").insert(aFila(parsed.data)).select("id").single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidatePath("/jugadores")
  return { ok: true, datos: { id: data.id } }
}

export async function actualizarJugador(id: string, datos: DatosJugador): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  const parsed = esquemaJugador.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  const { error } = await supabase.from("jugadores").update(aFila(parsed.data)).eq("id", id)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidatePath("/jugadores")
  revalidatePath(`/jugadores/${id}`)
  return { ok: true, datos: { id } }
}

export type JugadorCreado = {
  id: string
  nombre: string
  apellido: string
  handicap: number
  club_origen: string | null
}

// Alta rápida (modal reutilizable): se crea como externo.
export async function altaRapidaJugador(datos: DatosAltaRapida): Promise<Resultado<JugadorCreado>> {
  await requerirUsuario()
  const parsed = esquemaAltaRapida.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jugadores")
    .insert({
      nombre: parsed.data.nombre,
      apellido: parsed.data.apellido,
      handicap: parsed.data.handicap,
      club_origen: nulo(parsed.data.club_origen),
      tipo: "externo",
    })
    .select("id, nombre, apellido, handicap, club_origen")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidatePath("/jugadores")
  return { ok: true, datos: data }
}

// Los jugadores no se borran: se marcan inactivos.
export async function cambiarEstadoJugador(id: string, activo: boolean): Promise<Resultado> {
  await requerirUsuario()
  const supabase = await createClient()
  const { error } = await supabase.from("jugadores").update({ activo }).eq("id", id)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidatePath("/jugadores")
  revalidatePath(`/jugadores/${id}`)
  return { ok: true, datos: undefined }
}

// La foto se sube desde el navegador a Storage; acá se registra y se borra la anterior.
export async function actualizarFoto(id: string, path: string | null): Promise<Resultado> {
  await requerirUsuario()
  if (path && !path.startsWith(`${id}/`)) return { ok: false, error: "Ruta de archivo inválida." }

  const supabase = await createClient()
  const { data: actual } = await supabase.from("jugadores").select("foto_path").eq("id", id).single()

  const { error } = await supabase.from("jugadores").update({ foto_path: path }).eq("id", id)
  if (error) return { ok: false, error: mensajeError(error) }

  if (actual?.foto_path && actual.foto_path !== path) {
    await supabase.storage.from("fotos").remove([actual.foto_path])
  }

  revalidatePath("/jugadores")
  revalidatePath(`/jugadores/${id}`)
  return { ok: true, datos: undefined }
}

export async function agregarDocumento(jugadorId: string, datos: DatosDocumento): Promise<Resultado> {
  await requerirUsuario()
  const parsed = esquemaDocumento.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const d = parsed.data
  if (d.archivo_path && !d.archivo_path.startsWith(`${jugadorId}/`)) {
    return { ok: false, error: "Ruta de archivo inválida." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("jugador_documentos").insert({
    jugador_id: jugadorId,
    tipo: d.tipo,
    descripcion: nulo(d.descripcion),
    vencimiento: nulo(d.vencimiento),
    archivo_path: nulo(d.archivo_path),
    archivo_nombre: nulo(d.archivo_nombre),
  })
  if (error) return { ok: false, error: mensajeError(error) }

  revalidatePath("/jugadores")
  revalidatePath(`/jugadores/${jugadorId}`)
  return { ok: true, datos: undefined }
}

export async function eliminarDocumento(id: string): Promise<Resultado> {
  await requerirUsuario()
  const supabase = await createClient()
  const { data: doc, error: errLectura } = await supabase
    .from("jugador_documentos")
    .select("jugador_id, archivo_path")
    .eq("id", id)
    .single()
  if (errLectura) return { ok: false, error: "El documento no existe." }

  const { error } = await supabase.from("jugador_documentos").delete().eq("id", id)
  if (error) return { ok: false, error: mensajeError(error) }

  if (doc.archivo_path) await supabase.storage.from("documentos").remove([doc.archivo_path])

  revalidatePath("/jugadores")
  revalidatePath(`/jugadores/${doc.jugador_id}`)
  return { ok: true, datos: undefined }
}
