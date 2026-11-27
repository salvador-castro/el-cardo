import "server-only"

import { createClient } from "@supabase/supabase-js"

import { envPublico } from "@/lib/env"
import { envServidor } from "@/lib/env.server"
import type { Database } from "@/types/database"

// Cliente con service role: SALTEA RLS. Usar solo en el servidor para
// la página pública de pago, el webhook de Mercado Pago y los crons.
export function createAdminClient() {
  return createClient<Database>(envPublico.supabaseUrl, envServidor.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
