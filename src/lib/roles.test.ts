import { describe, expect, it } from "vitest";
import {
  apruebaTRD,
  creaRegistros,
  elabora,
  esLector,
  gestionaUsuarios,
  isSuperAdmin,
  roleLabel,
} from "./roles";

describe("helpers de roles", () => {
  it("isSuperAdmin solo es cierto para superadmin", () => {
    expect(isSuperAdmin("superadmin")).toBe(true);
    expect(isSuperAdmin("rector")).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("gestionaUsuarios cubre superadmin y rector", () => {
    expect(gestionaUsuarios("superadmin")).toBe(true);
    expect(gestionaUsuarios("rector")).toBe(true);
    expect(gestionaUsuarios("administrador")).toBe(false);
  });

  it("apruebaTRD cubre superadmin, rector y administrador", () => {
    expect(apruebaTRD("administrador")).toBe(true);
    expect(apruebaTRD("gestor")).toBe(false);
  });

  it("elabora incluye al gestor pero no al colaborador", () => {
    expect(elabora("gestor")).toBe(true);
    expect(elabora("colaborador")).toBe(false);
  });

  it("creaRegistros incluye al colaborador pero no a consulta", () => {
    expect(creaRegistros("colaborador")).toBe(true);
    expect(creaRegistros("consulta")).toBe(false);
  });

  it("esLector es falso para pendiente y roles desconocidos", () => {
    expect(esLector("consulta")).toBe(true);
    expect(esLector("pendiente")).toBe(false);
    expect(esLector("xxx")).toBe(false);
    expect(esLector(null)).toBe(false);
  });

  it("roleLabel traduce roles conocidos y desconocidos", () => {
    expect(roleLabel("consulta")).toBe("Consulta");
    expect(roleLabel("pendiente")).toBe("Pendiente de asignación");
    expect(roleLabel("xxx")).toBe("Sin rol asignado");
  });
});
