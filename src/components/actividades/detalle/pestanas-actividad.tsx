"use client"

import { useState, type ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PESTANAS = ["participantes", "partidos", "asistencia", "cobros"] as const
type Pestana = (typeof PESTANAS)[number]

export function PestanasActividad({
  inicial,
  tituloParticipantes,
  contadores,
  participantes,
  partidos,
  asistencia,
  cobros,
}: {
  inicial?: string
  tituloParticipantes: string
  contadores: { participantes: number; partidos: number; sinMarcar: number; vencidos: number }
  participantes: ReactNode
  // Solo prácticas (las clases no tienen partidos).
  partidos?: ReactNode
  asistencia: ReactNode
  cobros: ReactNode
}) {
  const [actual, setActual] = useState<Pestana>(
    PESTANAS.includes(inicial as Pestana) && (inicial !== "partidos" || partidos) ? (inicial as Pestana) : "participantes",
  )

  const cambiar = (v: string) => {
    setActual(v as Pestana)
    const url = new URL(window.location.href)
    if (v === "participantes") url.searchParams.delete("tab")
    else url.searchParams.set("tab", v)
    window.history.replaceState(null, "", url)
  }

  return (
    <Tabs value={actual} onValueChange={cambiar}>
      <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <TabsList className="h-11 w-max min-w-full justify-start sm:min-w-0">
          <TabsTrigger value="participantes" className="px-4">
            {tituloParticipantes} <Contador n={contadores.participantes} />
          </TabsTrigger>
          {partidos && (
            <TabsTrigger value="partidos" className="px-4">
              Partidos <Contador n={contadores.partidos} />
            </TabsTrigger>
          )}
          <TabsTrigger value="asistencia" className="px-4">
            Asistencia <Contador n={contadores.sinMarcar} />
          </TabsTrigger>
          <TabsTrigger value="cobros" className="px-4">
            Cobros <Contador n={contadores.vencidos} alerta />
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="participantes" className="mt-4">{participantes}</TabsContent>
      {partidos && (
        <TabsContent value="partidos" className="mt-4">
          {partidos}
        </TabsContent>
      )}
      <TabsContent value="asistencia" className="mt-4">{asistencia}</TabsContent>
      <TabsContent value="cobros" className="mt-4">{cobros}</TabsContent>
    </Tabs>
  )
}

function Contador({ n, alerta = false }: { n: number; alerta?: boolean }) {
  if (!n) return null
  return (
    <span
      className={
        alerta
          ? "ml-1 rounded-full bg-destructive/15 px-1.5 text-[0.7rem] font-semibold text-destructive tabular-nums"
          : "ml-1 rounded-full bg-muted px-1.5 text-[0.7rem] text-muted-foreground tabular-nums"
      }
    >
      {n}
    </span>
  )
}
