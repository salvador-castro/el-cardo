import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/types/database"

// Rutas accesibles sin sesión. Todo lo demás requiere login.
const RUTAS_PUBLICAS = [/^\/login\/?$/, /^\/pagar\/[^/]+\/?$/, /^\/api\/webhooks\/mercadopago\/?$/, /^\/api\/cron\/.+/]

export function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some((re) => re.test(pathname))
}

// Rutas que no usan la sesión del usuario (se autentican por firma o CRON_SECRET).
function esRutaSinSesion(pathname: string) {
  return pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/cron/")
}

export async function actualizarSesion(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (esRutaSinSesion(pathname)) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    // Sin configuración no hay forma de validar la sesión: solo se deja ver lo público.
    if (esRutaPublica(pathname)) return response
    return new NextResponse("Falta configurar Supabase (ver .env.example).", { status: 500 })
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
      },
    },
  })

  // No meter código entre createServerClient y getClaims: refresca el token si hace falta.
  const { data } = await supabase.auth.getClaims()
  const logueado = Boolean(data?.claims?.sub)

  if (!logueado && !esRutaPublica(pathname)) {
    const destino = request.nextUrl.clone()
    destino.pathname = "/login"
    destino.search = ""
    if (pathname !== "/") destino.searchParams.set("next", pathname + search)
    return redirigirConCookies(destino, response)
  }

  if (logueado && pathname.startsWith("/login")) {
    const destino = request.nextUrl.clone()
    destino.pathname = "/"
    destino.search = ""
    return redirigirConCookies(destino, response)
  }

  return response
}

// Conserva las cookies de sesión refrescadas al redirigir.
function redirigirConCookies(destino: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(destino)
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}
