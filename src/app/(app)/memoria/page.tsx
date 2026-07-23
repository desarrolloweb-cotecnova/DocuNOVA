import type { Metadata } from "next";
import {
  FileText,
  Download,
  Trash2,
  Lock,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD, elabora } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listMemoria, type MemoriaDocumentoListado } from "@/services/memoria";
import {
  CATEGORIAS_MEMORIA,
  CATEGORIA_MEMORIA_LABELS,
  CATEGORIA_MEMORIA_DESC,
  ESTADO_MEMORIA_LABELS,
  labelDe,
  type CategoriaMemoria,
  type EstadoMemoria,
} from "@/lib/tipos";
import { Tabs } from "@/components/tabs";
import { MemoriaUploader } from "@/components/memoria-uploader";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton, SubmitIcon } from "@/components/ui/submit-button";
import { publicarDocumento, rechazarDocumento, eliminarDocumento } from "./actions";

export const metadata: Metadata = {
  title: `Memoria Corporativa — ${APP_NAME}`,
};

const ESTADO_COLOR: Record<EstadoMemoria, string> = {
  pendiente: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  publicado: "bg-primary/10 text-primary",
  rechazado: "bg-destructive/10 text-destructive",
};

const ESTADO_ICON: Record<EstadoMemoria, typeof Clock> = {
  pendiente: Clock,
  publicado: CheckCircle2,
  rechazado: XCircle,
};

function formatoTamano(bytes: number | null): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function ListaDocumentos({
  documentos,
  puedeAprobar,
}: {
  documentos: MemoriaDocumentoListado[];
  puedeAprobar: boolean;
}) {
  if (documentos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay documentos en esta categoría.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {documentos.map((d) => {
        const EstadoIcon = ESTADO_ICON[d.estado];
        return (
          <li key={d.id} className="flex flex-wrap items-start gap-3 py-3">
            <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{d.titulo}</p>
              {d.descripcion && (
                <p className="text-sm text-muted-foreground">{d.descripcion}</p>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="uppercase">{d.archivo_tipo}</span>
                {d.archivo_tamano ? (
                  <span>· {formatoTamano(d.archivo_tamano)}</span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  ·{" "}
                  {d.visibilidad === "privado" ? (
                    <>
                      <Lock className="size-3" /> Privado
                    </>
                  ) : (
                    <>
                      <Globe className="size-3" /> Público
                    </>
                  )}
                </span>
                {d.cargador_nombre && <span>· {d.cargador_nombre}</span>}
                <span>· {new Date(d.creado_en).toLocaleDateString("es-CO")}</span>
              </p>
              {d.estado === "rechazado" && d.comentario_revision && (
                <p className="mt-1 text-xs text-destructive">
                  Motivo: {d.comentario_revision}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[d.estado]}`}
              >
                <EstadoIcon className="size-3" />
                {labelDe(ESTADO_MEMORIA_LABELS, d.estado)}
              </span>

              <div className="flex items-center gap-2">
                <a
                  href={`/memoria/descargar/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <Download className="size-3.5" />
                  Descargar
                </a>

                {puedeAprobar && d.estado !== "publicado" && (
                  <form action={publicarDocumento}>
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton
                      size="sm"
                      textoPendiente="Publicando…"
                      exito="Documento publicado."
                    >
                      Publicar
                    </SubmitButton>
                  </form>
                )}

                {puedeAprobar && d.estado === "pendiente" && (
                  <form action={rechazarDocumento}>
                    <input type="hidden" name="id" value={d.id} />
                    <SubmitButton
                      size="sm"
                      variant="destructive"
                      textoPendiente="Rechazando…"
                      confirmar="¿Rechazar este documento?"
                      exito="Documento rechazado."
                    >
                      Rechazar
                    </SubmitButton>
                  </form>
                )}

                <form action={eliminarDocumento}>
                  <input type="hidden" name="id" value={d.id} />
                  <SubmitIcon
                    aria-label="Eliminar documento"
                    confirmar={`¿Eliminar "${d.titulo}"? Esta acción no se puede deshacer.`}
                    exito="Documento eliminado."
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </SubmitIcon>
                </form>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function MemoriaPage() {
  const [rol, documentos] = await Promise.all([
    rolDelUsuario(),
    listMemoria(),
  ]);
  const puedeCargar = elabora(rol);
  const puedeAprobar = apruebaTRD(rol);

  const porCategoria = (categoria: CategoriaMemoria) =>
    documentos.filter((d) => d.categoria === categoria);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Tabs
        tabs={CATEGORIAS_MEMORIA.map((categoria) => ({
          id: categoria,
          label: CATEGORIA_MEMORIA_LABELS[categoria],
          content: (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-muted-foreground">
                {CATEGORIA_MEMORIA_DESC[categoria]}
              </p>

              {puedeCargar && <MemoriaUploader categoria={categoria} />}

              <Card>
                <CardContent>
                  <ListaDocumentos
                    documentos={porCategoria(categoria)}
                    puedeAprobar={puedeAprobar}
                  />
                </CardContent>
              </Card>
            </div>
          ),
        }))}
      />
    </div>
  );
}
