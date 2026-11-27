import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function TorneoNoEncontrado() {
  return (
    <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <h2 className="font-heading text-2xl font-semibold">Torneo no encontrado</h2>
      <p className="mt-1 text-sm text-muted-foreground">Puede que el enlace esté mal escrito.</p>
      <Button asChild className="mt-6">
        <Link href="/torneos">Volver a torneos</Link>
      </Button>
    </div>
  )
}
