import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/roles";

/**
 * Guard del módulo de administración: solo el super administrador. La RLS de la
 * base de datos es la barrera real; esta comprobación evita mostrar la interfaz.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isSuperAdmin(profile?.role)) redirect("/dashboard");

  return <>{children}</>;
}
