// Formatos para Argentina.

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires"

const moneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
})

export function formatearMonto(valor: number | string | null | undefined): string {
  return moneda.format(Number(valor ?? 0))
}

const fechaCorta = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: ZONA_HORARIA,
})

const fechaLarga = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: ZONA_HORARIA,
})

const hora = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ZONA_HORARIA,
})

// Las columnas `date` llegan como "YYYY-MM-DD": se interpretan como fecha local, sin corrimiento.
function aFecha(valor: string | Date): Date {
  if (valor instanceof Date) return valor
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T12:00:00-03:00`)
  return new Date(valor)
}

export function formatearFecha(valor: string | Date | null | undefined): string {
  return valor ? fechaCorta.format(aFecha(valor)) : "—"
}

export function formatearFechaLarga(valor: string | Date | null | undefined): string {
  if (!valor) return "—"
  const texto = fechaLarga.format(aFecha(valor))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function formatearHora(valor: string | Date | null | undefined): string {
  return valor ? hora.format(aFecha(valor)) : "—"
}

export function formatearHandicap(valor: number | null | undefined): string {
  if (valor == null) return "—"
  return valor > 0 ? `+${valor}` : String(valor)
}

export function nombreCompleto(j: { nombre: string | null; apellido: string | null }): string {
  return [j.nombre, j.apellido].filter(Boolean).join(" ")
}

export function iniciales(j: { nombre: string | null; apellido: string | null }): string {
  return `${j.nombre?.[0] ?? ""}${j.apellido?.[0] ?? ""}`.toUpperCase()
}

// Para búsquedas: sin tildes y en minúsculas.
export function normalizarBusqueda(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}
