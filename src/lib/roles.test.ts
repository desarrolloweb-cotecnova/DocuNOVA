import { describe, expect, it } from "vitest";
import { isArchivoAdmin, isSuperAdmin, roleLabel } from "./roles";

describe("helpers de roles", () => {
  it("isSuperAdmin solo es cierto para super_admin", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isSuperAdmin("admin_archivo")).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("isArchivoAdmin cubre super_admin y admin_archivo", () => {
    expect(isArchivoAdmin("super_admin")).toBe(true);
    expect(isArchivoAdmin("admin_archivo")).toBe(true);
    expect(isArchivoAdmin("funcionario")).toBe(false);
  });

  it("roleLabel traduce roles conocidos y desconocidos", () => {
    expect(roleLabel("consulta")).toBe("Consulta");
    expect(roleLabel("xxx")).toBe("Sin rol asignado");
  });
});
