import type { ColorCamiseta } from "@/lib/actividades/colores"
import type { FormatoCategoria } from "@/lib/actividades/detalle"
import type { Enums } from "@/types/database"

export type Fase = Enums<"fase_partido">

export const FASES: Fase[] = ["grupos", "cuartos", "semi", "final", "otro"]

export const ETIQUETA_FASE: Record<Fase, string> = {
  grupos: "Fase de grupos",
  cuartos: "Cuartos de final",
  semi: "Semifinal",
  final: "Final",
  otro: "Otro (3.º puesto, repechaje…)",
}

// Nombre corto para numerar partidos: "Cuartos 1", "Semi 2", "Final".
export const CORTO_FASE: Record<Fase, string> = {
  grupos: "Partido",
  cuartos: "Cuartos",
  semi: "Semi",
  final: "Final",
  otro: "Partido",
}

export const FORMATOS: FormatoCategoria[] = ["puntos", "zonas_llave", "eliminacion"]

export const ETIQUETA_FORMATO: Record<FormatoCategoria, string> = {
  puntos: "Por puntos (todos contra todos)",
  zonas_llave: "Zonas y después llave",
  eliminacion: "Eliminación directa (llave)",
}

export const DESCRIPCION_FORMATO: Record<FormatoCategoria, string> = {
  puntos: "Todos contra todos, en una zona o en varias. Gana el que más puntos suma.",
  zonas_llave: "Primero zonas por puntos; los mejores de cada zona pasan a una llave.",
  eliminacion: "Cruces directos: el que gana avanza al próximo partido de la llave.",
}

export type EstadoPartido = Enums<"estado_partido">

// Partido de torneo tal como lo usan el fixture, las posiciones y la llave.
export type PartidoTorneo = {
  id: string
  categoria_id: string | null
  zona_id: string | null
  fase: Fase
  inicio: string | null
  cancha: string | null
  chukkers: number
  orden: number
  equipo_a_id: string | null
  equipo_b_id: string | null
  placeholder_a: string | null
  placeholder_b: string | null
  goles_a: number | null
  goles_b: number | null
  goles_chukkers: { a: number; b: number }[] | null
  estado: EstadoPartido
  desde_a_partido: string | null
  desde_a_resultado: "ganador" | "perdedor" | null
  desde_a_zona: string | null
  desde_a_puesto: number | null
  desde_b_partido: string | null
  desde_b_resultado: "ganador" | "perdedor" | null
  desde_b_zona: string | null
  desde_b_puesto: number | null
}

export type EquipoTorneo = {
  id: string
  nombre: string
  color: ColorCamiseta | null
  categoria_id: string | null
  zona_id: string | null
}

export type FilaPosicion = {
  equipo_id: string
  categoria_id: string
  zona_id: string | null
  posicion: number
  pj: number
  pg: number
  pe: number
  pp: number
  gf: number
  gc: number
  dif: number
  pts: number
}

export type Goleador = { categoria_id: string | null; jugador_id: string; jugador: string; goles: number }
