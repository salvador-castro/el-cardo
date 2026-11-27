import type { Enums } from "@/types/database"
import type { EstadoApto, TipoJugador } from "@/lib/jugadores/constantes"

export type TipoActividad = Enums<"tipo_actividad">
export type EstadoActividad = Enums<"estado_actividad">
export type Asistencia = Enums<"asistencia">

// En la etapa 3 se gestionan prácticas y clases; los torneos tienen su propio módulo.
export const TIPOS_ACTIVIDAD_GESTION = ["practica", "clase"] as const
export type TipoActividadGestion = (typeof TIPOS_ACTIVIDAD_GESTION)[number]

export const ESTADOS_ACTIVIDAD = ["programada", "finalizada", "cancelada"] as const satisfies readonly EstadoActividad[]

export const ETIQUETA_TIPO_ACTIVIDAD: Record<TipoActividad, string> = {
  practica: "Práctica",
  clase: "Clase",
  torneo: "Torneo",
}

export const ETIQUETA_ESTADO_ACTIVIDAD: Record<EstadoActividad, string> = {
  programada: "Programada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
}

// Jugador tal como se lo muestra al anotarlo en una actividad.
export type JugadorOpcion = {
  id: string
  nombre: string
  apellido: string
  handicap: number
  tipo: TipoJugador
  club_origen: string | null
  apto_estado: EstadoApto
  activo: boolean
}
