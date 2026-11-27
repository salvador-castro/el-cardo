"use client"

import { CameraIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useTransition } from "react"
import { toast } from "sonner"

import { actualizarFoto } from "@/app/(app)/jugadores/actions"
import { AvatarJugador } from "@/components/jugadores/insignias"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { reducirImagen, subirArchivo } from "@/lib/storage"

export function FotoJugador({
  jugadorId,
  jugador,
  fotoUrl,
}: {
  jugadorId: string
  jugador: { nombre: string | null; apellido: string | null }
  fotoUrl: string | null
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pendiente, startTransition] = useTransition()

  const subir = (archivo: File) =>
    startTransition(async () => {
      try {
        const reducida = await reducirImagen(archivo)
        const path = await subirArchivo("fotos", jugadorId, reducida)
        const r = await actualizarFoto(jugadorId, path)
        if (!r.ok) throw new Error(r.error)
        toast.success("Foto actualizada.")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo subir la foto.")
      }
    })

  const quitar = () =>
    startTransition(async () => {
      const r = await actualizarFoto(jugadorId, null)
      if (!r.ok) toast.error(r.error)
      else router.refresh()
    })

  return (
    <div className="relative shrink-0">
      <AvatarJugador jugador={jugador} fotoUrl={fotoUrl} className="size-16 border-2 border-dorado/40 text-lg sm:size-24 sm:text-xl" />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) subir(f)
          e.target.value = ""
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pendiente}
          className="absolute -right-1 -bottom-1 flex size-8 sm:size-9 items-center justify-center rounded-full border-2 border-card bg-marino text-crema shadow-sm"
          aria-label="Cambiar foto"
        >
          {pendiente ? <Loader2Icon className="size-4 animate-spin" /> : <CameraIcon className="size-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => input.current?.click()}>
            {fotoUrl ? "Cambiar foto" : "Subir foto"}
          </DropdownMenuItem>
          {fotoUrl && (
            <DropdownMenuItem variant="destructive" onSelect={quitar}>
              Quitar foto
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
