# Spec 002 — Estructura organizacional, TRD, usuarios y activación

- **Estado:** Implementada (Fase 1)
- **Fecha:** 2026-07
- **Depende de:** 001-fundacion

## 1. Qué problema resuelve

La Fase 0 dejó una fundación genérica (auth, roles, RLS). Cotecnova necesita que
el sistema refleje su **estructura real** (Ejes → Macroprocesos → Procesos →
Oficinas Productoras), su **Tabla de Retención Documental (TRD)** aprobada y su
**planta de personal**, con un flujo de **autorregistro con aprobación manual**.
Sin esto no hay dónde clasificar documentos ni cómo dar acceso controlado.

Trazabilidad: esta spec deriva de las secciones "Estructura organizacional",
"Roles y permisos", "Usuarios iniciales (seed)" y "Alcance funcional §1" del
prompt institucional (`docunovapromptmedo.md`).

## 2. Alcance

Incluye:

- Modelo **Eje → Macroproceso → Proceso → Oficina Productora** (el Proceso es la
  unidad de permisos). Reemplaza la tabla plana `dependencias` de la Fase 0.
- Catálogo **TRD**: Series → Subseries/Tipos documentales con soporte, retención
  (gestión/central) y disposición final, importado de la TRD real.
- **Pre-registro** de los 38 empleados (semilla) y **flujo de activación**: las
  cuentas nacen inactivas hasta que el super administrador las aprueba.
- **Datos sensibles** (cédula) en tabla aparte con acceso restringido (Ley 1581).
- **Panel de administración**: activar usuarios y asignar rol/proceso/oficina;
  ver y editar el catálogo organizacional.
- **Consulta de la TRD** por proceso.

No incluye (fases posteriores): expedientes, documentos electrónicos, flujos de
aprobación/firma, notificaciones, tablero con indicadores.

## 3. Mapeo de roles (CSV → 5 roles del sistema)

Se mantienen los 5 roles de la Fase 0. El CSV se mapea así: Administrador de
Proceso / de Oficina Productora → `jefe_dependencia`; Gestor documental →
`funcionario`; Consulta / Servicios Generales → `consulta`. Excepciones por
correo: `desarrolloweb@` → `super_admin` (sembrado **activo**);
`gestiondocumental@` → `admin_archivo`. El **alcance** (qué proceso/oficina) lo
fijan `profiles.proceso_id` / `profiles.oficina_id`.

## 4. Comportamiento esperado (criterios de aceptación)

- **CA-1.** El catálogo importa exactamente **3 ejes, 10 macroprocesos, 16
  procesos, 25 oficinas, 128 series, 230 subseries** y **38 usuarios** de
  pre-registro (verificado por prueba automática).
- **CA-2.** La oficina "Financiera" quedó dividida en Contabilidad (1251),
  Tesorería (1252) y Crédito y Cartera (1253), las tres bajo el proceso
  Financiera.
- **CA-3.** "Consejo Directivo" (1001) es una clasificación independiente
  (`proceso_id` nulo). Los procesos "Sistemas Integrados de Gestión" y "Sistema
  de Aseguramiento Interno de Calidad" no tienen oficina productora.
- **CA-4.** Una cuenta recién creada queda **Inactiva** y es enviada a
  `/pendiente`, salvo `desarrolloweb@cotecnova.edu.co`, que nace `super_admin`
  activo.
- **CA-5.** El super administrador activa cuentas y asigna rol/proceso/oficina
  desde `/admin/usuarios`.
- **CA-6.** Un usuario no super_admin **no** puede cambiar su propio rol, estado,
  proceso ni oficina (lo impide el trigger `protect_profile_privileges`).
- **CA-7.** La cédula vive en `datos_sensibles` y solo la ven su dueño y el super
  administrador; no aparece en listados generales.
- **CA-8.** Cualquier usuario activo consulta la TRD por proceso en `/trd`.

## 5. Fuera de contexto / supuestos

- Los usuarios de Supabase Auth se crean en el **primer login con Google**; por
  eso el seed va a `usuarios_semilla` y el trigger `handle_new_user` enriquece el
  perfil en ese primer acceso.
- El repositorio es privado; por decisión del usuario la cédula se versiona en el
  seed. El acceso a ese dato queda restringido por RLS.
- Las pruebas de aislamiento RLS por usuario requieren base de datos viva
  (`supabase/tests/rls.sql`); no corren en CI.
