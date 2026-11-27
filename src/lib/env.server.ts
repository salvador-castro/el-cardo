import "server-only"

function requerida(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisá .env.local (ver .env.example).`)
  }
  return valor
}

// Variables secretas: solo se leen en el servidor.
export const envServidor = {
  get supabaseSecretKey() {
    return requerida("SUPABASE_SECRET_KEY")
  },
  get mpAccessToken() {
    return requerida("MP_ACCESS_TOKEN")
  },
  get mpWebhookSecret() {
    return requerida("MP_WEBHOOK_SECRET")
  },
  get cronSecret() {
    return requerida("CRON_SECRET")
  },
}
