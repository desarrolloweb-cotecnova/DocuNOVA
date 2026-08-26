import { describe, it, expect } from "vitest";
import { avisoDePeso, formatoTamano } from "./memoria-campos";
import { AVISO_BYTES_MEMORIA, MAX_BYTES_MEMORIA } from "@/lib/tipos";

const MB = 1024 * 1024;

describe("formatoTamano", () => {
  it("usa KB por debajo de 1 MB y MB por encima", () => {
    expect(formatoTamano(820 * 1024)).toBe("820 KB");
    expect(formatoTamano(3.4 * MB)).toBe("3,4 MB");
  });

  it("devuelve cadena vacía si no se conoce el tamaño", () => {
    expect(formatoTamano(null)).toBe("");
    expect(formatoTamano(0)).toBe("");
  });
});

describe("avisoDePeso", () => {
  it("no dice nada con archivos livianos", () => {
    expect(avisoDePeso(0)).toBeNull();
    expect(avisoDePeso(900 * 1024)).toBeNull();
    expect(avisoDePeso(AVISO_BYTES_MEMORIA)).toBeNull();
  });

  it("recomienda comprimir a partir de 5 MB, sin bloquear", () => {
    const aviso = avisoDePeso(AVISO_BYTES_MEMORIA + 1);
    expect(aviso?.tipo).toBe("recomendacion");
    expect(aviso?.mensaje).toMatch(/comprimes/);
  });

  it("avisa de que se excede el límite por encima de 25 MB", () => {
    const aviso = avisoDePeso(MAX_BYTES_MEMORIA + 1);
    expect(aviso?.tipo).toBe("excede");
    expect(aviso?.mensaje).toMatch(/supera el límite/);
  });

  it("el límite exacto todavía se puede cargar", () => {
    expect(avisoDePeso(MAX_BYTES_MEMORIA)?.tipo).toBe("recomendacion");
  });
});
