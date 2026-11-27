import { createBrowserClient } from "@supabase/ssr"

import { envPublico } from "@/lib/env"
import type { Database } from "@/types/database"

// Cliente para Client Components. Usa la sesión del usuario (RLS aplica).
export function createClient() {
  return createBrowserClient<Database>(envPublico.supabaseUrl, envPublico.supabaseKey)
}
