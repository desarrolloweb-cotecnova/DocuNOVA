# Vincular el Drive de docunova@cotecnova.edu.co

Los archivos de **Memoria Corporativa** (Memoria Histórica, de Gobierno, Activa
y Banco de Proyectos) pueden guardarse en el Google Drive institucional de la
cuenta `docunova@cotecnova.edu.co` en lugar del bucket de Supabase Storage.

Mientras no configures las variables de entorno de esta guía, DocuNOVA sigue
funcionando igual y guarda los archivos en Supabase Storage. Al configurarlas,
los documentos **nuevos** van a Drive; los ya cargados siguen donde están y se
visualizan sin cambios.

La app no usa la contraseña de la cuenta: usa una **cuenta de servicio** de
Google Cloud, que es una identidad de máquina con su propia clave. Así no hay
que renovar sesiones ni guardar credenciales de una persona.

---

## Paso 1 — Crear el proyecto y la cuenta de servicio

1. Entra a <https://console.cloud.google.com/> con `docunova@cotecnova.edu.co`
   (o con la cuenta de administrador de Google Workspace de Cotecnova).
2. Crea un proyecto nuevo: **Seleccionar proyecto → Proyecto nuevo**.
   Nombre sugerido: `DocuNOVA`.
3. Con el proyecto seleccionado, ve a **APIs y servicios → Biblioteca**, busca
   **Google Drive API** y pulsa **Habilitar**.
4. Ve a **APIs y servicios → Credenciales → Crear credenciales → Cuenta de
   servicio**.
   - Nombre: `docunova-drive`.
   - No hace falta asignarle roles de IAM ni usuarios: pulsa **Listo**.
5. Abre la cuenta de servicio recién creada → pestaña **Claves** →
   **Agregar clave → Crear clave nueva → JSON**. Se descarga un archivo `.json`.
   **Guárdalo bien: es un secreto y no se puede volver a descargar.**

Del archivo JSON necesitarás dos valores:

| Campo del JSON | Variable de entorno |
| --- | --- |
| `client_email` (algo como `docunova-drive@…iam.gserviceaccount.com`) | `GOOGLE_DRIVE_CLIENT_EMAIL` |
| `private_key` (empieza por `-----BEGIN PRIVATE KEY-----`) | `GOOGLE_DRIVE_PRIVATE_KEY` |

---

## Paso 2 — Preparar la carpeta destino en Drive

Elige **una** de las dos opciones. La **A** es la recomendada.

### Opción A (recomendada): unidad compartida

Las unidades compartidas pertenecen a la organización y el espacio que ocupan
los archivos se descuenta del almacenamiento de Cotecnova, no de la cuenta de
servicio (que no tiene cuota propia).

1. En <https://drive.google.com/> con `docunova@cotecnova.edu.co`, ve a
   **Unidades compartidas → Nueva** y crea, por ejemplo, `DocuNOVA`.
2. Dentro de ella crea la carpeta `Memoria Corporativa`.
3. Abre la unidad compartida → **Administrar miembros** y agrega el
   `client_email` de la cuenta de servicio con permiso de
   **Administrador de contenido** (o **Colaborador**).

> Si el plan de Google Workspace de Cotecnova no incluye unidades compartidas,
> usa la Opción B.

### Opción B: carpeta de Mi unidad con delegación de dominio

Aquí la cuenta de servicio actúa **en nombre de** `docunova@cotecnova.edu.co`,
así que los archivos quedan a nombre de esa cuenta y ocupan su cuota.

1. En Google Cloud, abre la cuenta de servicio y copia su **ID único**
   (`Unique ID`, un número largo; también está como `client_id` en el JSON).
2. Ve a la consola de administración de Google Workspace
   (<https://admin.google.com/>) → **Seguridad → Acceso y control de datos →
   Controles de API → Administrar delegación de todo el dominio → Añadir nueva**.
   - **ID de cliente:** el ID único de la cuenta de servicio.
   - **Ámbitos de OAuth:** `https://www.googleapis.com/auth/drive`
3. En Drive, con `docunova@cotecnova.edu.co`, crea la carpeta
   `DocuNOVA / Memoria Corporativa`.
4. Añade la variable `GOOGLE_DRIVE_SUBJECT=docunova@cotecnova.edu.co`
   (solo en esta opción).

### En ambas opciones: obtener el ID de la carpeta

Abre la carpeta en Drive y mira la URL:

```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz123456
                                       └──────── este es el ID ────────┘
```

Ese valor va en `GOOGLE_DRIVE_FOLDER_ID`.

---

## Paso 3 — Cargar las variables de entorno

En **Vercel → tu proyecto → Settings → Environment Variables** (y en
`.env.local` para desarrollo), agrega:

```
GOOGLE_DRIVE_CLIENT_EMAIL=docunova-drive@tu-proyecto.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz123456
# Solo con la Opción B (delegación de dominio):
# GOOGLE_DRIVE_SUBJECT=docunova@cotecnova.edu.co
```

Notas:

- La clave privada es de **varias líneas**. En Vercel pégala tal cual (el campo
  admite saltos de línea) o en una sola línea con `\n` literales: la app acepta
  las dos formas.
- Ninguna de estas variables lleva el prefijo `NEXT_PUBLIC_`: son secretas y
  solo las lee el servidor.
- Después de guardarlas, **vuelve a desplegar** para que el servidor las tome.

---

## Paso 4 — Comprobar la vinculación

1. Entra a DocuNOVA como Administrador o superior.
2. Ve a **Configuración → Componentes Memoria Corporativa → Probar conexión con
   Drive**.
   - «Conexión con Drive correcta» y el nombre de la carpeta ⇒ listo.
   - «La cuenta de servicio no puede ver la carpeta…» ⇒ falta compartir la
     carpeta o la unidad con el `client_email` (Paso 2).
   - «Google rechazó las credenciales…» ⇒ revisa `GOOGLE_DRIVE_CLIENT_EMAIL` y
     `GOOGLE_DRIVE_PRIVATE_KEY`, y que la Drive API esté habilitada.
3. Carga un documento de prueba en **Memoria Corporativa** y verifica que
   aparece en la carpeta de Drive. En **Detalle** del documento, el campo
   «Almacenamiento» dirá *Google Drive institucional* con un enlace directo.

---

## Cómo circulan los archivos

- **Al cargar:** el servidor pide a Drive una sesión de carga y el **navegador
  sube el archivo directamente a Google**. El archivo no pasa por la app, así
  que no lo limita el tamaño máximo del cuerpo de una Server Action (1 MB en
  Next.js, 4,5 MB en Vercel). El límite del módulo sigue siendo 25 MB.
- **Al visualizar:** la app descarga el archivo con la cuenta de servicio y lo
  entrega al usuario. Nadie necesita permisos en Drive ni la carpeta se comparte
  con nadie: quién puede ver qué lo sigue decidiendo la RLS de Supabase.
- **Al eliminar:** el archivo se envía a la papelera de Drive (recuperable
  durante 30 días) y la fila se borra de la base.

## Seguridad

- La carpeta de Drive **no debe compartirse públicamente**; el acceso a los
  documentos se controla en DocuNOVA (público/privado, estado y rol).
- Si la clave de la cuenta de servicio se filtra, bórrala en Google Cloud
  (**Cuenta de servicio → Claves → Eliminar**), crea una nueva y actualiza
  `GOOGLE_DRIVE_PRIVATE_KEY`.
