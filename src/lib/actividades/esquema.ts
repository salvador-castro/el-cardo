import { z } from "zod"

import { ZONA_HORARIA } from "@/lib/formato"
import { COLORES_CAMISETA } from "./colores"
import { TIPOS_ACTIVIDAD_GESTION } from "./constantes"

export const esquemaActividad = z
  .object({
    tipo: z.enum(TIPOS_ACTIVIDAD_GESTION, { error: "Elegí el tipo de actividad." }),
    nombre: z.string().trim().min(1, "Ingresá el nombre.").max(120),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá la fecha."),
    hora: z.string().regex(/^\d{2}:\d{2}$/, "Ingresá la hora."),
    precio: z
      .number({ error: "Ingresá el precio (0 si no se cobra)." })
      .min(0, "El precio no puede ser negativo.")
      .max(100_000_000, "El precio es demasiado alto."),
    profesor_id: z.string(),
    notas: z.string().trim().max(2000),
  })
  .refine((d) => d.tipo !== "clase" || d.profesor_id !== "", {
    message: "Elegí el profesor de la clase.",
    path: ["profesor_id"],
  })

export type DatosActividad = z.infer<typeof esquemaActividad>

// Argentina no tiene horario de verano: la fecha y hora del formulario se guardan en UTC-3.
export function aInicioISO(fecha: string, hora: string) {
  return `${fecha}T${hora}:00-03:00`
}

const partes = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

// Fecha (YYYY-MM-DD) y hora (HH:MM) en Argentina de un timestamp.
export function fechaHoraAR(valor: string | Date) {
  const p = Object.fromEntries(partes.formatToParts(new Date(valor)).map((x) => [x.type, x.value]))
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` }
}

const diaSemana = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" })

// Nombre sugerido según el tipo y el día: "Práctica sábado", "Clase martes".
export function nombreSugerido(tipo: "practica" | "clase", fecha: string) {
  const base = tipo === "practica" ? "Práctica" : "Clase"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return base
  return `${base} ${diaSemana.format(new Date(`${fecha}T12:00:00Z`))}`
}

const goles = z.number().int("Los goles son un número entero.").min(0).max(99).nullable()

export const esquemaPartido = z
  .object({
    equipo_a_id: z.uuid("Elegí el primer equipo."),
    equipo_b_id: z.uuid("Elegí el segundo equipo."),
    // Se copian de la camiseta de cada equipo (pueden faltar).
    color_a: z.enum(COLORES_CAMISETA).nullable(),
    color_b: z.enum(COLORES_CAMISETA).nullable(),
    hora: z.string().regex(/^(\d{2}:\d{2})?$/, "Hora inválida."),
    cancha: z.string().trim().max(60),
    goles_a: goles,
    goles_b: goles,
    chukkers: z.number().int().min(1).max(8),
  })
  .refine((d) => d.equipo_a_id !== d.equipo_b_id, { message: "Elegí dos equipos distintos.", path: ["equipo_b_id"] })
  .refine((d) => (d.goles_a === null) === (d.goles_b === null), {
    message: "Cargá los goles de los dos equipos (o de ninguno).",
    path: ["goles_b"],
  })

export type DatosPartido = z.infer<typeof esquemaPartido>
