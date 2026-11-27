import type { Metadata } from "next"
import Image from "next/image"

import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Ingresar" }

const ERRORES: Record<string, string> = {
  sin_acceso: "Tu sesión expiró o tu usuario no tiene acceso. Volvé a ingresar.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams
  const destino = typeof next === "string" ? next : undefined
  const mensaje = typeof error === "string" ? ERRORES[error] : undefined

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-marino-deep px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(198_163_90/0.18),transparent_60%)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/marca/escudo-crema.png"
            alt="El Cardo Polo Club"
            width={180}
            height={126}
            priority
            className="h-auto w-36"
          />
          <p className="mt-5 font-marca text-xs text-dorado">Gestión del club</p>
        </div>

        <div className="rounded-xl border border-dorado/25 bg-card p-6 shadow-2xl shadow-black/30">
          <h1 className="mb-1 font-heading text-3xl font-semibold">Ingresar</h1>
          <p className="mb-6 text-sm text-muted-foreground">Acceso para administradores del club.</p>
          <LoginForm next={destino} errorInicial={mensaje} />
        </div>

        <p className="mt-8 text-center text-xs text-crema/50">El Cardo Polo Club · Zárate, Buenos Aires</p>
      </div>
    </main>
  )
}
