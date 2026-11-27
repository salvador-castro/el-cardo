"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Resultado } from "../jugadores/actions"

export type Canal = "whatsapp" | "email"

const ETIQUETA_CANAL: Record<Canal, string> = { whatsapp: "WhatsApp", email: "email" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const sonIds = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.every((i) => typeof i === "string" && UUID.test(i))
const montoValido = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 100_000_000

function mensajeError(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message
  if (error.code === "23505" && error.message.includes("cobros_cuota_unica")) return "Ese jugador ya tiene la cuota de ese mes."
  if (error.code === "42501") return "No tenés permisos para hacer esto."
  return "No se pudo guardar. Probá de nuevo."
}

// Los cobros afectan a la ficha del jugador, los listados, el inicio y las actividades.
function revalidar(jugadorId?: string) {
  revalidatePath("/cobros")
  revalidatePath("/cobros/[id]", "page")
  revalidatePath("/")
  revalidatePath("/jugadores")
  if (jugadorId) revalidatePath(`/jugadores/${jugadorId}`)
  revalidatePath("/actividades/[id]", "page")
  revalidatePath("/torneos/[id]", "page")
}

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

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

const esquemaPago = z.object({
  jugadorId: z.uuid(),
  cobroIds: z.array(z.uuid()).min(1, "Elegí al menos un cobro."),
  monto: z.number().positive("Ingresá el monto.").max(100_000_000),
  medio: z.enum(["efectivo", "transferencia"], { error: "Elegí cómo pagó." }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  nota: z.string().trim().max(500),
  comprobantePath: z.string().max(500).nullable(),
})

export type DatosPago = z.infer<typeof esquemaPago>

// Pago en efectivo o transferencia: se aplica a los cobros elegidos, del más viejo al más nuevo.
export async function registrarPago(datos: DatosPago): Promise<Resultado<{ id: string }>> {
  await requerirUsuario()
  const parsed = esquemaPago.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const d = parsed.data
  if (d.comprobantePath && !d.comprobantePath.startsWith(`${d.jugadorId}/`)) return { ok: false, error: "Comprobante inválido." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("registrar_pago", {
    p_jugador_id: d.jugadorId,
    p_monto: Math.round(d.monto * 100) / 100,
    p_medio: d.medio,
    p_cobro_ids: d.cobroIds,
    p_fecha: d.fecha,
    ...(d.nota ? { p_nota: d.nota } : {}),
    ...(d.comprobantePath ? { p_comprobante_path: d.comprobantePath } : {}),
  })
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(d.jugadorId)
  return { ok: true, datos: { id: data } }
}

export async function usarSaldoAFavor(
  jugadorId: string,
  cobroIds: string[],
  monto: number | null,
): Promise<Resultado<{ aplicado: number }>> {
  await requerirUsuario()
  if (!UUID.test(jugadorId) || !sonIds(cobroIds) || !cobroIds.length || (monto !== null && !montoValido(monto))) {
    return { ok: false, error: "Datos inválidos." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("usar_saldo_a_favor", {
    p_jugador_id: jugadorId,
    p_cobro_ids: cobroIds,
    ...(monto !== null ? { p_monto: monto } : {}),
  })
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(jugadorId)
  return { ok: true, datos: { aplicado: Number(data) } }
}

export async function anularPago(pagoId: string, motivo: string): Promise<Resultado> {
  await requerirUsuario()
  const limpio = typeof motivo === "string" ? motivo.trim().slice(0, 300) : ""
  if (!UUID.test(pagoId)) return { ok: false, error: "Datos inválidos." }
  if (!limpio) return { ok: false, error: "Contá por qué se anula el pago." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("pagos")
    .update({ anulado: true, anulado_motivo: limpio })
    .eq("id", pagoId)
    .select("jugador_id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.jugador_id)
  return { ok: true, datos: undefined }
}

export async function registrarDevolucion(
  jugadorId: string,
  monto: number,
  medio: "efectivo" | "transferencia",
  nota: string,
): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(jugadorId) || !montoValido(monto) || !["efectivo", "transferencia"].includes(medio)) {
    return { ok: false, error: "Datos inválidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("registrar_devolucion", {
    p_jugador_id: jugadorId,
    p_monto: monto,
    p_medio: medio,
    ...(nota.trim() ? { p_nota: nota.trim().slice(0, 300) } : {}),
  })
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(jugadorId)
  return { ok: true, datos: undefined }
}

// ---------------------------------------------------------------------------
// Cobros
// ---------------------------------------------------------------------------

const esquemaCobroManual = z.object({
  jugadores: z.array(z.uuid()).min(1, "Elegí al menos un jugador.").max(300),
  concepto: z.enum(["otro", "practica", "clase", "torneo"]),
  descripcion: z.string().trim().min(1, "Ingresá el concepto del cobro.").max(120),
  monto: z.number({ error: "Ingresá el monto." }).positive("El monto tiene que ser mayor a 0.").max(100_000_000),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá el vencimiento."),
})

export type DatosCobroManual = z.infer<typeof esquemaCobroManual>

export async function crearCobroManual(datos: DatosCobroManual): Promise<Resultado<{ creados: number }>> {
  await requerirUsuario()
  const parsed = esquemaCobroManual.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const d = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cobros")
    .insert(
      d.jugadores.map((jugador_id) => ({
        jugador_id,
        concepto: d.concepto,
        descripcion: d.descripcion,
        monto: d.monto,
        vencimiento: d.vencimiento,
      })),
    )
    .select("id")
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(d.jugadores.length === 1 ? d.jugadores[0] : undefined)
  return { ok: true, datos: { creados: data.length } }
}

export async function generarCuotas(periodo: string): Promise<Resultado<{ creadas: number }>> {
  await requerirUsuario()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return { ok: false, error: "Elegí el mes." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("generar_cuotas_sociales", { p_periodo: periodo })
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar()
  return { ok: true, datos: { creadas: data } }
}

// Para el diálogo de "Generar cuotas": monto vigente y cuántas faltan.
export async function previaCuotas(periodo: string): Promise<Resultado<{ monto: number | null; socios: number; yaGeneradas: number }>> {
  await requerirUsuario()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return { ok: false, error: "Mes inválido." }

  const supabase = await createClient()
  const [monto, socios, generadas] = await Promise.all([
    supabase.rpc("monto_cuota_social", { p_periodo: periodo }),
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("tipo", "socio").eq("activo", true),
    supabase.from("cobros").select("id", { count: "exact", head: true }).eq("concepto", "cuota_social").eq("periodo", periodo),
  ])
  return {
    ok: true,
    datos: { monto: monto.data === null ? null : Number(monto.data), socios: socios.count ?? 0, yaGeneradas: generadas.count ?? 0 },
  }
}

export async function cambiarMontoCobro(cobroId: string, monto: number): Promise<Resultado> {
  await requerirUsuario()
  if (!UUID.test(cobroId) || !montoValido(monto)) return { ok: false, error: "Ingresá un monto válido." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cobros")
    .update({ monto: Math.round(monto * 100) / 100 })
    .eq("id", cobroId)
    .select("jugador_id")
    .single()
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(data.jugador_id)
  return { ok: true, datos: undefined }
}

// Anular (no se cobra; si tenía pagos, quedan a favor) o bonificar (se perdona lo que falta).
export async function cerrarCobro(cobroId: string, estado: "anulado" | "bonificado", nota: string): Promise<Resultado> {
  await requerirUsuario()
  const limpio = typeof nota === "string" ? nota.trim().slice(0, 300) : ""
  if (!UUID.test(cobroId) || !["anulado", "bonificado"].includes(estado)) return { ok: false, error: "Datos inválidos." }
  if (!limpio) return { ok: false, error: "Contá el motivo." }

  const supabase = await createClient()
  const { data: actual, error: errLectura } = await supabase
    .from("cobros")
    .select("estado, nota, jugador_id")
    .eq("id", cobroId)
    .single()
  if (errLectura) return { ok: false, error: "El cobro no existe." }
  if (estado === "bonificado" && !["pendiente", "vencido"].includes(actual.estado)) {
    return { ok: false, error: "Solo se bonifica un cobro impago." }
  }
  if (actual.estado === "anulado") return { ok: false, error: "El cobro ya está anulado." }

  const { error } = await supabase
    .from("cobros")
    .update({ estado, nota: [actual.nota, limpio].filter(Boolean).join(" · ") })
    .eq("id", cobroId)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidar(actual.jugador_id)
  return { ok: true, datos: undefined }
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const esquemaConfiguracion = z.object({
  cuota_social_monto: z.number({ error: "Ingresá el monto." }).positive("El monto tiene que ser mayor a 0.").max(100_000_000),
  cuota_social_dia_vencimiento: z.number().int().min(1, "Entre 1 y 28.").max(28, "Entre 1 y 28."),
  precio_practica: z.number().min(0).max(100_000_000),
  precio_clase: z.number().min(0).max(100_000_000),
  precio_torneo: z.number().min(0).max(100_000_000),
  dias_vencimiento_actividad: z.number().int().min(0, "Entre 0 y 90.").max(90, "Entre 0 y 90."),
  dias_validez_link: z.number().int().min(1, "Entre 1 y 180.").max(180, "Entre 1 y 180."),
})

export type DatosConfiguracion = z.infer<typeof esquemaConfiguracion>

export async function guardarConfiguracion(datos: DatosConfiguracion): Promise<Resultado> {
  await requerirUsuario()
  const parsed = esquemaConfiguracion.safeParse(datos)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }

  const supabase = await createClient()
  const { error } = await supabase.from("configuracion").update(parsed.data).eq("id", true)
  if (error) return { ok: false, error: mensajeError(error) }

  revalidatePath("/configuracion")
  revalidatePath("/actividades/nueva")
  revalidatePath("/torneos/nuevo")
  return { ok: true, datos: undefined }
}
