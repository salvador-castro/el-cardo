import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { FormularioTorneo } from "@/components/torneos/formulario-torneo"
import { hoyAR, sumarDias } from "@/lib/actividades/semana"
import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Nuevo torneo" }

export default async function NuevoTorneoPage() {
  await requerirUsuario()
  const supabase = await createClient()
  const { data: config } = await supabase.from("configuracion").select("precio_torneo").maybeSingle()
  const precio = Number(config?.precio_torneo ?? 0)
  const hoy = hoyAR()

  return (
    <>
      <Link href="/torneos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Torneos
      </Link>
      <EncabezadoPagina titulo="Nuevo torneo" descripcion="Después cargás las categorías, los equipos y el fixture." />
      <FormularioTorneo
        precioSugerido={precio}
        inicial={{
          nombre: "",
          fecha_inicio: hoy,
          hora_inicio: "14:00",
          fecha_fin: sumarDias(hoy, 2),
          hora_fin: "19:00",
          precio,
          notas: "",
        }}
      />
    </>
  )
}
