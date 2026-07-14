"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sistema de avisos (toasts) en pantalla. Un `ToastProvider` envuelve la app y
 * expone `useToast().mostrar(mensaje)` para confirmar visualmente que una acción
 * se ejecutó. Los botones de acción (SubmitButton) lo usan automáticamente.
 */

type TipoToast = "exito" | "error";
type Toast = { id: number; mensaje: string; tipo: TipoToast };

type ToastCtx = { mostrar: (mensaje: string, tipo?: TipoToast) => void };

const Ctx = createContext<ToastCtx | null>(null);

/** Devuelve el disparador de toasts. Es seguro fuera del provider (no hace nada). */
export function useToast(): ToastCtx {
  return useContext(Ctx) ?? { mostrar: () => {} };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const quitar = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const mostrar = useCallback(
    (mensaje: string, tipo: TipoToast = "exito") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, mensaje, tipo }]);
      setTimeout(() => quitar(id), 3800);
    },
    [quitar],
  );

  return (
    <Ctx.Provider value={{ mostrar }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-md border p-3 text-sm shadow-lg",
              t.tipo === "exito"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {t.tipo === "exito" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 font-medium">{t.mensaje}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => quitar(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
