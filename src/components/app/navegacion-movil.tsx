"use client"

import { MenuIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { Usuario } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { EnlacesNavegacion } from "./barra-lateral"
import { Marca } from "./marca"
import { MenuUsuario } from "./menu-usuario"
import { NAVEGACION, estaActivo } from "./navegacion"

// Barra superior del celular, con menú lateral completo.
export function EncabezadoMovil({ usuario }: { usuario: Usuario }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur lg:hidden">
      <Marca compacta />
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Abrir menú"
          >
            <MenuIcon className="size-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="border-b border-sidebar-border px-5 py-5">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <Marca />
          </SheetHeader>
          <div className="flex-1 px-3 py-4">
            <EnlacesNavegacion onNavegar={() => setAbierto(false)} />
          </div>
          <div className="border-t border-sidebar-border p-3 pb-safe">
            <MenuUsuario usuario={usuario} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

// Barra inferior con los módulos principales (pensada para el pulgar).
export function BarraInferior() {
  const pathname = usePathname()
  const items = NAVEGACION.filter((i) => i.enBarraMovil)

  return (
    <nav
      aria-label="Accesos rápidos"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-safe backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const activo = estaActivo(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium transition-colors",
                  activo ? "text-marino" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    activo && "bg-dorado/20",
                  )}
                >
                  <item.icono className={cn("size-5", activo && "text-dorado-oscuro")} />
                </span>
                {item.titulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
