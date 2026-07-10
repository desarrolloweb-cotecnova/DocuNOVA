import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./domain";

const DOMAIN = "cotecnova.edu.co";

describe("isAllowedEmail", () => {
  it("acepta correos del dominio institucional", () => {
    expect(isAllowedEmail("heynar@cotecnova.edu.co", DOMAIN)).toBe(true);
  });

  it("es insensible a mayúsculas/minúsculas", () => {
    expect(isAllowedEmail("Heynar@Cotecnova.EDU.co", DOMAIN)).toBe(true);
  });

  it("rechaza correos de otros dominios", () => {
    expect(isAllowedEmail("usuario@gmail.com", DOMAIN)).toBe(false);
  });

  it("rechaza dominios que solo contienen el permitido como substring", () => {
    expect(isAllowedEmail("a@evil-cotecnova.edu.co", DOMAIN)).toBe(false);
    expect(isAllowedEmail("a@cotecnova.edu.co.attacker.com", DOMAIN)).toBe(
      false,
    );
  });

  it("rechaza valores vacíos o malformados", () => {
    expect(isAllowedEmail("", DOMAIN)).toBe(false);
    expect(isAllowedEmail(null, DOMAIN)).toBe(false);
    expect(isAllowedEmail(undefined, DOMAIN)).toBe(false);
    expect(isAllowedEmail("sinarroba.com", DOMAIN)).toBe(false);
    expect(isAllowedEmail("@cotecnova.edu.co", DOMAIN)).toBe(false);
    expect(isAllowedEmail("a@b@cotecnova.edu.co", DOMAIN)).toBe(false);
  });
});
