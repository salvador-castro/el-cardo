import type { NextRequest } from "next/server"

import { actualizarSesion } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return actualizarSesion(request)
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes.
    "/((?!_next/static|_next/image|icon.png|apple-icon.png|favicon.ico|marca/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
