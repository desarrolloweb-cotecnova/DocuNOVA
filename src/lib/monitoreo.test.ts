import { describe, expect, it } from "vitest";
import {
  DIAS_PAUSA_PLAN_FREE,
  LIMITES_PLAN_FREE,
  estadoKeepalive,
  formatearBytes,
  hace,
  nivelAlerta,
  porcentaje,
  resumenAlertas,
  type Metricas,
} from "./monitoreo";

const AHORA = new Date("2026-08-14T12:00:00Z").getTime();
const DIA = 86_400_000;

function metricas(parcial: Partial<Metricas> = {}): Metricas {
  return {
    timestamp: new Date(AHORA).toISOString(),
    database: { total_size_bytes: 1024, total_size_pretty: "1 kB" },
    tables: [],
    connections: { active: 1, idle: 2, total: 3 },
    auth: { total_users: 10, confirmed_users: 9, unconfirmed_users: 1 },
    storage: {
      total_files: 0,
      total_size_bytes: 0,
      total_size_pretty: "0 bytes",
      buckets: [],
    },
    keepalive: { ultimo_latido: null, origen: "inicial", total_latidos: 0 },
    ...parcial,
  };
}

describe("porcentaje", () => {
  it("acota el resultado a 100 y protege límites inválidos", () => {
    expect(porcentaje(50, 200)).toBe(25);
    expect(porcentaje(500, 200)).toBe(100);
    expect(porcentaje(10, 0)).toBe(0);
  });
});

describe("nivelAlerta", () => {
  it("marca los umbrales del 70 % y del 90 %", () => {
    expect(nivelAlerta(10)).toBe("ok");
    expect(nivelAlerta(70)).toBe("atencion");
    expect(nivelAlerta(89.9)).toBe("atencion");
    expect(nivelAlerta(90)).toBe("critico");
  });
});

describe("formatearBytes", () => {
  it("elige la unidad adecuada", () => {
    expect(formatearBytes(0)).toBe("0 B");
    expect(formatearBytes(512)).toBe("512 B");
    expect(formatearBytes(1024)).toBe("1 KB");
    expect(formatearBytes(LIMITES_PLAN_FREE.db_bytes)).toBe("500 MB");
    expect(formatearBytes(LIMITES_PLAN_FREE.storage_bytes)).toBe("1 GB");
  });
});

describe("hace", () => {
  it("usa segundos, minutos, horas y días", () => {
    expect(hace(new Date(AHORA - 30_000).toISOString(), AHORA)).toBe(
      "hace 30 s",
    );
    expect(hace(new Date(AHORA - 5 * 60_000).toISOString(), AHORA)).toBe(
      "hace 5 min",
    );
    expect(hace(new Date(AHORA - 3 * 3_600_000).toISOString(), AHORA)).toBe(
      "hace 3 h",
    );
    expect(hace(new Date(AHORA - DIA).toISOString(), AHORA)).toBe("hace 1 día");
    expect(hace(new Date(AHORA - 4 * DIA).toISOString(), AHORA)).toBe(
      "hace 4 días",
    );
  });
});

describe("estadoKeepalive", () => {
  it("es crítico si nunca ha latido", () => {
    expect(estadoKeepalive(null, AHORA)).toEqual({
      diasSinLatido: null,
      nivel: "critico",
    });
  });

  it("es normal dentro del ritmo previsto de latidos", () => {
    const r = estadoKeepalive(new Date(AHORA - 2 * DIA).toISOString(), AHORA);
    expect(r).toEqual({ diasSinLatido: 2, nivel: "ok" });
  });

  it("avisa al pasarse del ritmo y es crítico al acercarse a la pausa", () => {
    expect(
      estadoKeepalive(new Date(AHORA - 4 * DIA).toISOString(), AHORA).nivel,
    ).toBe("atencion");
    const critico = estadoKeepalive(
      new Date(AHORA - (DIAS_PAUSA_PLAN_FREE - 1) * DIA).toISOString(),
      AHORA,
    );
    expect(critico.nivel).toBe("critico");
  });
});

describe("resumenAlertas", () => {
  it("informa normalidad con uso bajo", () => {
    expect(resumenAlertas(metricas()).nivel).toBe("ok");
  });

  it("escala a atención y a crítico según la métrica peor situada", () => {
    const atencion = resumenAlertas(
      metricas({
        database: {
          total_size_bytes: LIMITES_PLAN_FREE.db_bytes * 0.75,
          total_size_pretty: "375 MB",
        },
      }),
    );
    expect(atencion.nivel).toBe("atencion");

    const critico = resumenAlertas(
      metricas({
        database: {
          total_size_bytes: LIMITES_PLAN_FREE.db_bytes * 0.95,
          total_size_pretty: "475 MB",
        },
        connections: { active: 55, idle: 5, total: 60 },
      }),
    );
    expect(critico.nivel).toBe("critico");
    expect(critico.mensaje).toContain("2 métricas");
  });
});
