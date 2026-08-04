import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LogoFull } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ALLOWED_EMAIL_DOMAIN, APP_NAME } from "@/lib/config";
import {
  SESSION_EXPIRED_REASON,
  SESSION_MAX_HOURS,
} from "@/lib/auth/session-policy";

export const metadata: Metadata = {
  title: `Ingresar — ${APP_NAME}`,
};

const ERROR_MESSAGES: Record<string, string> = {
  domain: `Solo se permite el acceso con cuentas @${ALLOWED_EMAIL_DOMAIN}. Cerramos tu sesión por seguridad.`,
  auth: "No pudimos completar el inicio de sesión. Inténtalo de nuevo.",
  [SESSION_EXPIRED_REASON]: `Tu sesión caducó. Por seguridad dura como máximo ${SESSION_MAX_HOURS} horas, así que hay que iniciar sesión de nuevo cada día.`,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <LogoFull className="mb-2 h-24" />
          <CardDescription>
            Sistema de gestión de documentos electrónicos de archivo Cotecnova.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage ? (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
          <GoogleSignInButton />
          <p className="text-center text-xs text-muted-foreground">
            El acceso está restringido a correos @{ALLOWED_EMAIL_DOMAIN} y
            requiere verificación en dos pasos.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
