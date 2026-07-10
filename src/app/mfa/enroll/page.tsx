"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Enrolamiento del segundo factor (TOTP) con Google Authenticator.
 * Muestra un código QR; el usuario lo escanea y confirma un código de 6 dígitos.
 */
export default function EnrollMfaPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const supabase = createClient();

      // Si ya está en aal2, no hace falta enrolar de nuevo.
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        window.location.assign("/dashboard");
        return;
      }

      // Limpia factores TOTP previos sin verificar para evitar duplicados.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const stale =
        factors?.all?.filter(
          (f) => f.factor_type === "totp" && f.status !== "verified",
        ) ?? [];
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      // Si ya existe un TOTP verificado, ir a la verificación.
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        window.location.assign("/mfa/verify");
        return;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "DocuNOVA",
      });

      if (cancelled) return;

      if (error || !data) {
        setError("No se pudo generar el código QR. Recarga la página.");
        setStatus("error");
        return;
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStatus("ready");
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setVerifying(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (error) {
      setError("Código incorrecto o expirado. Inténtalo de nuevo.");
      setVerifying(false);
      return;
    }

    // Sesión elevada a aal2: recarga completa para que el servidor lo detecte.
    window.location.assign("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configura la verificación en dos pasos</CardTitle>
          <CardDescription>
            Escanea el código con Google Authenticator (o una app compatible) y
            escribe el código de 6 dígitos para confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status === "loading" ? (
            <p className="text-sm text-muted-foreground">Generando código…</p>
          ) : null}

          {status === "error" ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {status === "ready" && qrCode ? (
            <>
              <div className="flex justify-center rounded-md border bg-white p-4">
                {/* qr_code es un SVG en formato data URI devuelto por Supabase */}
                <Image
                  src={qrCode}
                  alt="Código QR para configurar la verificación en dos pasos"
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>
              {secret ? (
                <p className="text-center text-xs text-muted-foreground">
                  ¿No puedes escanear? Ingresa esta clave manualmente:
                  <br />
                  <code className="break-all text-foreground">{secret}</code>
                </p>
              ) : null}

              <form onSubmit={handleVerify} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Código de verificación</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={verifying || code.length !== 6}>
                  {verifying ? "Verificando…" : "Activar y continuar"}
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
