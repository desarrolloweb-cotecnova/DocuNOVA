import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/domain";
import { activationRedirect } from "@/lib/auth/activation";
import { AppShell } from "@/components/app-shell";

/**
 * Layout de las rutas privadas de la aplicación. Aplica, en orden:
 *  1. Sesión válida (si no, a /login).
 *  2. Dominio institucional (si no, cerrar sesión).
 *  3. Segundo factor verificado — aal2 (si no, a /mfa/enroll o /mfa/verify).
 *  4. Cuenta activa (si no, a /pendiente).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/auth/signout?reason=domain");

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel !== "aal2") {
    redirect(aal?.nextLevel === "aal2" ? "/mfa/verify" : "/mfa/enroll");
  }

  // Perfil con proceso/oficina (puede no existir si la migración no se aplicó).
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, role, is_active, procesos(nombre), oficinas_productoras(codigo, nombre)",
    )
    .eq("id", user.id)
    .maybeSingle();

  // Cuenta pendiente de aprobación -> pantalla informativa.
  const pending = activationRedirect(
    profile ? { is_active: profile.is_active } : null,
  );
  if (pending) redirect(pending);

  // Notificaciones para el encabezado (recientes + no leídas).
  const [{ data: notifs }, { count }] = await Promise.all([
    supabase
      .from("notificaciones")
      .select("id, asunto, tipo, leida, created_at, entidad_tipo, entidad_id")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("leida", false),
  ]);

  const proc = profile?.procesos as { nombre: string } | null | undefined;
  const ofi = profile?.oficinas_productoras as
    { codigo: string; nombre: string } | null | undefined;
  const meta = user.user_metadata ?? {};
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;

  return (
    <AppShell
      email={user.email ?? ""}
      fullName={profile?.full_name ?? null}
      role={profile?.role ?? null}
      procesoNombre={proc?.nombre ?? null}
      oficinaLabel={ofi ? `${ofi.codigo} · ${ofi.nombre}` : null}
      avatarUrl={avatarUrl}
      notificaciones={notifs ?? []}
      noLeidas={count ?? 0}
    >
      {children}
    </AppShell>
  );
}
