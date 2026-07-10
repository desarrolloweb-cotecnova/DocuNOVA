import type { Metadata } from "next";
import { ShieldCheck, Construction } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Panel — ${APP_NAME}`,
};

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Bienvenido a {APP_NAME}</h1>
        <p className="text-muted-foreground">
          Sistema de Gestión de Documentos Electrónicos de Archivo de Cotecnova.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Sesión segura
          </CardTitle>
          <CardDescription>
            Ingresaste con tu cuenta institucional y verificación en dos pasos.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="size-5 text-muted-foreground" />
            En construcción
          </CardTitle>
          <CardDescription>
            Esta es la fundación del proyecto (Fase 0). Los módulos de Tablas de
            Retención Documental, Expedientes, Documentos y Flujos de aprobación
            se habilitarán en las próximas fases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Fase 1 — Cuadro de Clasificación / TRD</li>
            <li>Fase 2 — Repositorio y Expedientes</li>
            <li>Fase 3 — Flujos de aprobación y firma electrónica</li>
            <li>Fase 4 — Notificaciones, tablero y reportes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
