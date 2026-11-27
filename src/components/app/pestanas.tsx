"use client"

import { useState, type ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type Pestana = { valor: string; titulo: string; contador?: number; alerta?: boolean; contenido: ReactNode }

// Pestañas que recuerdan la elegida en la URL (?tab=...). La primera es la predeterminada.
export function Pestanas({ pestanas, inicial }: { pestanas: Pestana[]; inicial?: string }) {
  const valores = pestanas.map((p) => p.valor)
  const [actual, setActual] = useState(inicial && valores.includes(inicial) ? inicial : valores[0])

  const cambiar = (v: string) => {
    setActual(v)
    const url = new URL(window.location.href)
    if (v === valores[0]) url.searchParams.delete("tab")
    else url.searchParams.set("tab", v)
    window.history.replaceState(null, "", url)
  }

  return (
    <Tabs value={actual} onValueChange={cambiar}>
      <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <TabsList className="h-11 w-max min-w-full justify-start sm:min-w-0">
          {pestanas.map((p) => (
            <TabsTrigger key={p.valor} value={p.valor} className="px-4">
              {p.titulo}
              {!!p.contador && (
                <span
                  className={
                    p.alerta
                      ? "ml-1 rounded-full bg-destructive/15 px-1.5 text-[0.7rem] font-semibold text-destructive tabular-nums"
                      : "ml-1 rounded-full bg-muted px-1.5 text-[0.7rem] text-muted-foreground tabular-nums"
                  }
                >
                  {p.contador}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {pestanas.map((p) => (
        <TabsContent key={p.valor} value={p.valor} className="mt-4">
          {p.contenido}
        </TabsContent>
      ))}
    </Tabs>
  )
}
