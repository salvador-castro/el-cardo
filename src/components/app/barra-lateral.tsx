"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { Usuario } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Marca } from "./marca"
import { MenuUsuario } from "./menu-usuario"
import { NAVEGACION, estaActivo } from "./navegacion"

export function EnlacesNavegacion({ onNavegar }: { onNavegar?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1" aria-label="Principal">
      {NAVEGACION.map((item) => {
        const activo = estaActivo(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavegar}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              activo
                ? "bg-sidebar-accent text-sidebar-foreground shadow-[inset_3px_0_0_var(--dorado)]"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <item.icono className={cn("size-[18px]", activo ? "text-dorado" : "text-sidebar-foreground/60")} />
            {item.titulo}
          </Link>
        )
      })}
    </nav>
  )
}

export function BarraLateral({ usuario }: { usuario: Usuario }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-20 items-center border-b border-sidebar-border px-5">
        <Marca />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <EnlacesNavegacion />
      </div>
      <div className="border-t border-sidebar-border p-3">
        <MenuUsuario usuario={usuario} />
      </div>
    </aside>
  )
}
