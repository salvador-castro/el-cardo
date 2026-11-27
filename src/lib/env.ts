// Acceso a variables de entorno con mensajes claros cuando faltan.
// Las NEXT_PUBLIC_* se referencian de forma literal para que Next las inyecte en el cliente.

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisá .env.local (ver .env.example).`)
  }
  return valor
}

export const envPublico = {
  get supabaseUrl() {
    return requerida("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get supabaseKey() {
    return requerida(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    )
  },
  get appUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
  },
  clubNombre: process.env.NEXT_PUBLIC_CLUB_NOMBRE ?? "El Cardo Polo Club",
  clubWhatsapp: process.env.NEXT_PUBLIC_CLUB_WHATSAPP ?? "",
}
