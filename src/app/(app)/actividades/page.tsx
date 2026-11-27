import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { ListadoActividades } from "@/components/actividades/listado-actividades"
import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { Button } from "@/components/ui/button"
import { TIPOS_ACTIVIDAD_GESTION } from "@/lib/actividades/constantes"
import { aFilaActividad } from "@/lib/actividades/filas"
import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Actividades" }

export default async function ActividadesPage() {
  await requerirUsuario()
  const supabase = await createClient()

  // Los torneos se gestionan en su propio módulo (etapa 4).
  const { data, error } = await supabase
    .from("actividades_resumen")
    .select(
      "id, tipo, nombre, inicio, estado, precio, profesor_nombre, participantes, presentes, monto_esperado, monto_cobrado",
    )
    .in("tipo", [...TIPOS_ACTIVIDAD_GESTION])
    .order("inicio", { ascending: false })
  if (error) throw new Error(error.message)

  const actividades = data.map(aFilaActividad)
  const programadas = actividades.filter((a) => a.estado === "programada").length

  return (
    <>
      <EncabezadoPagina
        titulo="Actividades"
        descripcion={`Prácticas y clases · ${programadas} ${programadas === 1 ? "programada" : "programadas"}`}
        acciones={
          <Button asChild size="lg">
            <Link href="/actividades/nueva">
              <PlusIcon /> Nueva actividad
            </Link>
          </Button>
        }
      />
      <ListadoActividades actividades={actividades} />
    </>
  )
}
