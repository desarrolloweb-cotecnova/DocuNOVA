import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildModel } from "../../scripts/lib/seed-model.mjs";
import {
  mapRol,
  requiereCuenta,
  oficinaCodeFromText,
  xToBool,
} from "../../scripts/lib/mapping.mjs";

const model = buildModel(
  readFileSync("data/trd_cotecnova.csv", "utf8"),
  readFileSync("data/usuarios_seed.csv", "utf8"),
);

describe("semilla: conteos esperados (arnés item e)", () => {
  it("estructura organizacional", () => {
    expect(model.ejes).toHaveLength(3);
    expect(model.macroprocesos).toHaveLength(10);
    expect(model.procesos).toHaveLength(16);
    expect(model.oficinas).toHaveLength(25);
  });

  it("catálogo TRD", () => {
    expect(model.series).toHaveLength(128);
    expect(model.subseries).toHaveLength(230);
  });

  it("usuarios semilla", () => {
    expect(model.usuariosSemilla).toHaveLength(38);
  });
});

describe("semilla: relación Proceso → Oficina Productora", () => {
  const procesoPorId = (id: string | null) =>
    model.procesos.find((p) => p.id === id) ?? null;

  it("Financiera se divide en 3 oficinas del mismo proceso", () => {
    const fin = model.oficinas.filter((o) =>
      ["1251", "1252", "1253"].includes(o.codigo),
    );
    expect(fin.map((o) => o.nombre).sort()).toEqual([
      "Contabilidad",
      "Crédito y Cartera",
      "Tesorería",
    ]);
    const procIds = new Set(fin.map((o) => o.proceso_id));
    expect(procIds.size).toBe(1);
    expect(procesoPorId([...procIds][0])?.codigo).toBe("A-FI - Financiera");
  });

  it("Consejo Directivo (1001) es independiente, sin proceso", () => {
    const cd = model.oficinas.find((o) => o.codigo === "1001");
    expect(cd?.proceso_id).toBeNull();
  });

  it("los procesos 100% electrónicos no tienen oficina productora", () => {
    const electronicos = model.procesos.filter((p) =>
      [
        "Sistemas Integrados de Gestión",
        "Sistema de Aseguramiento Interno de Calidad",
      ].includes(p.nombre),
    );
    expect(electronicos).toHaveLength(2);
    for (const p of electronicos) {
      expect(model.oficinas.some((o) => o.proceso_id === p.id)).toBe(false);
    }
  });

  it("Formación agrupa 7 oficinas productoras", () => {
    const formacion = model.procesos.find((p) => p.nombre === "Formación");
    const ofis = model.oficinas.filter((o) => o.proceso_id === formacion?.id);
    expect(ofis).toHaveLength(7);
  });

  it("toda oficina (salvo Consejo Directivo) referencia un proceso válido", () => {
    for (const o of model.oficinas) {
      if (o.codigo === "1001") continue;
      expect(procesoPorId(o.proceso_id)).not.toBeNull();
    }
  });
});

describe("semilla: integridad de usuarios", () => {
  it("cada usuario referencia un proceso válido y, si tiene, una oficina válida", () => {
    for (const u of model.usuariosSemilla) {
      expect(model.procesos.some((p) => p.id === u.proceso_id)).toBe(true);
      if (u.oficina_id) {
        expect(model.oficinas.some((o) => o.id === u.oficina_id)).toBe(true);
      }
    }
  });

  it("todos los usuarios traen cédula (dato sensible)", () => {
    for (const u of model.usuariosSemilla) {
      expect(u.cedula.length).toBeGreaterThan(0);
    }
  });
});

describe("mapeo de roles CSV → 5 roles del sistema", () => {
  it("Gestión Documental se mapea a admin_archivo", () => {
    expect(
      mapRol("Administrador de Proceso", "gestiondocumental@cotecnova.edu.co"),
    ).toBe("admin_archivo");
  });

  it("Administrador de Proceso/Oficina → jefe_dependencia", () => {
    expect(mapRol("Administrador de Proceso", "x@cotecnova.edu.co")).toBe(
      "jefe_dependencia",
    );
    expect(
      mapRol(
        "Administrador de Oficina Productora (sugerido)",
        "y@cotecnova.edu.co",
      ),
    ).toBe("jefe_dependencia");
  });

  it("Gestor documental → funcionario; Consulta/otros → consulta", () => {
    expect(mapRol("Gestor documental", "z@cotecnova.edu.co")).toBe(
      "funcionario",
    );
    expect(mapRol("Consulta", "w@cotecnova.edu.co")).toBe("consulta");
  });

  it("Servicios Generales no requiere cuenta y queda como consulta", () => {
    const rol = "Sin acceso al sistema (no requiere cuenta en DocuNOVA)";
    expect(mapRol(rol, "serviciosgenerales+x@cotecnova.edu.co")).toBe(
      "consulta",
    );
    expect(requiereCuenta(rol)).toBe(false);
    expect(requiereCuenta("Gestor documental")).toBe(true);
  });
});

describe("utilidades de parseo", () => {
  it("oficinaCodeFromText extrae el código entre paréntesis", () => {
    expect(oficinaCodeFromText("Contabilidad (1251)")).toBe("1251");
    expect(
      oficinaCodeFromText(
        "Formación - Direcciones de Unidad (1311, Agronomía)",
      ),
    ).toBe("1311");
    expect(oficinaCodeFromText("")).toBeNull();
  });

  it("xToBool interpreta la marca X", () => {
    expect(xToBool("X")).toBe(true);
    expect(xToBool("")).toBe(false);
  });
});
