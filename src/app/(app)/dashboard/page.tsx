import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardCheck,
  FileStack,
  Mail,
  Search,
  Building2,
  Settings,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import { roleLabel, apruebaTRD, gestionaUsuarios } from "@/lib/roles";
import { getPerfilActual } from "@/services/perfiles";
import { listRegistrosRecientes } from "@/services/registros";
import { ESTADO_REGISTRO_LABELS, labelDe } from "@/lib/tipos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: `Panel — ${APP_NAME}`,
};

export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [perfil, recientes] = await Promise.all([
    getPerfilActual(),
    listRegistrosRecientes(5),
  ]);

  const { count: docsCount } = await supabase
    .from("documentos")
    .select("*", { count: "exact", head: true })
    .eq("estado", "activo");

  const rol = perfil?.rol ?? null;

  // Alerta para aprobadores: TRD en revisión.
  let enRevision = 0;
  if (apruebaTRD(rol)) {
    const { count } = await supabase
      .from("series")
      .select("*", { count: "exact", head: true })
      .eq("estado_aprobacion", "en_revision");
    enRevision = count ?? 0;
  }

  const nombre = perfil?.nombre_completo ?? user?.email ?? "";
  const meta = user?.user_metadata ?? {};
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Bienvenida */}
      <Card>
        <CardContent className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={nombre}
              referrerPolicy="no-referrer"
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
              {nombre.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">Hola, {nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {roleLabel(rol)}
              {perfil?.unidad_nombre ? ` · ${perfil.unidad_nombre}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {apruebaTRD(rol) && enRevision > 0 && (
        <Link
          href="/trd"
          className="flex items-center gap-3 rounded-lg border border-secondary/40 bg-secondary/10 p-4 text-sm text-secondary-foreground transition-colors hover:bg-secondary/15"
        >
          <AlertTriangle className="size-5 text-secondary" />
          <span>
            Tienes <strong>{enRevision}</strong> entrada(s) de TRD en revisión
            pendientes de aprobación.
          </span>
          <ArrowRight className="ml-auto size-4 text-secondary" />
        </Link>
      )}

      {/* Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<ClipboardCheck className="size-5" />}
          label="Mis registros"
          value={String(recientes.length)}
        />
        <StatCard
          icon={<FileStack className="size-5" />}
          label="Documentos activos"
          value={String(docsCount ?? 0)}
        />
        <StatCard
          icon={<Mail className="size-5" />}
          label="Mi correo"
          value={user?.email ?? "—"}
          small
        />
      </div>

      {/* Últimos registros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos registros</CardTitle>
        </CardHeader>
        <CardContent>
          {recientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has creado registros.{" "}
              <Link href="/registros" className="text-primary hover:underline">
                Crear el primero
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {recientes.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {r.documento_nombre ?? "Documento"}
                  </span>
                  <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                    {labelDe(ESTADO_REGISTRO_LABELS, r.estado)} ·{" "}
                    {new Date(r.creado_en).toLocaleDateString("es-CO")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Accesos rápidos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/consulta"
          icon={<Search className="size-5" />}
          label="Consulta"
        />
        <QuickLink
          href="/documentos"
          icon={<FileStack className="size-5" />}
          label="Documentos"
        />
        <QuickLink
          href="/registros"
          icon={<ClipboardCheck className="size-5" />}
          label="Registros"
        />
        {gestionaUsuarios(rol) ? (
          <QuickLink
            href="/configuracion"
            icon={<Settings className="size-5" />}
            label="Configuración"
          />
        ) : (
          <QuickLink
            href="/dependencias"
            icon={<Building2 className="size-5" />}
            label="Dependencias"
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={
              small ? "truncate text-sm font-medium" : "text-2xl font-semibold"
            }
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
    >
      <span className="text-primary">{icon}</span>
      {label}
      <ArrowRight className="ml-auto size-4 text-muted-foreground" />
    </Link>
  );
}
