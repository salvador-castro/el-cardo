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

// `linkPago`: URL pública /pagar/[token] con el botón de Mercado Pago.
// Desde la etapa 5 el recordatorio genera el link de los cobros y lo incluye siempre.
export function mensajeRecordatorio(nombre: string, cobros: CobroParaMensaje[], linkPago?: string) {
  const hoy = hoyISO()
  const total = cobros.reduce((t, c) => t + Number(c.monto), 0)
  const lineas = cobros.map((c) => {
    const venc = c.vencimiento < hoy ? `venció el ${formatearFecha(c.vencimiento)}` : `vence el ${formatearFecha(c.vencimiento)}`
    return `• ${c.descripcion}: ${formatearMonto(c.monto)} (${venc})`
  })

  const comoPagar = linkPago
    ? [`Podés pagarlo con Mercado Pago (tarjeta, débito o dinero en cuenta) desde este link:`, linkPago]
    : ["Podés pagarlo con Mercado Pago: respondé este mensaje y te enviamos el link."]

  return [
    `Hola ${nombre}! Te escribimos de ${CLUB}.`,
    "",
    cobros.length === 1 ? "Te recordamos que tenés pendiente:" : "Te recordamos que tenés pendientes:",
    ...lineas,
    "",
    `Total: ${formatearMonto(total)}`,
    "",
    ...comoPagar,
    "",
    "Si ya lo pagaste, desestimá este mensaje. ¡Gracias!",
  ].join("\n")
}

export function mensajeLinkPago(nombre: string, concepto: string, monto: number, linkPago: string) {
  return [
    `Hola ${nombre}! Te escribimos de ${CLUB}.`,
    "",
    `Te enviamos el link para pagar ${concepto} por ${formatearMonto(monto)} con Mercado Pago:`,
    linkPago,
    "",
    "¡Gracias!",
  ].join("\n")
}

export function asuntoRecordatorio() {
  return `${CLUB} — Recordatorio de pago`
}

export function enlaceMail(email: string, asunto: string, cuerpo: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}
