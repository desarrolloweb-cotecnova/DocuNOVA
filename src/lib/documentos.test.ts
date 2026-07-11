import { describe, expect, it } from "vitest";
import {
  estadoExpedienteLabel,
  tipoDocumentoLabel,
  validarFolios,
  foliosLabel,
  ubicacionFisicaLabel,
  normalizarBusqueda,
} from "./documentos";

describe("etiquetas", () => {
  it("estado de expediente", () => {
    expect(estadoExpedienteLabel("abierto")).toBe("Abierto");
    expect(estadoExpedienteLabel("xxx")).toBe("Desconocido");
  });
  it("tipo de documento", () => {
    expect(tipoDocumentoLabel("fisico")).toBe("Físico");
    expect(tipoDocumentoLabel("electronico")).toBe("Electrónico");
  });
});

describe("validarFolios", () => {
  it("acepta ambos vacíos", () => {
    expect(validarFolios(null, null)).toBeNull();
  });
  it("acepta un rango válido", () => {
    expect(validarFolios(1, 20)).toBeNull();
    expect(validarFolios(5, 5)).toBeNull();
  });
  it("rechaza final menor que inicial", () => {
    expect(validarFolios(20, 1)).toMatch(/final/i);
  });
  it("rechaza folios menores que 1", () => {
    expect(validarFolios(0, 5)).toMatch(/inicial/i);
    expect(validarFolios(1, 0)).toMatch(/final/i);
  });
});

describe("foliosLabel", () => {
  it("formatea rangos y valores sueltos", () => {
    expect(foliosLabel(1, 20)).toBe("1–20");
    expect(foliosLabel(5, 5)).toBe("5");
    expect(foliosLabel(3, null)).toBe("3");
    expect(foliosLabel(null, null)).toBe("—");
  });
});

describe("ubicacionFisicaLabel", () => {
  it("compone las partes presentes", () => {
    expect(
      ubicacionFisicaLabel({ caja: "12", estante: "A", carpeta: "3" }),
    ).toBe("Caja 12 · Estante A · Carpeta 3");
    expect(
      ubicacionFisicaLabel({ caja: null, estante: null, carpeta: null }),
    ).toBe("—");
  });
});

describe("normalizarBusqueda", () => {
  it("colapsa espacios y recorta", () => {
    expect(normalizarBusqueda("  acta   de   grado ")).toBe("acta de grado");
    expect(normalizarBusqueda(null)).toBe("");
  });
});
