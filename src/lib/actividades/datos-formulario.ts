import "server-only"

import type { TipoActividadGestion } from "./constantes"
import type { createClient } from "@/lib/supabase/server"

type Cliente = Awaited<ReturnType<typeof createClient>>

// Precios sugeridos y profesores activos para el formulario de actividad.
export async function datosFormularioActividad(supabase: Cliente) {
  const [configRes, profesoresRes] = await Promise.all([
    supabase.from("configuracion").select("precio_practica, precio_clase").maybeSingle(),
    supabase
      .from("jugadores")
      .select("id, nombre, apellido, handicap")
      .eq("es_profesor", true)
      .eq("activo", true)
      .order("apellido")
      .order("nombre"),
  ])
  if (configRes.error) throw new Error(configRes.error.message)
  if (profesoresRes.error) throw new Error(profesoresRes.error.message)

  const precios: Record<TipoActividadGestion, number> = {
    practica: Number(configRes.data?.precio_practica ?? 0),
    clase: Number(configRes.data?.precio_clase ?? 0),
  }
  return { precios, profesores: profesoresRes.data }
}
