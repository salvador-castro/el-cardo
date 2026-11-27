"use server"

import { revalidatePath } from "next/cache"

import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type Canal = "whatsapp" | "email"

const ETIQUETA_CANAL: Record<Canal, string> = { whatsapp: "WhatsApp", email: "email" }

// Deja constancia en el historial de cada cobro de que se le mandó un recordatorio o link.
export async function registrarEnvio(
  cobroIds: string[],
  canal: Canal,
  que: "recordatorio" | "link",
): Promise<{ ok: boolean }> {
  const usuario = await requerirUsuario()
  if (!cobroIds.length) return { ok: true }

  const supabase = await createClient()
  const detalle = `${que === "link" ? "Link de pago" : "Recordatorio"} por ${ETIQUETA_CANAL[canal]}`
  const { data: cobros } = await supabase.from("cobros").select("id, jugador_id").in("id", cobroIds)
  if (!cobros?.length) return { ok: false }

  const { error } = await supabase.from("cobro_eventos").insert(
    cobros.map((c) => ({ cobro_id: c.id, tipo: "enviado" as const, detalle, usuario_id: usuario.id })),
  )
  if (error) return { ok: false }

  revalidatePath(`/jugadores/${cobros[0].jugador_id}`)
  return { ok: true }
}
