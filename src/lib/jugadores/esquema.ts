import { z } from "zod"

import { GRUPOS_SANGUINEOS, HANDICAP_MAX, HANDICAP_MIN, MANOS, TIPOS_DOCUMENTO, TIPOS_JUGADOR } from "./constantes"

// Los formularios trabajan con strings: "" significa "sin dato" y se guarda como null.
const texto = z.string().trim()
const fecha = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida.")

const handicap = z
  .number({ error: "Elegí un hándicap." })
  .int()
  .min(HANDICAP_MIN, `El hándicap va de ${HANDICAP_MIN} a ${HANDICAP_MAX}.`)
  .max(HANDICAP_MAX, `El hándicap va de ${HANDICAP_MIN} a ${HANDICAP_MAX}.`)

export const esquemaJugador = z.object({
  // Personales
  nombre: texto.min(1, "Ingresá el nombre.").max(80),
  apellido: texto.min(1, "Ingresá el apellido.").max(80),
  dni: texto.refine((v) => v === "" || /^\d{6,9}$/.test(v.replace(/\D/g, "")), "El DNI tiene que tener entre 6 y 9 números."),
  fecha_nacimiento: fecha.refine((v) => v === "" || v <= new Date().toISOString().slice(0, 10), "La fecha no puede ser futura."),
  telefono: texto.max(30),
  email: texto.refine((v) => v === "" || z.email().safeParse(v).success, "Email inválido."),
  direccion: texto.max(200),
  // Club
  tipo: z.enum(TIPOS_JUGADOR, { error: "Elegí el tipo de jugador." }),
  activo: z.boolean(),
  fecha_alta: fecha.refine((v) => v !== "", "Ingresá la fecha de alta."),
  club_origen: texto.max(80),
  es_profesor: z.boolean(),
  notas: texto.max(2000),
  // Polo
  handicap,
  mano: z.union([z.enum(MANOS), z.literal("")]),
  // Emergencia
  emergencia_nombre: texto.max(120),
  emergencia_vinculo: texto.max(60),
  emergencia_telefono: texto.max(30),
  grupo_sanguineo: z.union([z.enum(GRUPOS_SANGUINEOS), z.literal("")]),
  obra_social: texto.max(80),
  numero_afiliado: texto.max(40),
})

export type DatosJugador = z.infer<typeof esquemaJugador>

export const esquemaAltaRapida = z.object({
  nombre: texto.min(1, "Ingresá el nombre.").max(80),
  apellido: texto.min(1, "Ingresá el apellido.").max(80),
  handicap,
  club_origen: texto.max(80),
})

export type DatosAltaRapida = z.infer<typeof esquemaAltaRapida>

export const esquemaDocumento = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO, { error: "Elegí el tipo de documento." }),
  descripcion: texto.max(200),
  vencimiento: fecha,
  archivo_path: texto.max(500),
  archivo_nombre: texto.max(200),
})

export type DatosDocumento = z.infer<typeof esquemaDocumento>

export function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())
}

export const valoresIniciales = (): DatosJugador => ({
  nombre: "",
  apellido: "",
  dni: "",
  fecha_nacimiento: "",
  telefono: "",
  email: "",
  direccion: "",
  tipo: "socio",
  activo: true,
  fecha_alta: hoyISO(),
  club_origen: "",
  es_profesor: false,
  notas: "",
  handicap: 0,
  mano: "",
  emergencia_nombre: "",
  emergencia_vinculo: "",
  emergencia_telefono: "",
  grupo_sanguineo: "",
  obra_social: "",
  numero_afiliado: "",
})
