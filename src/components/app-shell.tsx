"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { navItemsForRole } from "@/lib/navigation";
import { roleLabel } from "@/lib/roles";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export function AppShell({
  email,
  fullName,
  role,
  children,
}: {
  email: string;
  fullName: string | null;
  role: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navItems = navItemsForRole(role);

  return (
    <div className="flex min-h-full flex-1">
      {/* Barra lateral */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-semibold">{APP_NAME}</span>
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
                    ? "bg-primary text-primary-foreground"
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
          <span className="font-semibold md:hidden">{APP_NAME}</span>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{fullName ?? email}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(role)}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="size-4" />
                Salir
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
