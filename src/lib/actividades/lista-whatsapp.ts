// Convierte una lista pegada de WhatsApp en nombres para buscar.
// Ejemplos de líneas que se limpian:
//   "1. Juan Pérez ✅"   "2) Nico Barrios"   "- Sofi Herrera (invitada)"
//   "[27/11 10:32] Juan: Lucía González"   "• Pedro 🐴"
export function nombresDeLista(texto: string): string[] {
  const vistos = new Set<string>()
  const nombres: string[] = []

  for (const linea of texto.split(/\r?\n/)) {
    const limpio = linea
      // Prefijo de mensaje copiado: "[27/11/26, 10:32] Nombre: ..."
      .replace(/^\s*\[[^\]]*\]\s*[^:]{1,40}:\s*/, "")
      // Viñetas y numeración: "1.", "1)", "1 -", "-", "•", "*"
      .replace(/^\s*(?:\d{1,3}\s*[.)\-–:]?|[-–•*·>])\s*/, "")
      // Aclaraciones entre paréntesis
      .replace(/\([^)]*\)/g, " ")
      // Emojis, símbolos y números sueltos
      .replace(/[^\p{L}\s'’.-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[.\-'’]+|[.\-'’]+$/g, "")
      .trim()

    if (limpio.length < 2) continue
    const clave = limpio.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    nombres.push(limpio)
  }

  return nombres.slice(0, 60)
}
