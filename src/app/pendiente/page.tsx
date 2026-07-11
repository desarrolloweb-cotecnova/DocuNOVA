import type { Metadata } from "next";
import { LogOut, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Cuenta pendiente — ${APP_NAME}`,
};

/**
 * Pantalla para cuentas autenticadas pero aún NO activadas por el super
 * administrador (flujo de autorregistro con aprobación manual).
 */
export default function PendientePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-secondary/15 text-secondary">
            <Clock className="size-6" />
          </div>
          <CardTitle className="text-xl">Tu cuenta está pendiente</CardTitle>
          <CardDescription>
            Tu cuenta institucional se registró correctamente, pero todavía debe
            ser aprobada por el administrador antes de que puedas acceder a
            DocuNOVA.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
            El administrador (
            <span className="font-medium">desarrolloweb@cotecnova.edu.co</span>)
            revisará tu registro y te asignará un rol y un proceso. Cuando tu
            cuenta esté activa podrás iniciar sesión con normalidad.
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
