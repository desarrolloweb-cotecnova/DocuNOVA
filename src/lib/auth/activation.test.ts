import { describe, expect, it } from "vitest";
import { activationRedirect } from "./activation";

describe("activationRedirect", () => {
  it("envía a /pendiente cuando el perfil aún no existe", () => {
    expect(activationRedirect(null)).toBe("/pendiente");
  });

  it("envía a /pendiente cuando la cuenta está inactiva", () => {
    expect(activationRedirect({ activo: false })).toBe("/pendiente");
  });

  it("permite el acceso (null) cuando la cuenta está activa", () => {
    expect(activationRedirect({ activo: true })).toBeNull();
  });
});
