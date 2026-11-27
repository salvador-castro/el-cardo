import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { FormularioJugador } from "@/components/jugadores/formulario-jugador"
import { requerirUsuario } from "@/lib/auth"

export const metadata: Metadata = { title: "Nuevo jugador" }

export default async function NuevoJugadorPage() {
  await requerirUsuario()
  return (
    <>
      <Link href="/jugadores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Jugadores
      </Link>
      <EncabezadoPagina titulo="Nuevo jugador" descripcion="Solo nombre, apellido y tipo son obligatorios." />
      <FormularioJugador />
    </>
  )
}
