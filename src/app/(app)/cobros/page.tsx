import type { Metadata } from "next"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { Proximamente } from "@/components/app/proximamente"

export const metadata: Metadata = { title: "Cobros" }

export default function Page() {
  return (
    <>
      <EncabezadoPagina titulo="Cobros" descripcion="Cuotas sociales, cobros por actividad y Mercado Pago." />
      <Proximamente etapa={5} detalle="Cuota social, links de pago con Mercado Pago, QR, WhatsApp y registro de pagos manuales." />
    </>
  )
}
