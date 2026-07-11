import { describe, expect, it } from "vitest";
import {
  retencionAMeses,
  vencimientoGestion,
  estadoVencimiento,
} from "./retencion";

describe("retencionAMeses", () => {
  it("interpreta años y meses", () => {
    expect(retencionAMeses("5 años")).toBe(60);
    expect(retencionAMeses("6 meses")).toBe(6);
    expect(retencionAMeses("2 años 6 meses")).toBe(30);
  });
  it("devuelve null para permanente o vacío", () => {
    expect(retencionAMeses("Permanente")).toBeNull();
    expect(retencionAMeses("")).toBeNull();
    expect(retencionAMeses(null)).toBeNull();
    expect(retencionAMeses("Conservación total")).toBeNull();
  });
});

describe("vencimientoGestion", () => {
  it("suma la retención a la fecha de apertura", () => {
    const v = vencimientoGestion("2020-01-15", "5 años");
    expect(v?.getFullYear()).toBe(2025);
    expect(v?.getMonth()).toBe(0); // enero
  });
  it("null si falta fecha o plazo", () => {
    expect(vencimientoGestion(null, "5 años")).toBeNull();
    expect(vencimientoGestion("2020-01-15", "Permanente")).toBeNull();
  });
});

describe("estadoVencimiento", () => {
  const hoy = new Date("2026-07-11T00:00:00");
  it("detecta vencidos, próximos y vigentes", () => {
    expect(estadoVencimiento(new Date("2026-01-01"), hoy)).toBe("vencido");
    expect(estadoVencimiento(new Date("2026-09-01"), hoy)).toBe("proximo");
    expect(estadoVencimiento(new Date("2030-01-01"), hoy)).toBe("vigente");
    expect(estadoVencimiento(null, hoy)).toBe("sin_dato");
  });
});
