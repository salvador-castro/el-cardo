"use client"

import { LogOutIcon } from "lucide-react"
import { useTransition } from "react"

import { cerrarSesion } from "@/app/login/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Usuario } from "@/lib/auth"

function inicialesDe(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
}

export function MenuUsuario({ usuario }: { usuario: Usuario }) {
  const [pendiente, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <Avatar className="size-9 border border-dorado/40">
        <AvatarFallback className="bg-marino-soft text-xs text-crema">{inicialesDe(usuario.nombre)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{usuario.nombre}</p>
        <p className="truncate text-xs text-sidebar-foreground/60">{usuario.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        onClick={() => startTransition(() => cerrarSesion())}
        disabled={pendiente}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOutIcon />
      </Button>
    </div>
  )
}
