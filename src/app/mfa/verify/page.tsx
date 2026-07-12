"use client";

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
import { AuthenticatorApps } from "@/components/mfa/authenticator-apps";

/**
 * Verificación del segundo factor (TOTP) para usuarios que ya lo tienen
 * configurado. Eleva la sesión de aal1 a aal2.
 */
export default function VerifyMfaPage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();

      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        window.location.assign("/dashboard");
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");

      if (cancelled) return;

      if (!verified) {
        // No hay factor configurado todavía: ir a enrolar.
        window.location.assign("/mfa/enroll");
        return;
      }

      setFactorId(verified.id);
      setStatus("ready");
    }

    void init();
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

    window.location.assign("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verificación en dos pasos</CardTitle>
          <CardDescription>
            Escribe el código de 6 dígitos que aparece en tu app{" "}
            <span className="font-medium">Google Authenticator</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status === "loading" ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : null}

          {status === "ready" ? (
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
                  autoFocus
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={verifying || code.length !== 6}>
                {verifying ? "Verificando…" : "Verificar"}
              </Button>
            </form>
          ) : null}

          <AuthenticatorApps compact />
        </CardContent>
      </Card>
    </main>
  );
}
