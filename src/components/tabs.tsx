"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type Tab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

/**
 * Pestañas simples. El contenido de cada pestaña son nodos renderizados en el
 * servidor y pasados como prop (patrón RSC → cliente), así que los formularios
 * con server actions siguen funcionando.
 */
export function Tabs({ tabs, defaultId }: { tabs: Tab[]; defaultId?: string }) {
  const [activo, setActivo] = useState(defaultId ?? tabs[0]?.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b" role="tablist">
        {tabs.map((t) => {
          const seleccionado = t.id === activo;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={seleccionado}
              onClick={() => setActivo(t.id)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                seleccionado
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== activo}>
          {t.id === activo && t.content}
        </div>
      ))}
    </div>
  );
}
