import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EncabezadoPagina } from "@/components/app/encabezado-pagina"
import { AltaRapidaJugador } from "@/components/jugadores/alta-rapida"
import { ListadoJugadores, type FilaJugador } from "@/components/jugadores/listado-jugadores"
import { Button } from "@/components/ui/button"
import { requerirUsuario } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { urlsFirmadas } from "@/lib/supabase/urls-firmadas"

export const metadata: Metadata = { title: "Jugadores" }

export default async function JugadoresPage() {
  await requerirUsuario()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("jugadores_resumen")
    .select(
      "id, nombre, apellido, dni, tipo, activo, handicap, telefono, club_origen, es_profesor, foto_path, deuda, cobros_adeudados, apto_estado, alerta_documentos",
    )
    .order("apellido")
    .order("nombre")
  if (error) throw new Error(error.message)

  const fotos = await urlsFirmadas(
    supabase,
    "fotos",
    data.map((j) => j.foto_path),
  )

  const jugadores: FilaJugador[] = data.map((j) => ({
    id: j.id!,
    nombre: j.nombre ?? "",
    apellido: j.apellido ?? "",
    dni: j.dni,
    tipo: j.tipo!,
    activo: j.activo ?? true,
    handicap: j.handicap ?? 0,
    telefono: j.telefono,
    club_origen: j.club_origen,
    es_profesor: j.es_profesor ?? false,
    foto_url: j.foto_path ? (fotos[j.foto_path] ?? null) : null,
    deuda: Number(j.deuda ?? 0),
    cobros_adeudados: j.cobros_adeudados ?? 0,
    apto_estado: (j.apto_estado ?? "sin_apto") as FilaJugador["apto_estado"],
    alerta_documentos: j.alerta_documentos,
  }))

  return (
    <>
      <EncabezadoPagina
        titulo="Jugadores"
        descripcion={`${jugadores.filter((j) => j.activo).length} activos · ${jugadores.length} en total`}
        acciones={
          <>
            <AltaRapidaJugador />
            <Button asChild size="lg">
              <Link href="/jugadores/nuevo">
                <PlusIcon /> Nuevo jugador
              </Link>
            </Button>
          </>
        }
      />
      <ListadoJugadores jugadores={jugadores} />
    </>
  )
}
