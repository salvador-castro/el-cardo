import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { FormularioJugador } from "@/components/jugadores/formulario-jugador"
import { requerirUsuario } from "@/lib/auth"
import type { DatosJugador } from "@/lib/jugadores/esquema"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Editar jugador" }

export default async function EditarJugadorPage({ params }: PageProps<"/jugadores/[id]/editar">) {
  await requerirUsuario()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const { data: j, error } = await supabase.from("jugadores").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!j) notFound()

  const inicial: DatosJugador = {
    nombre: j.nombre,
    apellido: j.apellido,
    dni: j.dni ?? "",
    fecha_nacimiento: j.fecha_nacimiento ?? "",
    telefono: j.telefono ?? "",
    email: j.email ?? "",
    direccion: j.direccion ?? "",
    tipo: j.tipo,
    activo: j.activo,
    fecha_alta: j.fecha_alta,
    club_origen: j.club_origen ?? "",
    es_profesor: j.es_profesor,
    notas: j.notas ?? "",
    handicap: j.handicap,
    mano: j.mano ?? "",
    emergencia_nombre: j.emergencia_nombre ?? "",
    emergencia_vinculo: j.emergencia_vinculo ?? "",
    emergencia_telefono: j.emergencia_telefono ?? "",
    grupo_sanguineo: (j.grupo_sanguineo ?? "") as DatosJugador["grupo_sanguineo"],
    obra_social: j.obra_social ?? "",
    numero_afiliado: j.numero_afiliado ?? "",
  }

  return (
    <>
      <Link href={`/jugadores/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> {j.nombre} {j.apellido}
      </Link>
      <EncabezadoPagina titulo="Editar jugador" />
      <FormularioJugador id={id} inicial={inicial} />
    </>
  )
}
