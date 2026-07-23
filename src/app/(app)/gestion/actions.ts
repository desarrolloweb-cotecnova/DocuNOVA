"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  respaldarYlimpiarSesion,
  restaurarSesion,
  fijarMarcador,
  leerImpersonacion,
} from "@/lib/auth/impersonacion";
import {
  apruebaTRD,
  gestionaUsuarios,
  ROLES_ASIGNABLES,
  type Role,
} from "@/lib/roles";
import { leerFilas, textoONull } from "@/lib/excel";
import { fallo, type ResultadoImport } from "@/lib/importacion";
import {
  CATEGORIAS_MEMORIA,
  type TipoUnidad,
  type CategoriaMemoria,
} from "@/lib/tipos";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullable(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}
function bool(v: FormDataEntryValue | null): boolean {
  const s = str(v);
  return s === "1" || s === "on";
}

/** Activa o desactiva una cuenta. */
export async function setActivo(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const id = str(formData.get("id"));
  const activar = str(formData.get("activar")) === "1";

  const { error } = await supabase
    .from("perfiles")
    .update({ activo: activar })
    .eq("usuario_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
}

/** Invita a un usuario (pre-registro): obtendrá su rol al iniciar sesión. */
export async function crearPreRegistro(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const email = str(formData.get("email")).toLowerCase();
  const nombre = str(formData.get("nombre"));
  const rol = str(formData.get("rol")) as Role;
  if (!email || !nombre) throw new Error("Correo y nombre son obligatorios");
  if (!ROLES_ASIGNABLES.includes(rol)) throw new Error("Rol no válido");

  const { error } = await supabase.from("usuarios_semilla").upsert(
    {
      email,
      nombre,
      rol,
      numero_documento: nullable(formData.get("numero_documento")),
      unidad_id: nullable(formData.get("unidad_id")),
      oficina_id: nullable(formData.get("oficina_id")),
    },
    { onConflict: "email" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
}

/**
 * Edita el perfil de un usuario ya registrado (solo admin de usuarios): nombre,
 * cargo, jefe inmediato, proceso, responsable de proceso y cédula. El jefe
 * inmediato es un usuario marcado como responsable del proceso.
 */
export async function actualizarPerfilUsuario(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const id = str(formData.get("id"));
  if (!id) throw new Error("Usuario no válido");
  const rol = str(formData.get("rol")) as Role;
  if (!ROLES_ASIGNABLES.includes(rol)) throw new Error("Rol no válido");

  const { error: e1 } = await supabase
    .from("perfiles")
    .update({
      nombre_completo: nullable(formData.get("nombre_completo")),
      titulo_cargo: nullable(formData.get("titulo_cargo")),
      supervisor_id: nullable(formData.get("supervisor_id")),
      unidad_id: nullable(formData.get("unidad_id")),
      es_responsable: bool(formData.get("es_responsable")),
      rol,
    })
    .eq("usuario_id", id);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase.from("datos_personales").upsert(
    {
      usuario_id: id,
      numero_documento: nullable(formData.get("numero_documento")),
    },
    { onConflict: "usuario_id" },
  );
  if (e2) throw new Error(e2.message);

  revalidatePath("/gestion");
}

/**
 * Carga masiva de usuarios (invitaciones) desde Excel: por cada fila hace
 * upsert en usuarios_semilla, resolviendo proceso_codigo y oficina_codigo.
 */
export async function importarUsuarios(
  _prev: ResultadoImport,
  formData: FormData,
): Promise<ResultadoImport> {
  let supabase: Awaited<ReturnType<typeof requireCapacidad>>;
  try {
    supabase = await requireCapacidad(gestionaUsuarios);
  } catch {
    return fallo("No tienes permiso para cargar usuarios.");
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return fallo("No se recibió ningún archivo.");
  }

  let filas: Record<string, string>[];
  try {
    filas = await leerFilas(archivo);
  } catch {
    return fallo("No se pudo leer el archivo. ¿Es un Excel válido?");
  }
  if (filas.length === 0) return fallo("El archivo no tiene filas de datos.");

  const [{ data: unidadesData }, { data: oficinasData }] = await Promise.all([
    supabase.from("unidades").select("id, codigo").eq("tipo", "proceso"),
    supabase.from("oficinas").select("id, codigo"),
  ]);
  const unidadPorCodigo = new Map(
    (unidadesData ?? []).map((u) => [u.codigo, u.id]),
  );
  const oficinaPorCodigo = new Map(
    (oficinasData ?? []).map((o) => [o.codigo, o.id]),
  );

  let creados = 0;
  let actualizados = 0;
  const errores: string[] = [];

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const linea = i + 2; // +1 encabezado, +1 base 1
    try {
      const email = (f.email ?? "").toLowerCase();
      const nombre = f.nombre ?? "";
      if (!email || !nombre) {
        errores.push(`Fila ${linea}: correo y nombre son obligatorios.`);
        continue;
      }

      const rol = (f.rol || "consulta") as Role;
      if (!ROLES_ASIGNABLES.includes(rol)) {
        errores.push(`Fila ${linea}: rol '${f.rol}' no válido.`);
        continue;
      }

      let unidadId: string | null = null;
      if (f.proceso_codigo) {
        unidadId = unidadPorCodigo.get(f.proceso_codigo) ?? null;
        if (!unidadId) {
          errores.push(
            `Fila ${linea}: proceso '${f.proceso_codigo}' no existe.`,
          );
          continue;
        }
      }

      let oficinaId: string | null = null;
      if (f.oficina_codigo) {
        oficinaId = oficinaPorCodigo.get(f.oficina_codigo) ?? null;
        if (!oficinaId) {
          errores.push(
            `Fila ${linea}: oficina '${f.oficina_codigo}' no existe.`,
          );
          continue;
        }
      }

      const { data: existente } = await supabase
        .from("usuarios_semilla")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      const { error } = await supabase.from("usuarios_semilla").upsert(
        {
          email,
          nombre,
          rol,
          numero_documento: textoONull(f.numero_documento),
          unidad_id: unidadId,
          oficina_id: oficinaId,
          notas: textoONull(f.notas),
        },
        { onConflict: "email" },
      );
      if (error) throw new Error(error.message);

      if (existente) actualizados++;
      else creados++;
    } catch (e) {
      errores.push(`Fila ${linea}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/gestion");
  return { ok: true, creados, actualizados, omitidos: 0, errores };
}

/** Elimina un pre-registro. */
export async function eliminarPreRegistro(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const email = str(formData.get("email"));
  const { error } = await supabase
    .from("usuarios_semilla")
    .delete()
    .eq("email", email);
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
}

// ---------------------------------------------------------------------------
// Impersonación ("iniciar sesión como") — solo admin de usuarios.
// Forja una sesión real del usuario objetivo para verificar lo que ese rol ve
// (la RLS gobierna por auth.uid()). El segundo factor se omite solo para esta
// sesión impersonada (ver guard.ts); el marcador va firmado con la service_role.
// ---------------------------------------------------------------------------

/** Inicia una sesión como el usuario indicado (respaldando la del admin). */
export async function iniciarImpersonacion(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) throw new Error("No autenticado");

  // El administrador debe tener su propio 2FA verificado en esta sesión.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    throw new Error("Verifica tu segundo factor antes de impersonar.");
  }

  const objetivoId = str(formData.get("id"));
  if (!objetivoId || objetivoId === actor.id) {
    throw new Error("Selecciona otro usuario para impersonar.");
  }

  const service = createAdminClient();
  const { data: objetivo, error: e0 } = await service
    .from("perfiles")
    .select("email, rol, activo")
    .eq("usuario_id", objetivoId)
    .maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!objetivo) throw new Error("El usuario no existe.");
  if (!objetivo.activo) {
    throw new Error("No puedes impersonar una cuenta inactiva.");
  }
  if (gestionaUsuarios(objetivo.rol)) {
    throw new Error("No puedes impersonar a otro administrador de usuarios.");
  }

  // Respalda la sesión del admin y forja la del objetivo (magiclink → verifyOtp).
  await respaldarYlimpiarSesion();

  const { data: enlace, error: e1 } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: objetivo.email,
  });
  if (e1 || !enlace?.properties?.hashed_token) {
    await restaurarSesion();
    throw new Error(e1?.message ?? "No se pudo generar la sesión.");
  }

  const sesion = await createClient();
  const { error: e2 } = await sesion.auth.verifyOtp({
    type: "magiclink",
    token_hash: enlace.properties.hashed_token,
  });
  if (e2) {
    await restaurarSesion();
    throw new Error(e2.message);
  }

  await fijarMarcador(actor.id, objetivoId);

  await service.from("impersonacion_log").insert({
    actor_id: actor.id,
    actor_email: actor.email ?? "",
    objetivo_id: objetivoId,
    objetivo_email: objetivo.email,
    accion: "inicio",
  });

  redirect("/dashboard");
}

/** Termina la impersonación y restaura la sesión del administrador. */
export async function detenerImpersonacion() {
  const imp = await leerImpersonacion();
  await restaurarSesion();

  if (imp) {
    const service = createAdminClient();
    const { data } = await service
      .from("perfiles")
      .select("usuario_id, email")
      .in("usuario_id", [imp.actorId, imp.objetivoId]);
    const email = (id: string) =>
      data?.find((p) => p.usuario_id === id)?.email ?? "";
    await service.from("impersonacion_log").insert({
      actor_id: imp.actorId,
      actor_email: email(imp.actorId),
      objetivo_id: imp.objetivoId,
      objetivo_email: email(imp.objetivoId),
      accion: "fin",
    });
  }

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Estructura organizacional (unidades: eje / macroproceso / proceso)
// La RLS de `unidades` exige puede_aprobar_trd; en la interfaz solo se expone
// dentro de Gestión (superadmin/rector).
// ---------------------------------------------------------------------------

/** Crea una unidad organizacional (eje, macroproceso o proceso). */
export async function crearUnidad(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const tipo = str(formData.get("tipo")) as TipoUnidad;
  const padre_id = nullable(formData.get("padre_id"));
  if (tipo !== "eje" && !padre_id) {
    throw new Error("Un macroproceso o proceso requiere una unidad padre");
  }
  const { error } = await supabase.from("unidades").insert({
    tipo,
    codigo: str(formData.get("codigo")),
    nombre: str(formData.get("nombre")),
    padre_id: tipo === "eje" ? null : padre_id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/dependencias");
}

/** Actualiza el código y el nombre de una unidad organizacional. */
export async function actualizarUnidad(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("unidades")
    .update({
      codigo: str(formData.get("codigo")),
      nombre: str(formData.get("nombre")),
    })
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/dependencias");
}

/** Elimina una unidad organizacional. */
export async function eliminarUnidad(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("unidades")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/dependencias");
}

// ---------------------------------------------------------------------------
// Componentes de Memoria Corporativa (subcategorías por memoria).
// La RLS de `memoria_componentes` exige puede_aprobar_trd (administrador+).
// ---------------------------------------------------------------------------

/** Crea un componente en una categoría de memoria. */
export async function crearComponente(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const categoria = str(formData.get("categoria")) as CategoriaMemoria;
  const nombre = str(formData.get("nombre"));
  if (!CATEGORIAS_MEMORIA.includes(categoria)) {
    throw new Error("Categoría no válida");
  }
  if (!nombre) throw new Error("El nombre del componente es obligatorio");
  const { error } = await supabase
    .from("memoria_componentes")
    .insert({ categoria, nombre });
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/memoria");
}

/** Renombra o activa/desactiva un componente. */
export async function actualizarComponente(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const id = str(formData.get("id"));
  const nombre = str(formData.get("nombre"));
  if (!id) throw new Error("Componente no válido");
  if (!nombre) throw new Error("El nombre del componente es obligatorio");
  const { error } = await supabase
    .from("memoria_componentes")
    .update({ nombre, activo: bool(formData.get("activo")) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/memoria");
}

/** Elimina un componente (los documentos asociados quedan sin componente). */
export async function eliminarComponente(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("memoria_componentes")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/memoria");
}
