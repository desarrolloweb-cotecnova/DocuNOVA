import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { getSessionExpiry } from "@/lib/auth/session-policy";
import { activationRedirect } from "@/lib/auth/activation";
import { leerImpersonacion } from "@/lib/auth/impersonacion";
import {
  listMisNotificaciones,
  contarMisNoLeidas,
} from "@/services/notificaciones";
import { AppShell } from "@/components/app-shell";

/**
 * Layout de las rutas privadas. El gate de auth (sesión, dominio, aal2) vive en
 * requireAuth(); aquí solo añadimos la comprobación de cuenta activa y los datos
 * del encabezado (rol, unidad, oficina).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireAuth();

  // Perfil (puede no existir si la migración/seed no se aplicó todavía).
  const { data: profile } = await supabase
    .from("perfiles")
    .select("nombre_completo, rol, activo, unidades(nombre)")
    .eq("usuario_id", user.id)
    .maybeSingle();

  // Cuenta pendiente de aprobación -> pantalla informativa.
  const pending = activationRedirect(
    profile ? { activo: profile.activo } : null,
  );
  if (pending) redirect(pending);

  // Oficina de la que el usuario es responsable (la principal, si tiene varias).
  const { data: resp } = await supabase
    .from("responsables_oficina")
    .select("oficinas(codigo, nombre)")
    .eq("usuario_id", user.id)
    .order("es_principal", { ascending: false })
    .limit(1)
    .maybeSingle();

  const unidad = profile?.unidades as { nombre: string } | null | undefined;
  const ofi = resp?.oficinas as
    { codigo: string; nombre: string } | null | undefined;
  const meta = user.user_metadata ?? {};
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;

  // Notificaciones para el encabezado (últimas + contador). Los servicios
  // devuelven arrays vacíos / 0 si la tabla aún no existe.
  const [notificaciones, noLeidas] = await Promise.all([
    listMisNotificaciones(6),
    contarMisNoLeidas(),
  ]);

  // Banner de impersonación: si la sesión actual es una impersonación válida,
  // mostramos a quién se está viendo y el botón para volver.
  const imp = await leerImpersonacion();
  const impersonando = imp
    ? { nombre: profile?.nombre_completo ?? user.email ?? "usuario" }
    : null;

  return (
    <AppShell
      impersonando={impersonando}
      sesionExpiraEn={getSessionExpiry(user)}
      email={user.email ?? ""}
      fullName={profile?.nombre_completo ?? null}
      role={profile?.rol ?? null}
      unidadNombre={unidad?.nombre ?? null}
      oficinaLabel={ofi ? `${ofi.codigo} · ${ofi.nombre}` : null}
      avatarUrl={avatarUrl}
      notificaciones={notificaciones}
      noLeidas={noLeidas}
    >
      {children}
    </AppShell>
  );
}
