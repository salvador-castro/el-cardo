import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { envPublico } from "@/lib/env"
import type { Database } from "@/types/database"

// Cliente para Server Components, Server Actions y Route Handlers.
// Usa la sesión del usuario (RLS aplica). Crear uno nuevo por request.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(envPublico.supabaseUrl, envPublico.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: no se pueden escribir cookies.
          // El proxy se encarga de refrescar la sesión.
        }
      },
    },
  })
}
