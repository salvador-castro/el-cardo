import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { FormularioTorneo } from "@/components/torneos/formulario-torneo"
import { fechaHoraAR } from "@/lib/actividades/esquema"
import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Editar torneo" }

export default async function EditarTorneoPage({ params }: PageProps<"/torneos/[id]/editar">) {
  await requerirUsuario()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const { data: t, error } = await supabase
    .from("actividades")
    .select("id, nombre, inicio, fin, precio, notas, tipo")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!t || t.tipo !== "torneo") notFound()

  const inicio = fechaHoraAR(t.inicio)
  const fin = fechaHoraAR(t.fin ?? t.inicio)

  return (
    <>
      <Link href={`/torneos/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> {t.nombre}
      </Link>
      <EncabezadoPagina titulo="Editar torneo" />
      <FormularioTorneo
        id={id}
        precioSugerido={Number(t.precio)}
        inicial={{
          nombre: t.nombre,
          fecha_inicio: inicio.fecha,
          hora_inicio: inicio.hora,
          fecha_fin: fin.fecha,
          hora_fin: fin.hora,
          precio: Number(t.precio),
          notas: t.notas ?? "",
        }}
      />
    </>
  )
}
