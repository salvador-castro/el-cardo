import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { FormularioActividad } from "@/components/actividades/formulario-actividad"
import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { datosFormularioActividad } from "@/lib/actividades/datos-formulario"
import { nombreSugerido } from "@/lib/actividades/esquema"
import { esFechaISO, hoyAR } from "@/lib/actividades/semana"
import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Nueva actividad" }

export default async function NuevaActividadPage({ searchParams }: PageProps<"/actividades/nueva">) {
  await requerirUsuario()
  const { tipo: tipoParam, fecha: fechaParam } = await searchParams
  const tipo = tipoParam === "clase" ? "clase" : "practica"
  const fecha = typeof fechaParam === "string" && esFechaISO(fechaParam) ? fechaParam : hoyAR()

  const supabase = await createClient()
  const { precios, profesores } = await datosFormularioActividad(supabase)

  return (
    <>
      <Link href="/actividades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Actividades
      </Link>
      <EncabezadoPagina titulo="Nueva actividad" descripcion="Después de crearla, anotás a los jugadores y armás los equipos." />
      <FormularioActividad
        precios={precios}
        profesores={profesores}
        inicial={{
          tipo,
          nombre: nombreSugerido(tipo, fecha),
          fecha,
          hora: tipo === "clase" ? "10:00" : "16:30",
          precio: precios[tipo],
          profesor_id: profesores.length === 1 && tipo === "clase" ? profesores[0].id : "",
          notas: "",
        }}
      />
    </>
  )
}
