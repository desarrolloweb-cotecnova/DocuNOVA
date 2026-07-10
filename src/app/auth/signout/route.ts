import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cierra la sesión del usuario y redirige a /login.
 * Acepta GET (enlaces / redirecciones del proxy) y POST (botón de la app).
 * El parámetro opcional `reason` (p. ej. `domain`) se propaga a /login.
 */
async function handle(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const reason = searchParams.get("reason");

  const supabase = await createClient();
  await supabase.auth.signOut();

  const suffix = reason ? `?error=${encodeURIComponent(reason)}` : "";
  return NextResponse.redirect(`${origin}/login${suffix}`);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
