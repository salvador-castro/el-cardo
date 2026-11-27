import { Constants, type Enums } from "@/types/database"

export type TipoJugador = Enums<"tipo_jugador">
export type TipoDocumento = Enums<"tipo_documento">
export type Mano = Enums<"mano">
export type EstadoApto = "vigente" | "por_vencer" | "vencido" | "sin_apto"

export const TIPOS_JUGADOR = Constants.public.Enums.tipo_jugador
export const TIPOS_DOCUMENTO = Constants.public.Enums.tipo_documento
export const MANOS = Constants.public.Enums.mano

export const ETIQUETA_TIPO_JUGADOR: Record<TipoJugador, string> = {
  socio: "Socio",
  no_socio: "No socio",
  alumno: "Alumno",
  externo: "Externo",
}

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  apto_medico: "Apto médico",
  seguro: "Seguro",
  deslinde: "Deslinde",
  otro: "Otro",
}

export const ETIQUETA_MANO: Record<Mano, string> = {
  diestro: "Diestro",
  zurdo: "Zurdo",
}

export const ETIQUETA_APTO: Record<EstadoApto, string> = {
  vigente: "Apto vigente",
  por_vencer: "Apto por vencer",
  vencido: "Apto vencido",
  sin_apto: "Sin apto",
}

export const GRUPOS_SANGUINEOS = ["0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const

export const HANDICAP_MIN = -2
export const HANDICAP_MAX = 10
export const HANDICAPS = Array.from({ length: HANDICAP_MAX - HANDICAP_MIN + 1 }, (_, i) => HANDICAP_MIN + i)

// Documentos que vencen dentro de esta cantidad de días se marcan como "por vencer".
export const DIAS_AVISO_VENCIMIENTO = 30
