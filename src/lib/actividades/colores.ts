// Colores de camiseta (lista fija; la misma que valida la base en `partidos`).
export const COLORES_CAMISETA = [
  "blanco",
  "azul",
  "celeste",
  "rojo",
  "bordo",
  "verde",
  "amarillo",
  "naranja",
  "negro",
  "gris",
] as const

export type ColorCamiseta = (typeof COLORES_CAMISETA)[number]

export const COLOR_CAMISETA: Record<ColorCamiseta, { etiqueta: string; hex: string }> = {
  blanco: { etiqueta: "Blanco", hex: "#ffffff" },
  azul: { etiqueta: "Azul", hex: "#1e3a8a" },
  celeste: { etiqueta: "Celeste", hex: "#7dd3fc" },
  rojo: { etiqueta: "Rojo", hex: "#dc2626" },
  bordo: { etiqueta: "Bordó", hex: "#7f1d1d" },
  verde: { etiqueta: "Verde", hex: "#15803d" },
  amarillo: { etiqueta: "Amarillo", hex: "#facc15" },
  naranja: { etiqueta: "Naranja", hex: "#f97316" },
  negro: { etiqueta: "Negro", hex: "#111111" },
  gris: { etiqueta: "Gris", hex: "#9ca3af" },
}

export const esColorCamiseta = (v: unknown): v is ColorCamiseta =>
  typeof v === "string" && (COLORES_CAMISETA as readonly string[]).includes(v)

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()

// Para equipos sin camiseta guardada: si se llaman como un color ("Blanco", "Azul"), se usa ese.
export function colorPorNombre(nombre: string): ColorCamiseta | null {
  const n = sinTildes(nombre)
  return COLORES_CAMISETA.find((c) => c === n || sinTildes(COLOR_CAMISETA[c].etiqueta) === n) ?? null
}
