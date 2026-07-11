import { cn } from "@/lib/utils";

/** Naranja institucional (fijo en la marca, en ambos temas). */
const NARANJA = "#EE7117";

/**
 * Isotipo (logosímbolo) de DocuNOVA: documento con desvanecido de píxeles y
 * borde naranja. El verde usa `currentColor` para adaptarse al tema (aclara en
 * modo oscuro); aplica `text-primary` en el contenedor.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("text-primary", className)}
      role="img"
      aria-label="DocuNOVA"
    >
      <g transform="rotate(-10 34 32)">
        <rect x="26" y="14" width="24" height="35" rx="5" fill={NARANJA} />
        <rect x="22" y="15" width="24" height="35" rx="5" fill="currentColor" />
        <rect x="37" y="19.5" width="6.5" height="9" rx="1.6" fill="#fff" />
        <rect x="26" y="20" width="8" height="2.6" rx="1.3" fill="#fff" />
        <rect x="26" y="25.4" width="8" height="2.6" rx="1.3" fill="#fff" />
        <rect x="26" y="31.4" width="17.5" height="2.6" rx="1.3" fill="#fff" />
        <rect x="26" y="37" width="17.5" height="2.6" rx="1.3" fill="#fff" />
        <rect x="26" y="42.6" width="13" height="2.6" rx="1.3" fill="#fff" />
      </g>
      <g fill="currentColor">
        <rect x="17.5" y="39.5" width="5.4" height="5.4" rx="1.2" />
        <rect x="12.2" y="44" width="4.6" height="4.6" rx="1.1" opacity=".85" />
        <rect x="8.6" y="39" width="4" height="4" rx="1" opacity=".7" />
        <rect x="13.6" y="36.4" width="3.2" height="3.2" rx=".8" opacity=".7" />
        <rect x="7" y="46" width="3.2" height="3.2" rx=".8" opacity=".55" />
        <rect x="10.6" y="50" width="2.6" height="2.6" rx=".7" opacity=".5" />
      </g>
    </svg>
  );
}

/**
 * Logotipo completo: isotipo + palabra "DocuNOVA" (Docu en verde, NOVA en
 * naranja) y, opcionalmente, la bajada "Gestión Documental".
 */
export function LogoFull({
  className,
  tagline = true,
}: {
  className?: string;
  tagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-9 flex-none" />
      <span className="leading-none">
        <span className="text-xl font-extrabold tracking-tight">
          <span className="text-primary">Docu</span>
          <span style={{ color: NARANJA }}>NOVA</span>
        </span>
        {tagline && (
          <span className="mt-0.5 block text-[9px] font-semibold tracking-[0.16em] text-secondary uppercase">
            Gestión Documental
          </span>
        )}
      </span>
    </span>
  );
}
