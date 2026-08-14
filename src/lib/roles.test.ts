import { describe, expect, it } from "vitest";
import {
  apruebaTRD,
  creaRegistros,
  elabora,
  esLector,
  gestionaUsuarios,
  isSuperAdmin,
  puedeVerModulo,
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

  it("puedeVerModulo aplica la visibilidad por rol", () => {
    // superadmin/rector: todos los módulos.
    expect(puedeVerModulo("superadmin", "/configuracion")).toBe(true);
    expect(puedeVerModulo("rector", "/dependencias")).toBe(true);
    // administrador: incluye Configuración (solo la pestaña de Componentes).
    expect(puedeVerModulo("administrador", "/dependencias")).toBe(true);
    expect(puedeVerModulo("administrador", "/configuracion")).toBe(true);
    // gestor: TRD, Documentos, Registros, Consulta (no Dependencias ni
    // Configuración).
    expect(puedeVerModulo("gestor", "/trd")).toBe(true);
    expect(puedeVerModulo("gestor", "/dependencias")).toBe(false);
    expect(puedeVerModulo("gestor", "/configuracion")).toBe(false);
    // colaborador: Registros y Consulta.
    expect(puedeVerModulo("colaborador", "/registros")).toBe(true);
    expect(puedeVerModulo("colaborador", "/trd")).toBe(false);
    // consulta: solo Consulta.
    expect(puedeVerModulo("consulta", "/consulta")).toBe(true);
    expect(puedeVerModulo("consulta", "/registros")).toBe(false);
    expect(puedeVerModulo("consulta", "/configuracion")).toBe(false);
    // cubre subrutas y bloquea a pendiente/desconocidos.
    expect(puedeVerModulo("gestor", "/documentos/plantilla")).toBe(true);
    expect(puedeVerModulo("pendiente", "/consulta")).toBe(false);
    expect(puedeVerModulo(null, "/consulta")).toBe(false);
  });

  it("Memoria Corporativa es visible para todo rol activo, no para pendiente", () => {
    for (const rol of [
      "superadmin",
      "rector",
      "administrador",
      "gestor",
      "colaborador",
      "consulta",
    ]) {
      expect(puedeVerModulo(rol, "/memoria")).toBe(true);
    }
    expect(puedeVerModulo("pendiente", "/memoria")).toBe(false);
    expect(puedeVerModulo(null, "/memoria")).toBe(false);
  });
});
