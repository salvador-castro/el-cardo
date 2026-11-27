import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

// Genera URLs firmadas (1 h) para archivos de buckets privados. Devuelve path → url.
export async function urlsFirmadas(
  supabase: SupabaseClient<Database>,
  bucket: "fotos" | "documentos" | "comprobantes",
  paths: (string | null | undefined)[],
  segundos = 3600,
): Promise<Record<string, string>> {
  const unicos = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (!unicos.length) return {}

  const { data } = await supabase.storage.from(bucket).createSignedUrls(unicos, segundos)
  const mapa: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl
  }
  return mapa
}
