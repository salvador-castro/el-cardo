import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatearFecha, formatearHandicap } from "@/lib/formato"
import { ETIQUETA_MANO, ETIQUETA_TIPO_JUGADOR } from "@/lib/jugadores/constantes"
import type { Tables } from "@/types/database"

type Historial = Pick<Tables<"handicap_historial">, "id" | "handicap_anterior" | "handicap_nuevo" | "created_at">

function edad(fecha: string | null) {
  if (!fecha) return null
  const n = new Date(`${fecha}T12:00:00`)
  const hoy = new Date()
  let anios = hoy.getFullYear() - n.getFullYear()
  if (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) anios--
  return anios
}

export function TabDatos({ jugador: j, historial }: { jugador: Tables<"jugadores_resumen">; historial: Historial[] }) {
  const anios = edad(j.fecha_nacimiento)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloque titulo="Personales">
        <Dato etiqueta="DNI" valor={j.dni} />
        <Dato
          etiqueta="Nacimiento"
          valor={j.fecha_nacimiento ? `${formatearFecha(j.fecha_nacimiento)}${anios !== null ? ` (${anios} años)` : ""}` : null}
        />
        <Dato etiqueta="Teléfono" valor={j.telefono && <a href={`tel:${j.telefono}`} className="hover:underline">{j.telefono}</a>} />
        <Dato etiqueta="Email" valor={j.email && <a href={`mailto:${j.email}`} className="break-all hover:underline">{j.email}</a>} />
        <Dato etiqueta="Dirección" valor={j.direccion} />
      </Bloque>

      <Bloque titulo="Club">
        <Dato etiqueta="Tipo" valor={j.tipo ? ETIQUETA_TIPO_JUGADOR[j.tipo] : null} />
        <Dato etiqueta="Estado" valor={j.activo ? "Activo" : "Inactivo"} />
        <Dato etiqueta="Alta" valor={formatearFecha(j.fecha_alta)} />
        <Dato etiqueta="Club de origen" valor={j.club_origen} />
        <Dato etiqueta="Profesor" valor={j.es_profesor ? "Sí" : "No"} />
        {j.notas && <Dato etiqueta="Notas" valor={<span className="whitespace-pre-line">{j.notas}</span>} />}
      </Bloque>

      <Bloque titulo="Emergencia">
        <Dato
          etiqueta="Contacto"
          valor={j.emergencia_nombre && `${j.emergencia_nombre}${j.emergencia_vinculo ? ` (${j.emergencia_vinculo})` : ""}`}
        />
        <Dato
          etiqueta="Teléfono"
          valor={j.emergencia_telefono && <a href={`tel:${j.emergencia_telefono}`} className="font-medium hover:underline">{j.emergencia_telefono}</a>}
        />
        <Dato etiqueta="Grupo sanguíneo" valor={j.grupo_sanguineo} />
        <Dato etiqueta="Obra social" valor={j.obra_social && `${j.obra_social}${j.numero_afiliado ? ` · ${j.numero_afiliado}` : ""}`} />
      </Bloque>

      <Bloque titulo="Polo">
        <Dato etiqueta="Hándicap" valor={formatearHandicap(j.handicap)} />
        <Dato etiqueta="Mano" valor={j.mano ? ETIQUETA_MANO[j.mano] : null} />
        <div className="pt-2">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Historial de hándicap</p>
          {historial.length ? (
            <ol className="space-y-1.5">
              {historial.map((h) => {
                const subio = h.handicap_anterior !== null && h.handicap_nuevo > h.handicap_anterior
                const bajo = h.handicap_anterior !== null && h.handicap_nuevo < h.handicap_anterior
                return (
                  <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{formatearFecha(h.created_at)}</span>
                    <span className="flex items-center gap-1.5 tabular-nums">
                      {h.handicap_anterior === null ? (
                        <span className="text-muted-foreground">Inicial</span>
                      ) : (
                        <span className="text-muted-foreground">{formatearHandicap(h.handicap_anterior)} →</span>
                      )}
                      <b>{formatearHandicap(h.handicap_nuevo)}</b>
                      {subio && <TrendingUpIcon className="size-4 text-exito" />}
                      {bajo && <TrendingDownIcon className="size-4 text-destructive" />}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
          )}
        </div>
      </Bloque>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl font-semibold">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">{children}</dl>
      </CardContent>
    </Card>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 text-right">{valor || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}
