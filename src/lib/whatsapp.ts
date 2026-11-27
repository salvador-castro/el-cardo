// Normaliza un teléfono argentino al formato de wa.me (sin + ni espacios).
// Acepta "+54 9 3489 40-1201", "03489 15 401201", "3489401201", etc.
export function telefonoWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  let d = telefono.replace(/\D/g, "")
  if (!d) return null

  if (d.startsWith("54")) {
    d = d.slice(2)
    if (d.startsWith("9")) d = d.slice(1)
  }
  if (d.startsWith("0")) d = d.slice(1)
  // Quita el "15" de celulares escritos a la antigua (área de 2 a 4 dígitos + 15 + número).
  const conQuince = d.match(/^(\d{2,4})15(\d{6,8})$/)
  if (conQuince && conQuince[1].length + conQuince[2].length === 10) d = conQuince[1] + conQuince[2]

  if (d.length !== 10) return null
  return `549${d}`
}

export function enlaceWhatsapp(telefono: string | null | undefined, mensaje?: string): string | null {
  const numero = telefonoWhatsapp(telefono)
  if (!numero) return null
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`
}
