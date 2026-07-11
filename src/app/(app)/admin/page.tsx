import type { Metadata } from "next";
import Link from "next/link";
import { Users, Network } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Administración — ${APP_NAME}`,
};

const SECCIONES = [
  {
    href: "/admin/usuarios",
    icon: Users,
    titulo: "Usuarios",
    descripcion:
      "Activar cuentas pendientes y asignar rol, proceso y oficina productora.",
  },
  {
    href: "/admin/estructura",
    icon: Network,
    titulo: "Estructura organizacional",
    descripcion:
      "Ejes, macroprocesos, procesos y oficinas productoras de la institución.",
  },
];

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Administración</h1>
        <p className="text-muted-foreground">
          Configuración institucional de DocuNOVA.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECCIONES.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle>{s.titulo}</CardTitle>
                  <CardDescription>{s.descripcion}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
