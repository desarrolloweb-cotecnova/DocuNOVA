import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { gestionaUsuarios } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { Tabs, type Tab } from "@/components/tabs";
import { MonitoreoSupabase } from "@/components/monitoreo-supabase";

export const metadata: Metadata = {
  title: `Configuración — ${APP_NAME}`,
};

/**
 * Módulo de Configuración. Por ahora contiene el monitoreo de Supabase (uso vs.
 * límites del Plan Free y keepalive). Restringido a quien administra usuarios
 * (superadmin/rector), igual que en CampusNOVA y CrediNOVA.
 */
export default async function ConfiguracionPage() {
  const rol = await rolDelUsuario();
  if (!gestionaUsuarios(rol)) redirect("/dashboard");

  const tabs: Tab[] = [
    {
      id: "supabase",
      label: "Monitoreo Supabase",
      content: <MonitoreoSupabase />,
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Tabs defaultId="supabase" tabs={tabs} />
    </div>
  );
}
