import { CORTO_FASE, FASES, type PartidoTorneo } from "./constantes"

// Orden de los partidos dentro de una categoría: por fase, día y hora, y orden manual.
export function ordenarPartidos<T extends Pick<PartidoTorneo, "fase" | "inicio" | "orden" | "zona_id">>(lista: T[]) {
  return [...lista].sort(
    (a, b) =>
      FASES.indexOf(a.fase) - FASES.indexOf(b.fase) ||
      (a.inicio ?? "9999").localeCompare(b.inicio ?? "9999") ||
      a.orden - b.orden,
  )
}

// Nombre de cada partido, numerado por categoría y fase: "Cuartos 1", "Semi 2", "Final", "Partido 3".
export function nombresDePartidos(partidos: PartidoTorneo[]): Map<string, string> {
  const nombres = new Map<string, string>()
  const porGrupo = new Map<string, PartidoTorneo[]>()
  for (const p of ordenarPartidos(partidos)) {
    const clave = `${p.categoria_id}|${p.fase === "grupos" || p.fase === "otro" ? "partido" : p.fase}`
    porGrupo.set(clave, [...(porGrupo.get(clave) ?? []), p])
  }
  for (const lista of porGrupo.values()) {
    lista.forEach((p, i) => {
      if (p.fase === "final" && lista.length === 1) nombres.set(p.id, "Final")
      else nombres.set(p.id, `${CORTO_FASE[p.fase]} ${i + 1}`)
    })
  }
  return nombres
}

// Qué se muestra en un lado del partido cuando todavía no hay equipo.
export function textoOrigen(
  p: PartidoTorneo,
  lado: "a" | "b",
  nombres: Map<string, string>,
  zonas: Map<string, string>,
): string | null {
  const partido = lado === "a" ? p.desde_a_partido : p.desde_b_partido
  const resultado = lado === "a" ? p.desde_a_resultado : p.desde_b_resultado
  const zona = lado === "a" ? p.desde_a_zona : p.desde_b_zona
  const puesto = lado === "a" ? p.desde_a_puesto : p.desde_b_puesto
  if (partido) return `${resultado === "perdedor" ? "Perdedor" : "Ganador"} de ${nombres.get(partido) ?? "otro partido"}`
  if (zona) return `${puesto}.º de ${zonas.get(zona) ?? "la zona"}`
  return (lado === "a" ? p.placeholder_a : p.placeholder_b) || null
}
