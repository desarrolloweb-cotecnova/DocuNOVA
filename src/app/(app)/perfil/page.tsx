import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import { roleLabel } from "@/lib/roles";

export const metadata: Metadata = {
  title: `Mi perfil — ${APP_NAME}`,
};

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, role, procesos(nombre), oficinas_productoras(codigo, nombre)",
    )
    .eq("id", user?.id ?? "")
    .maybeSingle();

  // La cédula es un dato reservado: la RLS solo la muestra al dueño y al super admin.
  const { data: sensibles } = await supabase
    .from("datos_sensibles")
    .select("cedula")
    .eq("profile_id", user?.id ?? "")
    .maybeSingle();

  const proc = profile?.procesos as { nombre: string } | null | undefined;
  const ofi = profile?.oficinas_productoras as
    { codigo: string; nombre: string } | null | undefined;
  const meta = user?.user_metadata ?? {};
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;
  const nombre: string = profile?.full_name ?? user?.email ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={nombre}
              referrerPolicy="no-referrer"
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {nombre
                .split(" ")
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-semibold">{nombre}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-medium text-secondary">
                {roleLabel(profile?.role)}
              </span>
              {proc?.nombre && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {proc.nombre}
                </span>
              )}
              {ofi && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {ofi.codigo} · {ofi.nombre}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-6 divide-y border-t text-sm">
          <Fila termino="Nombre completo" valor={nombre} />
          <Fila termino="Correo institucional" valor={user?.email ?? "—"} />
          <Fila termino="Rol" valor={roleLabel(profile?.role)} />
          <Fila termino="Proceso" valor={proc?.nombre ?? "—"} />
          <Fila
            termino="Oficina productora"
            valor={ofi ? `${ofi.codigo} · ${ofi.nombre}` : "—"}
          />
          <Fila
            termino="Documento de identidad"
            valor={sensibles?.cedula ?? "—"}
            nota="Dato reservado (Ley 1581): solo visible para ti y el administrador."
          />
        </dl>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-primary/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Tu rol, proceso y oficina los asigna el administrador. Tu sesión está
          protegida con verificación en dos pasos (segundo factor).
        </p>
      </div>
    </div>
  );
}

function Fila({
  termino,
  valor,
  nota,
}: {
  termino: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-muted-foreground">{termino}</dt>
      <dd className="text-right font-medium sm:max-w-[60%]">
        {valor}
        {nota && (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {nota}
          </span>
        )}
      </dd>
    </div>
  );
}
