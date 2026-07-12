"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemsForRole } from "@/lib/navigation";
import { LogoFull } from "@/components/brand/logo";
import { Topbar, type TopbarProps } from "@/components/topbar";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  ...topbar
}: TopbarProps & { children: React.ReactNode }) {
  const pathname = usePathname();
  const navItems = navItemsForRole(topbar.role);

  return (
    <div className="flex min-h-full flex-1">
      {/* Barra lateral */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-20 items-center border-b px-4">
          <LogoFull className="h-12" />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
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
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
          <LogoFull className="h-8 md:hidden" />
          <div className="ml-auto">
            <Topbar {...topbar} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
