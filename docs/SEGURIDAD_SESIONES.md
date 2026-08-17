# Política de sesiones — caducidad diaria

## Qué problema resuelve

Supabase renueva el token de acceso de forma automática mientras el *refresh
token* siga vivo. En la práctica eso significa que una pestaña abierta mantiene
la sesión iniciada durante días: cualquiera que se siente frente a ese equipo
entra a la aplicación con el usuario de otra persona, sin contraseña y sin
segundo factor.

## La regla

**Toda sesión caduca a las 8 horas de haber iniciado sesión.**

- Es un **tope absoluto**, no un temporizador de inactividad. Dentro de esas
  8 horas nadie es expulsado por dejar de escribir, cambiar de pestaña o irse a
  almorzar: la jornada de trabajo cabe entera en una sola sesión.
- Como el tope es menor que un día, **es imposible arrastrar la misma sesión de
  una jornada a la siguiente**: cada día hay que volver a autenticarse con
  Google y con el segundo factor.
- Cinco minutos antes de caducar aparece un aviso para poder guardar el trabajo
  en curso.
- Al caducar se pasa por `/auth/signout?reason=expirada`, que cierra la sesión y
  lleva al login con la explicación.

## Dónde está implementado

| Archivo | Papel |
|---|---|
| `src/lib/auth/session-policy.ts` | La política: `SESSION_MAX_HOURS`, caducidad y tiempo restante. Con pruebas en `session-policy.test.ts`. |
| `src/proxy.ts` | Corta las navegaciones con la sesión caducada. |
| `src/lib/auth/guard.ts` | Mismo corte en `requireAuth()`, que también cubre Server Actions y route handlers (no pasan por el proxy). |
| `src/components/auth/session-expiry-watcher.tsx` | Expulsa la pestaña abierta que no navega, y avisa 5 minutos antes. |
| `src/app/login/page.tsx` | Mensaje al usuario expulsado por caducidad. |
| `src/components/auth/session-expiry-notice.tsx` | Muestra en el menú de perfil a qué hora vence la sesión. |

La decisión la toma **el servidor**. El vigilante del navegador solo adelanta la
expulsión de una pestaña ociosa; si se desactivara, el corte seguiría ocurriendo
en el proxy y en `requireAuth()`.

### De dónde sale la hora de inicio

Del campo `last_sign_in_at` del usuario que devuelve `supabase.auth.getUser()`
(verificado contra el servidor de autenticación). Se fija en cada inicio de
sesión y **no** se actualiza al renovar el token, así que sirve de ancla y el
cliente no puede estirar la ventana.

Si ese campo faltara, la política responde «no caducada» a propósito: sin ancla
no hay forma de medir, y responder lo contrario dejaría al usuario en un bucle
login → expulsión → login.

### Cambiar la duración

Un único valor, en `src/lib/auth/session-policy.ts`:

```ts
export const SESSION_MAX_HOURS = 8;
```

## Cómo comprobar que está activa

Abre el menú de perfil (arriba a la derecha): debajo del rol aparece «Tu sesión
vence a las HH:MM». Esa línea sale del mismo cálculo que ejecuta la expulsión,
así que si se ve, la política está activa. En la última hora pasa a cuenta
atrás y cambia de color.

## Refuerzo en el propio Supabase (recomendado)

Con lo anterior, la aplicación ya no acepta una sesión de más de 8 horas. Para
que además Supabase deje de emitir tokens nuevos pasado ese plazo, en el panel:

**Authentication → Sessions**

| Opción | Valor |
|---|---|
| *Time-box user sessions* | `8 hours` |
| *Inactivity timeout* | dejar vacío (no queremos expulsar por inactividad) |

Es un cambio de configuración del proyecto, no de código, y **no está aplicado
por este repositorio**: hay que hacerlo en el panel del proyecto.

## Sistemas hermanos

La misma política de 8 horas está replicada en CampusNOVA, CrediNOVA y
ParkiNOVA. ParkiNOVA gestiona sus propias sesiones en base de datos, así que
allí el tope vive en `src/server/auth/sesion.ts`.
