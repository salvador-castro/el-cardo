import {
  CalendarDaysIcon,
  HomeIcon,
  SettingsIcon,
  TrophyIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

export type ItemNavegacion = {
  href: string
  titulo: string
  icono: LucideIcon
  // Aparece en la barra inferior del celular.
  enBarraMovil: boolean
}

export const NAVEGACION: ItemNavegacion[] = [
  { href: "/", titulo: "Inicio", icono: HomeIcon, enBarraMovil: true },
  { href: "/jugadores", titulo: "Jugadores", icono: UsersIcon, enBarraMovil: true },
  { href: "/actividades", titulo: "Actividades", icono: CalendarDaysIcon, enBarraMovil: true },
  { href: "/torneos", titulo: "Torneos", icono: TrophyIcon, enBarraMovil: true },
  { href: "/cobros", titulo: "Cobros", icono: WalletIcon, enBarraMovil: true },
  { href: "/configuracion", titulo: "Configuración", icono: SettingsIcon, enBarraMovil: false },
]

export function estaActivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}
