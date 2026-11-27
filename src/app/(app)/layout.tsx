import { BarraLateral } from "@/components/app/barra-lateral"
import { BarraInferior, EncabezadoMovil } from "@/components/app/navegacion-movil"
import { requerirUsuario } from "@/lib/auth"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const usuario = await requerirUsuario()

  return (
    <div className="min-h-svh">
      <BarraLateral usuario={usuario} />
      <EncabezadoMovil usuario={usuario} />
      <main className="pb-24 lg:pb-10 lg:pl-64">
        <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</div>
      </main>
      <BarraInferior />
    </div>
  )
}
