import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isAllowedEmail } from "@/lib/auth/domain";
import {
  SESSION_EXPIRED_REASON,
  isSessionExpired,
} from "@/lib/auth/session-policy";

/**
 * Proxy de Next.js 16 (antes llamado middleware). Se ejecuta antes de renderizar
 * cada ruta (excepto estáticos, según el `matcher`).
 *
 * Responsabilidades:
 *  1. Refrescar la sesión de Supabase en cada petición.
 *  2. Redirigir a /login a quien no tenga sesión en rutas privadas.
 *  3. Guard de respaldo: si el correo no es del dominio institucional, cerrar sesión.
 *  4. Caducidad: cerrar la sesión que superó la ventana máxima (8 h), para que
 *     nadie arrastre la sesión de un día al siguiente.
 *
 * La exigencia del segundo factor (MFA/aal2) se hace en el layout privado
 * (src/app/(app)/layout.tsx), donde tenemos acceso a los factores del usuario.
 */

// Rutas públicas (no requieren sesión). /api/keepalive lo invoca un cron
// externo sin sesión; se protege con KEEPALIVE_SECRET, no con cookies.
const PUBLIC_PREFIXES = ["/login", "/auth", "/api/keepalive"];

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

  // Sesión que superó la ventana máxima -> cerrar sesión y volver al login.
  // El corte lo decide el servidor sobre `last_sign_in_at`, que viene del
  // servidor de autenticación: no hay nada que el navegador pueda alterar.
  if (user && isSessionExpired(user)) {
    const signOutUrl = request.nextUrl.clone();
    signOutUrl.pathname = "/auth/signout";
    signOutUrl.search = `?reason=${SESSION_EXPIRED_REASON}`;
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
