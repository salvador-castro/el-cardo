import type { EstadoActividad, TipoActividadGestion } from "./constantes"
import { fechaHoraAR } from "./esquema"

export type FilaActividad = {
  id: string
  tipo: TipoActividadGestion
  nombre: string
  inicio: string
  fecha: string // YYYY-MM-DD en Argentina
  estado: EstadoActividad
  precio: number
  profesor_nombre: string | null
  participantes: number
  presentes: number
  monto_esperado: number
  monto_cobrado: number
}

// Convierte una fila de la vista `actividades_resumen` al formato del listado y el calendario.
export function aFilaActividad(a: {
  id: string | null
  tipo: string | null
  nombre: string | null
  inicio: string | null
  estado: EstadoActividad | null
  precio: number | null
  profesor_nombre: string | null
  participantes: number | null
  presentes: number | null
  monto_esperado: number | null
  monto_cobrado: number | null
}): FilaActividad {
  return {
    id: a.id!,
    tipo: a.tipo as TipoActividadGestion,
    nombre: a.nombre ?? "",
    inicio: a.inicio!,
    fecha: fechaHoraAR(a.inicio!).fecha,
    estado: a.estado ?? "programada",
    precio: Number(a.precio ?? 0),
    profesor_nombre: a.profesor_nombre,
    participantes: a.participantes ?? 0,
    presentes: a.presentes ?? 0,
    monto_esperado: Number(a.monto_esperado ?? 0),
    monto_cobrado: Number(a.monto_cobrado ?? 0),
  }
}
