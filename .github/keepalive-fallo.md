El workflow **Keepalive Supabase** falló: Supabase pausa la base de datos del
Plan Free si no recibe actividad durante 7 días, y el latido es lo único que la
mantiene despierta.

Qué revisar (ver `docs/DESPLIEGUE.md`, paso 7):

1. Que exista `KEEPALIVE_URL` en Settings → Secrets and variables → Actions,
   apuntando a `https://<dominio-de-docunova>/api/keepalive`.
2. Que `SUPABASE_SERVICE_ROLE_KEY` esté definida en Vercel (sin ella la ruta
   responde 503).
3. Que `KEEPALIVE_SECRET` coincida en Vercel y en GitHub, si se usa (si no
   coincide, la ruta responde 401).
4. Mientras se corrige, se puede latir a mano desde Configuración → Monitoreo
   Supabase → **Latir ahora**.
