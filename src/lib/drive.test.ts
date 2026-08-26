import { describe, it, expect, afterEach } from "vitest";
import { driveConfigurado, carpetaDrive, verificarDrive } from "./drive";

const VARS = [
  "GOOGLE_DRIVE_CLIENT_EMAIL",
  "GOOGLE_DRIVE_PRIVATE_KEY",
  "GOOGLE_DRIVE_FOLDER_ID",
] as const;

function limpiar() {
  for (const v of VARS) delete process.env[v];
}

function configurar() {
  process.env.GOOGLE_DRIVE_CLIENT_EMAIL =
    "bot@proyecto.iam.gserviceaccount.com";
  process.env.GOOGLE_DRIVE_PRIVATE_KEY =
    "-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----";
  process.env.GOOGLE_DRIVE_FOLDER_ID = "carpeta-123";
}

afterEach(limpiar);

describe("configuración de Google Drive", () => {
  it("no está configurado si falta alguna variable", () => {
    limpiar();
    expect(driveConfigurado()).toBe(false);

    configurar();
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    expect(driveConfigurado()).toBe(false);
  });

  it("está configurado con las tres variables", () => {
    configurar();
    expect(driveConfigurado()).toBe(true);
    expect(carpetaDrive()).toBe("carpeta-123");
  });

  it("carpetaDrive lanza un error claro si falta la configuración", () => {
    limpiar();
    expect(() => carpetaDrive()).toThrow(/no está configurado/);
  });

  it("el diagnóstico avisa cuando Drive no está vinculado", async () => {
    limpiar();
    const r = await verificarDrive();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/Supabase Storage/);
  });
});
