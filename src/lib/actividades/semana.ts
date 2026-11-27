// Fechas "de calendario" (YYYY-MM-DD) en Argentina, para la vista semanal.
// Se opera en UTC sobre fechas puras para no depender de la zona del navegador.

import { fechaHoraAR } from "./esquema"

const DIA_MS = 86_400_000

export const esFechaISO = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

const aUTC = (fecha: string) => new Date(`${fecha}T00:00:00Z`)
const aISO = (d: Date) => d.toISOString().slice(0, 10)

export function hoyAR() {
  return fechaHoraAR(new Date()).fecha
}

export function sumarDias(fecha: string, dias: number) {
  return aISO(new Date(aUTC(fecha).getTime() + dias * DIA_MS))
}

// Lunes de la semana de esa fecha.
export function inicioDeSemana(fecha: string) {
  const dow = aUTC(fecha).getUTCDay() // 0 = domingo
  return sumarDias(fecha, dow === 0 ? -6 : 1 - dow)
}

export function diasDeSemana(lunes: string) {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

const fmtDia = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
const fmtDiaLargo = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
const fmtNumero = new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: "UTC" })
const fmtMes = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" })
const fmtMesAnio = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function etiquetaDia(fecha: string) {
  return {
    corto: capitalizar(fmtDia.format(aUTC(fecha)).replace(".", "")),
    numero: fmtNumero.format(aUTC(fecha)),
    largo: capitalizar(fmtDiaLargo.format(aUTC(fecha))),
  }
}

// "24 al 30 de noviembre de 2026" / "29 de diciembre al 4 de enero de 2027".
export function etiquetaSemana(lunes: string) {
  const domingo = sumarDias(lunes, 6)
  const [a, b] = [aUTC(lunes), aUTC(domingo)]
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${fmtNumero.format(a)} al ${fmtNumero.format(b)} de ${fmtMesAnio.format(b)}`
  }
  return `${fmtNumero.format(a)} de ${fmtMes.format(a)} al ${fmtNumero.format(b)} de ${fmtMesAnio.format(b)}`
}
