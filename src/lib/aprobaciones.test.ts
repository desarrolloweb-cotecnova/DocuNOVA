import { describe, expect, it } from "vitest";
import {
  estadoSolicitudLabel,
  estadoPasoLabel,
  canonicalDocumento,
  esPasoActual,
} from "./aprobaciones";

describe("etiquetas de aprobación", () => {
  it("estado de solicitud", () => {
    expect(estadoSolicitudLabel("en_curso")).toBe("En curso");
    expect(estadoSolicitudLabel("aprobado")).toBe("Aprobado");
    expect(estadoSolicitudLabel("xxx")).toBe("Desconocido");
  });
  it("estado de paso", () => {
    expect(estadoPasoLabel("pendiente")).toBe("Pendiente");
    expect(estadoPasoLabel("rechazado")).toBe("Rechazado");
  });
});

describe("canonicalDocumento", () => {
  const doc = {
    id: "abc",
    titulo: "Acta",
    tipo: "electronico",
    fecha_documento: "2026-07-01",
    contenido: "cuerpo",
  };

  it("es estable ante la misma entrada", () => {
    expect(canonicalDocumento(doc)).toBe(canonicalDocumento({ ...doc }));
  });

  it("cambia si cambia el contenido (invalida el hash)", () => {
    expect(canonicalDocumento(doc)).not.toBe(
      canonicalDocumento({ ...doc, contenido: "otro" }),
    );
  });

  it("tolera campos nulos", () => {
    expect(() =>
      canonicalDocumento({
        id: "x",
        titulo: "t",
        tipo: "fisico",
        fecha_documento: null,
        contenido: null,
      }),
    ).not.toThrow();
  });
});

describe("esPasoActual", () => {
  const solicitud = { estado: "en_curso" as const, paso_actual: 2 };

  it("es cierto solo para el paso pendiente en turno", () => {
    expect(esPasoActual({ orden: 2, estado: "pendiente" }, solicitud)).toBe(
      true,
    );
  });
  it("es falso si no es el turno", () => {
    expect(esPasoActual({ orden: 1, estado: "pendiente" }, solicitud)).toBe(
      false,
    );
  });
  it("es falso si la solicitud no está en curso", () => {
    expect(
      esPasoActual(
        { orden: 2, estado: "pendiente" },
        { estado: "aprobado", paso_actual: 2 },
      ),
    ).toBe(false);
  });
});
