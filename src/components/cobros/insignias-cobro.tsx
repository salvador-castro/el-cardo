import { Badge } from "@/components/ui/badge"
import type { Enums } from "@/types/database"

export type EstadoCobro = Enums<"estado_cobro">
export type ConceptoCobro = Enums<"concepto_cobro">
export type MedioPago = Enums<"medio_pago">

export const ETIQUETA_ESTADO_COBRO: Record<EstadoCobro, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  vencido: "Vencido",
  anulado: "Anulado",
  bonificado: "Bonificado",
}

export const ETIQUETA_CONCEPTO: Record<ConceptoCobro, string> = {
  cuota_social: "Cuota social",
  practica: "Práctica",
  clase: "Clase",
  torneo: "Torneo",
  otro: "Otro",
}

export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  mercadopago: "Mercado Pago",
  efectivo: "Efectivo",
  transferencia: "Transferencia",
}

const ESTILO_ESTADO: Record<EstadoCobro, string> = {
  pendiente: "bg-alerta-suave text-alerta",
  pagado: "bg-exito-suave text-exito",
  vencido: "bg-peligro-suave text-destructive",
  anulado: "bg-muted text-muted-foreground line-through",
  bonificado: "bg-[#e8e1f0] text-[#5c3f73]",
}

export function InsigniaEstadoCobro({ estado }: { estado: EstadoCobro }) {
  return <Badge className={ESTILO_ESTADO[estado]}>{ETIQUETA_ESTADO_COBRO[estado]}</Badge>
}
