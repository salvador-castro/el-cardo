import type { EstadoCobro } from "@/components/cobros/insignias-cobro"
import type { ColorCamiseta } from "./colores"
import type { Asistencia, EstadoActividad, JugadorOpcion, TipoActividad } from "./constantes"

export type ActividadDetalle = {
  id: string
  tipo: TipoActividad
  nombre: string
  inicio: string
  estado: EstadoActividad
  precio: number
  notas: string | null
  profesor: { id: string; nombre: string; apellido: string; handicap: number } | null
}

export type EquipoDetalle = {
  id: string
  nombre: string
  color: ColorCamiseta | null
  // Solo torneos.
  categoria_id: string | null
  zona_id: string | null
}

export type FormatoCategoria = "puntos" | "eliminacion" | "zonas_llave"

// Categoría de un torneo, con sus zonas.
export type CategoriaDetalle = {
  id: string
  nombre: string
  tope_handicap: number | null
  orden: number
  formato: FormatoCategoria
  puntos_victoria: number
  puntos_empate: number
  puntos_derrota: number
  zonas: { id: string; nombre: string; orden: number }[]
}

export type ParticipanteDetalle = {
  id: string // participación
  jugador: JugadorOpcion
  equipo_id: string | null
  asistencia: Asistencia | null
  bonificado: boolean
  // Precio especial del jugador (null = el de la actividad).
  precio: number | null
  // Cobro vigente (no anulado) de la participación.
  cobro: { estado: EstadoCobro; monto: number } | null
}

export type PartidoDetalle = {
  id: string
  equipo_a_id: string | null
  equipo_b_id: string | null
  color_a: ColorCamiseta | null
  color_b: ColorCamiseta | null
  inicio: string | null
  cancha: string | null
  goles_a: number | null
  goles_b: number | null
  estado: "programado" | "jugado" | "suspendido"
  chukkers: number
}

export const ordenarPorApellido = <T extends { jugador: { apellido: string; nombre: string } }>(lista: T[]) =>
  [...lista].sort(
    (a, b) =>
      a.jugador.apellido.localeCompare(b.jugador.apellido, "es") || a.jugador.nombre.localeCompare(b.jugador.nombre, "es"),
  )

export const sumaHandicap = (jugadores: { handicap: number }[]) => jugadores.reduce((t, j) => t + j.handicap, 0)

export const aptoConAviso = (j: { apto_estado: string }) => j.apto_estado === "vencido" || j.apto_estado === "sin_apto"
