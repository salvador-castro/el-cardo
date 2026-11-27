"use client"

import { UserCheckIcon, UserXIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { cambiarEstadoJugador } from "@/app/(app)/jugadores/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

// Los jugadores no se borran nunca: se dan de baja (inactivos) y se pueden reactivar.
export function AccionEstadoJugador({ id, activo, nombre }: { id: string; activo: boolean; nombre: string }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()

  const confirmar = () =>
    startTransition(async () => {
      const r = await cambiarEstadoJugador(id, !activo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(activo ? `${nombre} quedó inactivo.` : `${nombre} está activo de nuevo.`)
      router.refresh()
    })

  if (!activo) {
    return (
      <Button variant="outline" size="lg" onClick={confirmar} disabled={pendiente}>
        <UserCheckIcon /> Reactivar
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="lg" className="text-muted-foreground">
          <UserXIcon /> Dar de baja
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Dar de baja a {nombre}?</AlertDialogTitle>
          <AlertDialogDescription>
            Queda inactivo: no aparece al anotar en actividades y no se le generan cuotas. Su historial, cobros y
            documentos se conservan, y lo podés reactivar cuando quieras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmar} disabled={pendiente}>
            Dar de baja
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
