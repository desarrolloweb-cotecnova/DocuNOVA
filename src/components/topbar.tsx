"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, HelpCircle, LogOut, User, ShieldCheck } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import { ayudaParaRuta } from "@/lib/help";
import { notificacionHref } from "@/lib/notificaciones";
import type { Notificacion } from "@/lib/tipos";
import { TIPO_NOTIFICACION_LABELS, labelDe } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { SessionExpiryNotice } from "@/components/auth/session-expiry-notice";

export type TopbarProps = {
  email: string;
  fullName: string | null;
  role: string | null;
  unidadNombre: string | null;
  oficinaLabel: string | null;
  avatarUrl: string | null;
  notificaciones: Notificacion[];
  noLeidas: number;
  /** Momento (epoch ms) en que caduca la sesión; ver lib/auth/session-policy. */
  sesionExpiraEn?: number | null;
};

type Menu = "ayuda" | "notifs" | "perfil" | null;

export function Topbar(props: TopbarProps) {
  const [menu, setMenu] = useState<Menu>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const ayuda = ayudaParaRuta(pathname);
  const nombre = props.fullName ?? props.email;

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  // Cierra el menú al navegar a otra ruta.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenu(null), [pathname]);

  const toggle = (m: Menu) => setMenu((prev) => (prev === m ? null : m));

  return (
    <div ref={ref} className="flex items-center gap-1">
      {/* Ayuda */}
      <div className="relative">
        <IconButton
          label="Ayuda de esta página"
          active={menu === "ayuda"}
          onClick={() => toggle("ayuda")}
        >
          <HelpCircle className="size-5" />
        </IconButton>
        {menu === "ayuda" && (
          <Panel className="w-80">
            <div className="p-4">
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <HelpCircle className="size-4 text-secondary" />
                {ayuda.titulo}
              </p>
              <p className="text-sm text-muted-foreground">{ayuda.texto}</p>
            </div>
          </Panel>
        )}
      </div>

      {/* Notificaciones */}
      <div className="relative">
        <IconButton
          label="Notificaciones"
          active={menu === "notifs"}
          onClick={() => toggle("notifs")}
        >
          <Bell className="size-5" />
          {props.noLeidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
              {props.noLeidas > 9 ? "9+" : props.noLeidas}
            </span>
          )}
        </IconButton>
        {menu === "notifs" && (
          <Panel className="w-80">
            <div className="border-b px-4 py-2 text-sm font-semibold">
              Notificaciones
            </div>
            {props.notificaciones.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No tienes notificaciones.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {props.notificaciones.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={notificacionHref(n)}
                      className={cn(
                        "block border-b px-4 py-3 text-sm hover:bg-accent",
                        !n.leida && "bg-secondary/5",
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {!n.leida && (
                          <span className="size-2 shrink-0 rounded-full bg-secondary" />
                        )}
                        {n.asunto}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {labelDe(TIPO_NOTIFICACION_LABELS, n.tipo)} ·{" "}
                        {new Date(n.creado_en).toLocaleDateString("es-CO")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/notificaciones"
              className="block px-4 py-2 text-center text-sm font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          </Panel>
        )}
      </div>

      {/* Perfil */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggle("perfil")}
          className={cn(
            "flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-accent",
            menu === "perfil" && "bg-accent",
          )}
        >
          <Avatar url={props.avatarUrl} nombre={nombre} />
          <span className="hidden text-sm font-medium sm:block">{nombre}</span>
        </button>
        {menu === "perfil" && (
          <Panel className="w-72">
            <div className="flex items-start gap-3 p-4">
              <Avatar url={props.avatarUrl} nombre={nombre} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {props.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 px-4 pb-3">
              <Chip tone="orange">{roleLabel(props.role)}</Chip>
              {props.unidadNombre && (
                <Chip tone="green">{props.unidadNombre}</Chip>
              )}
              {props.oficinaLabel && (
                <Chip tone="gray">{props.oficinaLabel}</Chip>
              )}
            </div>
            <SessionExpiryNotice
              expiraEn={props.sesionExpiraEn ?? null}
              className="px-4 pb-3"
            />
            <div className="border-t">
              <Link
                href="/perfil"
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
              >
                <User className="size-4 text-muted-foreground" />
                Mi perfil
              </Link>
              <Link
                href="/mfa/enroll"
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
              >
                <ShieldCheck className="size-4 text-muted-foreground" />
                Verificación en dos pasos
              </Link>
            </div>
            <div className="border-t">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute top-full right-0 z-50 mt-2 overflow-hidden rounded-xl border bg-card shadow-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Avatar({
  url,
  nombre,
  size = "md",
}: {
  url: string | null;
  nombre: string;
  size?: "md" | "lg";
}) {
  const cls = size === "lg" ? "size-11" : "size-8";
  const iniciales = nombre
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={nombre}
        referrerPolicy="no-referrer"
        className={cn(cls, "shrink-0 rounded-full object-cover")}
      />
    );
  }
  return (
    <div
      className={cn(
        cls,
        "flex shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground",
      )}
    >
      {iniciales}
    </div>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "orange" | "green" | "gray";
}) {
  const tones = {
    orange: "bg-secondary/15 text-secondary",
    green: "bg-primary/10 text-primary",
    gray: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
