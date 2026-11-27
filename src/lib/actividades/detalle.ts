import type { EstadoCobro } from "@/components/cobros/insignias-cobro"
import type { ColorCamiseta } from "./colores"
import type { Asistencia, EstadoActividad, JugadorOpcion, TipoActividadGestion } from "./constantes"

export type ActividadDetalle = {
  id: string
  tipo: TipoActividadGestion
  nombre: string
  inicio: string
  estado: EstadoActividad
  precio: number
  notas: string | null
  profesor: { id: string; nombre: string; apellido: string; handicap: number } | null
}

export type EquipoDetalle = { id: string; nombre: string; color: ColorCamiseta | null }

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
}

export const ordenarPorApellido = <T extends { jugador: { apellido: string; nombre: string } }>(lista: T[]) =>
  [...lista].sort(
    (a, b) =>
      a.jugador.apellido.localeCompare(b.jugador.apellido, "es") || a.jugador.nombre.localeCompare(b.jugador.nombre, "es"),
  )

export const sumaHandicap = (jugadores: { handicap: number }[]) => jugadores.reduce((t, j) => t + j.handicap, 0)

export const aptoConAviso = (j: { apto_estado: string }) => j.apto_estado === "vencido" || j.apto_estado === "sin_apto"
