import { z } from "zod"

import { FASES } from "./constantes"

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá la fecha.")
const hora = z.string().regex(/^\d{2}:\d{2}$/, "Ingresá la hora.")

export const esquemaTorneo = z
  .object({
    nombre: z.string().trim().min(1, "Ingresá el nombre.").max(120),
    fecha_inicio: fecha,
    hora_inicio: hora,
    fecha_fin: fecha,
    hora_fin: hora,
    precio: z
      .number({ error: "Ingresá el precio (0 si no se cobra)." })
      .min(0, "El precio no puede ser negativo.")
      .max(100_000_000, "El precio es demasiado alto."),
    notas: z.string().trim().max(2000),
  })
  .refine((d) => `${d.fecha_fin}T${d.hora_fin}` >= `${d.fecha_inicio}T${d.hora_inicio}`, {
    message: "El fin tiene que ser después del inicio.",
    path: ["fecha_fin"],
  })

export type DatosTorneo = z.infer<typeof esquemaTorneo>

const puntos = z.number().int().min(0).max(20)

export const esquemaCategoria = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre de la categoría.").max(60),
  tope_handicap: z.number().int().min(-8).max(40).nullable(),
  formato: z.enum(["puntos", "eliminacion", "zonas_llave"]),
  puntos_victoria: puntos,
  puntos_empate: puntos,
  puntos_derrota: puntos,
})

export type DatosCategoria = z.infer<typeof esquemaCategoria>

// Cada lado de un partido: un equipo, el ganador/perdedor de otro partido, o un puesto de zona.
export const esquemaLado = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("equipo"), equipo_id: z.uuid().nullable() }),
  z.object({ tipo: z.enum(["ganador", "perdedor"]), partido_id: z.uuid({ error: "Elegí el partido de origen." }) }),
  z.object({
    tipo: z.literal("puesto"),
    zona_id: z.uuid({ error: "Elegí la zona." }),
    puesto: z.number().int().min(1).max(32),
  }),
])

export type LadoPartido = z.infer<typeof esquemaLado>

export const esquemaPartidoTorneo = z.object({
  categoria_id: z.uuid({ error: "Elegí la categoría." }),
  zona_id: z.uuid().nullable(),
  fase: z.enum(FASES),
  fecha: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  hora: z.string().regex(/^(\d{2}:\d{2})?$/),
  cancha: z.string().trim().max(60),
  chukkers: z.number().int().min(1).max(8),
  a: esquemaLado,
  b: esquemaLado,
})

export type DatosPartidoTorneo = z.infer<typeof esquemaPartidoTorneo>

const golesChukker = z.object({ a: z.number().int().min(0).max(99), b: z.number().int().min(0).max(99) })

export const esquemaResultado = z
  .object({
    goles_a: z.number().int().min(0).max(99),
    goles_b: z.number().int().min(0).max(99),
    goles_chukkers: z.array(golesChukker).max(8).nullable(),
    goleadores: z.array(z.object({ jugador_id: z.uuid(), cantidad: z.number().int().min(1).max(99) })).max(40),
  })
  .refine(
    (d) =>
      !d.goles_chukkers ||
      (d.goles_chukkers.reduce((t, c) => t + c.a, 0) === d.goles_a && d.goles_chukkers.reduce((t, c) => t + c.b, 0) === d.goles_b),
    { message: "La suma de los goles por chukker no coincide con el resultado." },
  )

export type DatosResultado = z.infer<typeof esquemaResultado>
