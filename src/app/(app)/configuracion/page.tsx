import type { Metadata } from "next"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { Proximamente } from "@/components/app/proximamente"

export const metadata: Metadata = { title: "Configuración" }

export default function Page() {
  return (
    <>
      <EncabezadoPagina titulo="Configuración" descripcion="Cuota social y precios sugeridos." />
      <Proximamente etapa={5} detalle="Monto y vencimiento de la cuota social, y precios sugeridos por tipo de actividad." />
    </>
  )
}
