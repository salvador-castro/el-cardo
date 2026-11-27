import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { FormularioActividad } from "@/components/actividades/formulario-actividad"
import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { datosFormularioActividad } from "@/lib/actividades/datos-formulario"
import { fechaHoraAR } from "@/lib/actividades/esquema"
import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Editar actividad" }

export default async function EditarActividadPage({ params }: PageProps<"/actividades/[id]/editar">) {
  await requerirUsuario()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const [actividadRes, impagosRes, formulario] = await Promise.all([
    supabase.from("actividades").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("cobros")
      .select("id", { count: "exact", head: true })
      .eq("actividad_id", id)
      .not("participacion_id", "is", null)
      .in("estado", ["pendiente", "vencido", "bonificado"]),
    datosFormularioActividad(supabase),
  ])
  if (actividadRes.error) throw new Error(actividadRes.error.message)
  const a = actividadRes.data
  if (!a || a.tipo === "torneo") notFound()

  // Si el profesor actual quedó inactivo, se lo sigue mostrando para no perderlo al guardar.
  const profesores = [...formulario.profesores]
  if (a.profesor_id && !profesores.some((p) => p.id === a.profesor_id)) {
    const { data: actual } = await supabase
      .from("jugadores")
      .select("id, nombre, apellido, handicap")
      .eq("id", a.profesor_id)
      .maybeSingle()
    if (actual) profesores.unshift(actual)
  }

  const { fecha, hora } = fechaHoraAR(a.inicio)

  return (
    <>
      <Link href={`/actividades/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> {a.nombre}
      </Link>
      <EncabezadoPagina titulo="Editar actividad" />
      <FormularioActividad
        id={id}
        precios={formulario.precios}
        profesores={profesores}
        cobrosImpagos={impagosRes.count ?? 0}
        inicial={{
          tipo: a.tipo,
          nombre: a.nombre,
          fecha,
          hora,
          precio: Number(a.precio),
          profesor_id: a.profesor_id ?? "",
          notas: a.notas ?? "",
        }}
      />
    </>
  )
}
