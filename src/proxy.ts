import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isAllowedEmail } from "@/lib/auth/domain";

/**
 * Proxy de Next.js 16 (antes llamado middleware). Se ejecuta antes de renderizar
 * cada ruta (excepto estáticos, según el `matcher`).
 *
 * Responsabilidades:
 *  1. Refrescar la sesión de Supabase en cada petición.
 *  2. Redirigir a /login a quien no tenga sesión en rutas privadas.
 *  3. Guard de respaldo: si el correo no es del dominio institucional, cerrar sesión.
 *
 * La exigencia del segundo factor (MFA/aal2) se hace en el layout privado
 * (src/app/(app)/layout.tsx), donde tenemos acceso a los factores del usuario.
 */

// Rutas públicas (no requieren sesión).
const PUBLIC_PREFIXES = ["/login", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Usuario autenticado pero fuera del dominio permitido -> cerrar sesión.
  if (user && !isAllowedEmail(user.email)) {
    const signOutUrl = request.nextUrl.clone();
    signOutUrl.pathname = "/auth/signout";
    signOutUrl.search = "?reason=domain";
    return NextResponse.redirect(signOutUrl);
  }

  // Rutas privadas sin sesión -> login.
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // Usuario autenticado que visita /login -> enviarlo a la app.
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/dashboard";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  // Ejecuta en todas las rutas excepto estáticos e imágenes optimizadas.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
