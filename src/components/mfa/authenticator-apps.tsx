import { Smartphone } from "lucide-react";

const PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2";
const APP_STORE = "https://apps.apple.com/app/google-authenticator/id388497605";

/** Logo de Apple (para el botón de App Store). */
function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M17.05 12.54c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.13-2.25-1.76-.18-3.43 1.03-4.32 1.03-.89 0-2.26-1.01-3.72-.98-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.56 1.42 11.36.95 1.37 2.08 2.91 3.56 2.85 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.72.89 1.54-.03 2.51-1.4 3.45-2.78 1.09-1.6 1.54-3.15 1.56-3.23-.03-.02-2.99-1.15-3.02-4.56zM14.53 4.15c.79-.96 1.32-2.29 1.17-3.62-1.14.05-2.51.76-3.32 1.72-.73.85-1.37 2.2-1.2 3.5 1.27.1 2.57-.65 3.35-1.6z" />
    </svg>
  );
}

/** Triángulo del logo de Google Play. */
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        d="M4.5 2.6 15.4 12 4.5 21.4c-.3-.2-.5-.6-.5-1V3.6c0-.4.2-.8.5-1z"
        fill="#00E676"
      />
      <path
        d="M15.4 12 4.5 2.6c.1-.05.2-.08.3-.1l10 5.7L15.4 12z"
        fill="#00C3FF"
      />
      <path
        d="M15.4 12 14.8 8.2l4.9 2.8c.5.3.5 1.1 0 1.4l-4.9 2.8L15.4 12z"
        fill="#FFC400"
      />
      <path
        d="M15.4 12 4.8 21.5c-.1-.02-.2-.05-.3-.1L14.8 15.8 15.4 12z"
        fill="#FF3D00"
      />
    </svg>
  );
}

/**
 * Botones para descargar Google Authenticator. `compact` oculta el texto
 * introductorio (útil para pantallas donde solo se recuerda la app).
 */
export function AuthenticatorApps({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Smartphone className="size-4 text-primary" />
        {compact
          ? "¿No tienes la app? Descarga Google Authenticator"
          : "Necesitas la app Google Authenticator en tu teléfono"}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={PLAY_STORE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <PlayGlyph /> Google Play
        </a>
        <a
          href={APP_STORE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <AppleGlyph /> App Store
        </a>
      </div>
    </div>
  );
}
