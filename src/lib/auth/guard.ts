import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/domain";
import { esSesionImpersonada } from "@/lib/auth/impersonacion";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Gate de autenticación reutilizable para rutas privadas. Aplica, en orden:
 *  1. Sesión válida (si no, a /login).
 *  2. Dominio institucional (si no, cerrar sesión).
 *  3. Segundo factor verificado — aal2 (si no, a /mfa/verify o /mfa/enroll).
 *
 * Si retorna, el usuario está autenticado, es del dominio y superó el 2FA.
 * Este guard es independiente del modelo de perfil: la comprobación de cuenta
 * activa (perfiles.activo) se hace en el layout con activationRedirect().
 */
export async function requireAuth(): Promise<{
  supabase: SupabaseServerClient;
  user: User;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/auth/signout?reason=domain");

  // Excepción de MFA para las sesiones impersonadas: el administrador ya superó
  // su propio segundo factor al iniciar la impersonación (el marcador va firmado
  // con la service_role key, así que no puede fabricarse en el cliente).
  if (!(await esSesionImpersonada())) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal?.currentLevel !== "aal2") {
      redirect(aal?.nextLevel === "aal2" ? "/mfa/verify" : "/mfa/enroll");
    }
  }

  return { supabase, user };
}
