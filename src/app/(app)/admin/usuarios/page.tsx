import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ROLES, roleLabel } from "@/lib/roles";
import { APP_NAME } from "@/lib/config";
import type { OficinaProductora, Proceso } from "@/lib/org";
import { setActivo, asignar } from "./actions";

export const metadata: Metadata = {
  title: `Usuarios — ${APP_NAME}`,
};

type Perfil = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  proceso_id: string | null;
  oficina_id: string | null;
};

export default async function UsuariosPage() {
  const supabase = await createClient();

  const [{ data: perfiles }, { data: procesos }, { data: oficinas }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, role, is_active, proceso_id, oficina_id")
        .order("is_active", { ascending: true })
        .order("email", { ascending: true }),
      supabase.from("procesos").select("id, nombre, codigo").order("codigo"),
      supabase
        .from("oficinas_productoras")
        .select("id, nombre, codigo, proceso_id")
        .order("codigo"),
    ]);

  const listaPerfiles = (perfiles ?? []) as Perfil[];
  const listaProcesos = (procesos ?? []) as Pick<
    Proceso,
    "id" | "nombre" | "codigo"
  >[];
  const listaOficinas = (oficinas ?? []) as Pick<
    OficinaProductora,
    "id" | "nombre" | "codigo" | "proceso_id"
  >[];

  const pendientes = listaPerfiles.filter((p) => !p.is_active);
  const activos = listaPerfiles.filter((p) => p.is_active);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Administración
        </Link>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-muted-foreground">
          Activa cuentas y asígnales rol, proceso y oficina productora.
        </p>
      </div>

      <Seccion
        titulo={`Pendientes de aprobación (${pendientes.length})`}
        vacio="No hay cuentas pendientes."
        perfiles={pendientes}
        procesos={listaProcesos}
        oficinas={listaOficinas}
      />

      <Seccion
        titulo={`Activos (${activos.length})`}
        vacio="Aún no hay cuentas activas."
        perfiles={activos}
        procesos={listaProcesos}
        oficinas={listaOficinas}
      />
    </div>
  );
}

function Seccion({
  titulo,
  vacio,
  perfiles,
  procesos,
  oficinas,
}: {
  titulo: string;
  vacio: string;
  perfiles: Perfil[];
  procesos: Pick<Proceso, "id" | "nombre" | "codigo">[];
  oficinas: Pick<
    OficinaProductora,
    "id" | "nombre" | "codigo" | "proceso_id"
  >[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{titulo}</h2>
      {perfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <div className="space-y-3">
          {perfiles.map((p) => (
            <FilaUsuario
              key={p.id}
              perfil={p}
              procesos={procesos}
              oficinas={oficinas}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FilaUsuario({
  perfil,
  procesos,
  oficinas,
}: {
  perfil: Perfil;
  procesos: Pick<Proceso, "id" | "nombre" | "codigo">[];
  oficinas: Pick<
    OficinaProductora,
    "id" | "nombre" | "codigo" | "proceso_id"
  >[];
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{perfil.full_name ?? perfil.email}</p>
          <p className="text-sm text-muted-foreground">{perfil.email}</p>
          <p className="mt-1 text-xs">
            <span
              className={
                perfil.is_active
                  ? "rounded bg-primary/10 px-2 py-0.5 text-primary"
                  : "rounded bg-secondary/15 px-2 py-0.5 text-secondary"
              }
            >
              {perfil.is_active ? "Activo" : "Pendiente"}
            </span>{" "}
            <span className="text-muted-foreground">
              {roleLabel(perfil.role)}
            </span>
          </p>
        </div>
        <form action={setActivo}>
          <input type="hidden" name="id" value={perfil.id} />
          <input
            type="hidden"
            name="activar"
            value={perfil.is_active ? "0" : "1"}
          />
          <button
            type="submit"
            className={
              perfil.is_active
                ? "rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                : "rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:opacity-90"
            }
          >
            {perfil.is_active ? "Desactivar" : "Activar"}
          </button>
        </form>
      </div>

      <form
        action={asignar}
        className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-4 sm:items-end"
      >
        <input type="hidden" name="id" value={perfil.id} />
        <Campo label="Rol">
          <select name="role" defaultValue={perfil.role} className={selectCls}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Proceso">
          <select
            name="proceso_id"
            defaultValue={perfil.proceso_id ?? ""}
            className={selectCls}
          >
            <option value="">— Sin proceso —</option>
            {procesos.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Oficina (opcional)">
          <select
            name="oficina_id"
            defaultValue={perfil.oficina_id ?? ""}
            className={selectCls}
          >
            <option value="">— Sin oficina —</option>
            {oficinas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} · {o.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <button
          type="submit"
          className="h-9 rounded-md border px-3 text-sm hover:bg-accent"
        >
          Guardar
        </button>
      </form>
    </div>
  );
}

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
