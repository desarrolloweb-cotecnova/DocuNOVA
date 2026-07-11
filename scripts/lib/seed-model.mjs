/**
 * Construye el modelo de datos semilla (estructura, TRD y usuarios) a partir de
 * los CSV reales de Cotecnova. Separado del emisor de SQL para poder verificar
 * los conteos y la integridad con pruebas unitarias.
 */

import { createHash } from "node:crypto";
import { parseCsvObjects } from "./csv.mjs";
import {
  EJES,
  MACROPROCESOS,
  PROCESOS,
  CONSEJO_DIRECTIVO_TRD,
} from "./org-data.mjs";
import {
  mapRol,
  requiereCuenta,
  oficinaCodeFromText,
  xToBool,
} from "./mapping.mjs";

const NS = "docunova"; // namespace para UUIDs deterministas

/** UUID v5 determinista a partir de una clave natural estable. */
export function uuidFor(kind, key) {
  const h = createHash("sha1").update(`${NS}:${kind}:${key}`).digest("hex");
  const b = h.slice(0, 32).split("");
  b[12] = "5"; // versión 5
  const variant = (parseInt(b[16], 16) & 0x3) | 0x8;
  b[16] = variant.toString(16);
  const s = b.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export function buildModel(trdText, usuariosText) {
  const trd = parseCsvObjects(trdText);
  const usuarios = parseCsvObjects(usuariosText);

  // --- Ejes / Macroprocesos / Procesos (canónicos) ---
  const ejes = EJES.map((e) => ({ id: uuidFor("eje", e.codigo), ...e }));
  const macroprocesos = MACROPROCESOS.map((m) => ({
    id: uuidFor("macro", m.codigo),
    eje_id: uuidFor("eje", m.eje),
    ...m,
  }));
  const procesos = PROCESOS.map((p) => ({
    id: uuidFor("proceso", p.codigo),
    macroproceso_id: uuidFor("macro", p.macro),
    ...p,
  }));
  const procesoByTrd = new Map(
    procesos.filter((p) => p.nombreTrd).map((p) => [p.nombreTrd, p]),
  );
  const procesoByClave = new Map(procesos.map((p) => [p.codigo, p]));

  // --- Oficinas productoras (derivadas de la TRD) ---
  const oficinasMap = new Map();
  for (const r of trd) {
    const cod = r.Cod_Oficina;
    if (oficinasMap.has(cod)) continue;
    let procesoId = null;
    if (r.Proceso !== CONSEJO_DIRECTIVO_TRD) {
      const p = procesoByTrd.get(r.Proceso);
      if (!p)
        throw new Error(
          `TRD: proceso no reconocido para oficina ${cod}: "${r.Proceso}"`,
        );
      procesoId = p.id;
    }
    oficinasMap.set(cod, {
      id: uuidFor("oficina", cod),
      codigo: cod,
      nombre: r.Oficina_Productora,
      proceso_id: procesoId,
    });
  }
  const oficinas = [...oficinasMap.values()];

  // --- Series y subseries (de la TRD) ---
  const seriesMap = new Map();
  const subseries = [];
  let orden = 0;
  for (const r of trd) {
    // En este CSV, `Cod_Serie` repite el código de la oficina; la identidad real
    // de la serie es su nombre. La clave agrupa por oficina + nombre de serie.
    const serieKey = `${r.Cod_Oficina}|${r.Serie}`;
    if (!seriesMap.has(serieKey)) {
      seriesMap.set(serieKey, {
        id: uuidFor("serie", serieKey),
        oficina_id: oficinasMap.get(r.Cod_Oficina).id,
        cod_serie: r.Cod_Serie,
        nombre: r.Serie,
      });
    }
    orden += 1;
    subseries.push({
      id: uuidFor("subserie", `${serieKey}|${orden}`),
      serie_id: seriesMap.get(serieKey).id,
      nombre: r.Subserie_TipoDocumental,
      soporte_fisico: xToBool(r.Soporte_Fisico),
      soporte_electronico: xToBool(r.Soporte_Electronico),
      retencion_gestion: r.Retencion_ArchivoGestion,
      retencion_central: r.Retencion_ArchivoCentral,
      disp_conservacion_total: xToBool(r.Disp_ConservacionTotal),
      disp_eliminacion: xToBool(r.Disp_Eliminacion),
      disp_seleccion: xToBool(r.Disp_Seleccion),
      disp_medio_digital: xToBool(r.Disp_MedioDigital),
      procedimiento: r.Procedimiento,
      orden,
    });
  }
  const series = [...seriesMap.values()];

  // --- Usuarios semilla (pre-registro) ---
  const usuariosSemilla = usuarios.map((u) => {
    const proc = procesoByClave.get(u.Proceso);
    if (!proc)
      throw new Error(
        `Usuario ${u.Correo}: proceso no reconocido "${u.Proceso}"`,
      );
    const ofiCod = oficinaCodeFromText(u.Oficina_Productora_Sugerida);
    if (ofiCod && !oficinasMap.has(ofiCod)) {
      throw new Error(`Usuario ${u.Correo}: oficina ${ofiCod} inexistente`);
    }
    return {
      email: u.Correo.trim().toLowerCase(),
      nombre: u.Nombre_Completo.trim(),
      cedula: u.Cedula.trim(),
      proceso_id: proc.id,
      oficina_id: ofiCod ? oficinasMap.get(ofiCod).id : null,
      rol: mapRol(u.Rol_Sugerido, u.Correo),
      requiere_cuenta: requiereCuenta(u.Rol_Sugerido),
      notas: u.Notas ?? "",
    };
  });

  return {
    ejes,
    macroprocesos,
    procesos,
    oficinas,
    series,
    subseries,
    usuariosSemilla,
  };
}
