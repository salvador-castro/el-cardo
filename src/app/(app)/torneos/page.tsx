import type { Metadata } from "next"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { Proximamente } from "@/components/app/proximamente"

export const metadata: Metadata = { title: "Torneos" }

export default function Page() {
  return (
    <>
      <EncabezadoPagina titulo="Torneos" descripcion="Categorías, zonas, fixture y posiciones." />
      <Proximamente etapa={4} detalle="Categorías, zonas, fixture, carga de resultados y tabla de posiciones." />
    </>
  )
}
