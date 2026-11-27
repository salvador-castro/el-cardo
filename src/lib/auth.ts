import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type Usuario = {
  id: string
  nombre: string
  email: string
}

// Usuario logueado con perfil (todos los perfiles son admin). Se resuelve una vez por request.
export const obtenerUsuario = cache(async (): Promise<Usuario | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const id = data?.claims?.sub
  if (!id) return null

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, email")
    .eq("id", id)
    .maybeSingle()

  return perfil
})

// Para páginas y acciones protegidas: sin sesión o sin perfil, vuelve al login.
export async function requerirUsuario(): Promise<Usuario> {
  const usuario = await obtenerUsuario()
  if (!usuario) redirect("/login?error=sin_acceso")
  return usuario
}
