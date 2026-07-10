import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Crea un cliente de Supabase ligado a la petición/respuesta del proxy y
 * refresca la sesión (renueva tokens y reescribe cookies si es necesario).
 *
 * Devuelve la respuesta base (`response`) que el proxy debe usar/propagar y el
 * usuario autenticado (`user`) o `null`.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANTE: no ejecutar lógica entre crear el cliente y getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
