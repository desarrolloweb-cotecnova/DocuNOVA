import { describe, expect, it } from "vitest";
import {
  SESSION_MAX_HOURS,
  SESSION_MAX_MS,
  getSessionExpiry,
  getSessionTimeLeft,
  isSessionExpired,
} from "./session-policy";

const AHORA = Date.parse("2026-03-10T15:00:00.000Z");
const hace = (horas: number) =>
  new Date(AHORA - horas * 3_600_000).toISOString();

describe("política de sesión", () => {
  it("mantiene viva una sesión recién iniciada", () => {
    expect(isSessionExpired({ last_sign_in_at: hace(0) }, AHORA)).toBe(false);
  });

  it("no expulsa dentro de la ventana de 8 horas", () => {
    expect(SESSION_MAX_HOURS).toBe(8);
    expect(isSessionExpired({ last_sign_in_at: hace(7.9) }, AHORA)).toBe(false);
  });

  it("caduca al cumplirse la ventana", () => {
    expect(isSessionExpired({ last_sign_in_at: hace(8) }, AHORA)).toBe(true);
  });

  it("caduca una sesión arrastrada del día anterior", () => {
    expect(isSessionExpired({ last_sign_in_at: hace(26) }, AHORA)).toBe(true);
  });

  it("calcula el momento de caducidad y el tiempo restante", () => {
    const user = { last_sign_in_at: hace(2) };
    expect(getSessionExpiry(user)).toBe(AHORA - 2 * 3_600_000 + SESSION_MAX_MS);
    expect(getSessionTimeLeft(user, AHORA)).toBe(6 * 3_600_000);
  });

  it("sin ancla temporal no expulsa: evitaría un bucle de login", () => {
    expect(isSessionExpired({ last_sign_in_at: null }, AHORA)).toBe(false);
    expect(isSessionExpired({}, AHORA)).toBe(false);
    expect(isSessionExpired({ last_sign_in_at: "no-es-fecha" }, AHORA)).toBe(
      false,
    );
    expect(getSessionExpiry({ last_sign_in_at: null })).toBeNull();
    expect(getSessionTimeLeft({ last_sign_in_at: null }, AHORA)).toBeNull();
  });
});
