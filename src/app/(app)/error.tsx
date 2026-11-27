"use client"

import { TriangleAlertIcon } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function ErrorPagina({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card px-6 py-16 text-center">
      <TriangleAlertIcon className="mb-3 size-8 text-destructive" />
      <h2 className="font-heading text-2xl font-semibold">Algo salió mal</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        No pudimos cargar esta sección. Probá de nuevo en unos segundos.
      </p>
      <Button className="mt-6" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  )
}
