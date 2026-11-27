"use client"

import { useState, type ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PESTANAS = ["datos", "actividades", "cuenta", "documentos"] as const
type Pestana = (typeof PESTANAS)[number]

export function PestanasFicha({
  inicial,
  contadores,
  datos,
  actividades,
  cuenta,
  documentos,
}: {
  inicial?: string
  contadores: { actividades: number; cobros: number; documentos: number }
  datos: ReactNode
  actividades: ReactNode
  cuenta: ReactNode
  documentos: ReactNode
}) {
  const [actual, setActual] = useState<Pestana>(PESTANAS.includes(inicial as Pestana) ? (inicial as Pestana) : "datos")

  const cambiar = (v: string) => {
    setActual(v as Pestana)
    const url = new URL(window.location.href)
    if (v === "datos") url.searchParams.delete("tab")
    else url.searchParams.set("tab", v)
    window.history.replaceState(null, "", url)
  }

  return (
    <Tabs value={actual} onValueChange={cambiar}>
      {/* En el celular las pestañas se deslizan de costado, sin barra de scroll visible. */}
      <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <TabsList className="h-11 w-max min-w-full justify-start sm:min-w-0">
          <TabsTrigger value="datos" className="px-4">Datos</TabsTrigger>
          <TabsTrigger value="actividades" className="px-4">
            Actividades <Contador n={contadores.actividades} />
          </TabsTrigger>
          <TabsTrigger value="cuenta" className="px-4">
            Cuenta corriente <Contador n={contadores.cobros} alerta />
          </TabsTrigger>
          <TabsTrigger value="documentos" className="px-4">
            Documentos <Contador n={contadores.documentos} />
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="datos" className="mt-4">{datos}</TabsContent>
      <TabsContent value="actividades" className="mt-4">{actividades}</TabsContent>
      <TabsContent value="cuenta" className="mt-4">{cuenta}</TabsContent>
      <TabsContent value="documentos" className="mt-4">{documentos}</TabsContent>
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
