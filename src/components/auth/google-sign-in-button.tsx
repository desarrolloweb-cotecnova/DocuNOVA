"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";
import { Button } from "@/components/ui/button";

/**
 * Botón "Iniciar sesión con Google".
 *
 * Usa OAuth de Supabase con el parámetro `hd` para sugerir a Google que solo
 * muestre cuentas del dominio institucional. La validación estricta del dominio
 * se hace en el servidor (callback y proxy), ya que `hd` es solo una pista.
 */
export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: ALLOWED_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
      setLoading(false);
    }
    // Si no hay error, el navegador es redirigido a Google.
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        size="lg"
        className="w-full"
      >
        {loading ? "Redirigiendo…" : "Iniciar sesión con Google"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
