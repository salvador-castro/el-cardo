import type { Metadata } from "next"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { Proximamente } from "@/components/app/proximamente"

export const metadata: Metadata = { title: "Actividades" }

export default function Page() {
  return (
    <>
      <EncabezadoPagina titulo="Actividades" descripcion="Prácticas, clases y torneos." />
      <Proximamente etapa={3} detalle="Listado y calendario, armado de equipos, asistencia y carga de varios jugadores desde WhatsApp." />
    </>
  )
}
