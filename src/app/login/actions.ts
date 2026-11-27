"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { esquemaLogin, type DatosLogin } from "./esquema"

export type ResultadoLogin = { error: string } | undefined

// Evita redirecciones abiertas: solo rutas internas.
function destinoSeguro(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  return next
}

export async function iniciarSesion(datos: DatosLogin, next?: string): Promise<ResultadoLogin> {
  const parsed = esquemaLogin.safeParse(datos)
  if (!parsed.success) {
    return { error: "Revisá el email y la contraseña." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return { error: "El email todavía no fue confirmado." }
    }
    if (error?.status === 429) {
      return { error: "Demasiados intentos. Esperá un momento y volvé a probar." }
    }
    return { error: "Email o contraseña incorrectos." }
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle()

  if (!perfil) {
    await supabase.auth.signOut()
    return { error: "Tu usuario no tiene acceso al sistema. Pedile a un administrador que te habilite." }
  }

  redirect(destinoSeguro(next))
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
