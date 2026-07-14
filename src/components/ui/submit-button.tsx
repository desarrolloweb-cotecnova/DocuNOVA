"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Botón de envío para formularios con server actions. Muestra un estado
 * "ejecutando…" (spinner + deshabilitado) mientras la acción corre, un aviso de
 * éxito al terminar (prop `exito`) y, si se indica `confirmar`, pide confirmación
 * antes de enviar (para acciones destructivas). Usa `useFormStatus`, así que debe
 * estar dentro del <form action={...}>.
 */
type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  /** Mensaje de éxito que se muestra al completar la acción. */
  exito?: string;
  /** Si se define, pide confirmación (texto del diálogo) antes de enviar. */
  confirmar?: string;
  /** Texto mientras la acción está en curso (por defecto conserva los hijos). */
  textoPendiente?: string;
};

export function SubmitButton({
  children,
  exito,
  confirmar,
  textoPendiente,
  disabled,
  onClick,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const { mostrar } = useToast();
  const eraPendiente = useRef(false);

  useEffect(() => {
    // Transición pendiente → completado: la acción terminó.
    if (eraPendiente.current && !pending && exito) {
      mostrar(exito, "exito");
    }
    eraPendiente.current = pending;
  }, [pending, exito, mostrar]);

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && textoPendiente ? textoPendiente : children}
    </Button>
  );
}

/**
 * Botón de acción sin estilo de "Button" (para íconos, p. ej. eliminar). Mismas
 * capacidades: estado pendiente, confirmación y aviso de éxito.
 */
export function SubmitIcon({
  children,
  exito,
  confirmar,
  className,
  disabled,
  onClick,
  ...props
}: React.ComponentProps<"button"> & {
  exito?: string;
  confirmar?: string;
}) {
  const { pending } = useFormStatus();
  const { mostrar } = useToast();
  const eraPendiente = useRef(false);

  useEffect(() => {
    if (eraPendiente.current && !pending && exito) {
      mostrar(exito, "exito");
    }
    eraPendiente.current = pending;
  }, [pending, exito, mostrar]);

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cn(pending && "pointer-events-none opacity-60", className)}
      {...props}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}
