import { formatearFecha, formatearMonto } from "@/lib/formato"
import { hoyISO } from "@/lib/jugadores/esquema"

// Textos que se mandan a los jugadores por WhatsApp o mail. Todo en un solo lugar para ajustarlos fácil.

export type CobroParaMensaje = {
  descripcion: string
  monto: number
  vencimiento: string
}

const CLUB = process.env.NEXT_PUBLIC_CLUB_NOMBRE ?? "El Cardo Polo Club"

export function mensajeSaludo(nombre: string) {
  return `Hola ${nombre}! Te escribimos de ${CLUB}.`
}

export function mensajeRecordatorio(nombre: string, cobros: CobroParaMensaje[]) {
  const hoy = hoyISO()
  const total = cobros.reduce((t, c) => t + Number(c.monto), 0)
  const lineas = cobros.map((c) => {
    const venc = c.vencimiento < hoy ? `venció el ${formatearFecha(c.vencimiento)}` : `vence el ${formatearFecha(c.vencimiento)}`
    return `• ${c.descripcion}: ${formatearMonto(c.monto)} (${venc})`
  })

  return [
    `Hola ${nombre}! Te escribimos de ${CLUB}.`,
    "",
    cobros.length === 1 ? "Te recordamos que tenés pendiente:" : "Te recordamos que tenés pendientes:",
    ...lineas,
    "",
    `Total: ${formatearMonto(total)}`,
    "",
    "Podés abonarlo en el club o por transferencia. Si ya lo pagaste, desestimá este mensaje. ¡Gracias!",
  ].join("\n")
}

export function asuntoRecordatorio() {
  return `${CLUB} — Recordatorio de pago`
}

export function enlaceMail(email: string, asunto: string, cuerpo: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}
