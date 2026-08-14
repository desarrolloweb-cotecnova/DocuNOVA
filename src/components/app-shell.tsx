"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Eye } from "lucide-react";
import {
  navItemsForRole,
  pageTitleForPath,
  type NavItem,
} from "@/lib/navigation";
import { LogoFull } from "@/components/brand/logo";
import { Topbar, type TopbarProps } from "@/components/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { SessionExpiryWatcher } from "@/components/auth/session-expiry-watcher";
import { SubmitButton } from "@/components/ui/submit-button";
import { detenerImpersonacion } from "@/app/(app)/gestion/actions";
import { cn } from "@/lib/utils";

/** Lista de navegación reutilizada por la barra lateral y el cajón móvil. */
function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        if (item.disabled) {
          return (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
              title="Disponible en una próxima fase"
            >
              <Icon className="size-4" />
              {item.label}
              <span className="ml-auto text-[10px] uppercase">pronto</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-secondary-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  impersonando,
  sesionExpiraEn,
  ...topbar
}: TopbarProps & {
  children: React.ReactNode;
  impersonando?: { nombre: string } | null;
}) {
  const pathname = usePathname();
  const navItems = navItemsForRole(topbar.role);
  const pageTitle = pageTitleForPath(pathname);
  const [navOpen, setNavOpen] = useState(false);

  // Cierra el menú móvil al navegar.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <ToastProvider>
    <SessionExpiryWatcher expiraEn={sesionExpiraEn ?? null} />
    <div className="flex min-h-full flex-1">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden w-64 flex-col border-r bg-card md:sticky md:top-0 md:flex md:h-dvh md:self-start md:overflow-y-auto">
        <div className="flex h-20 items-center border-b px-4">
          <LogoFull className="h-12" />
        </div>
        <NavLinks items={navItems} pathname={pathname} />
      </aside>

      {/* Cajón de navegación (móvil) */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/40"
            onClick={() => setNavOpen(false)}
          />
          <aside className="absolute top-0 left-0 flex h-full w-72 max-w-[82%] flex-col bg-card shadow-xl">
            <div className="flex h-20 items-center justify-between border-b px-4">
              <LogoFull className="h-11" />
              <button
                aria-label="Cerrar menú"
                onClick={() => setNavOpen(false)}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks
              items={navItems}
              pathname={pathname}
              onNavigate={() => setNavOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {impersonando && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
            <span className="flex items-center gap-1.5">
              <Eye className="size-4" />
              Estás viendo la aplicación como{" "}
              <strong>{impersonando.nombre}</strong>
            </span>
            <form action={detenerImpersonacion}>
              <SubmitButton
                textoPendiente="Volviendo…"
                className="h-auto rounded-md bg-amber-950/90 px-2.5 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-950"
              >
                Volver a mi cuenta
              </SubmitButton>
            </form>
          </div>
        )}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
          <button
            aria-label="Abrir menú"
            onClick={() => setNavOpen(true)}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            <Menu className="size-6" />
          </button>
          <LogoFull className="h-11 md:hidden" />
          {pageTitle && (
            <h1 className="truncate text-lg font-semibold md:text-2xl">
              {pageTitle}
            </h1>
          )}
          <div className="ml-auto">
            <Topbar {...topbar} sesionExpiraEn={sesionExpiraEn ?? null} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}
