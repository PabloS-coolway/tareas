# Design

## Context

- TAREAS-27 dejó en producción el motor de correo (`packages/correo`) y el trabajador `AvisosPorCorreoService`
  (cada 30 s): toma los avisos ya guardados de tipo `ASSIGNED`, `MENTION` y `SLA`, posteriores a cuando el admin
  encendió el interruptor, y los encola si la persona está activa, tiene email y ve el proyecto. Los marca con
  `notification.email_queued_at` para no volver a mirarlos.
- La lógica de qué se envía vive en `tareas/domain/avisos-correo.ts` (`vaPorCorreo`, `motivoParaNoEnviar`,
  `componerAviso`), con tests.
- No hay página de perfil: el pie del menú tiene «cambiar contraseña» (modal) y «cerrar sesión».
- Los avisos tienen tarea (salvo `PASSWORD_RESET`, que es para admins y no entra aquí), así que se conoce su
  proyecto y su prioridad.

## Goals / Non-Goals

**Goals:**
- Preferencias por persona que cambian solo el correo, nunca la campana.
- Quien no toque nada recibe exactamente lo de hoy (sin migrar datos de nadie).
- Resumen diario fiable: como mucho uno al día por persona, aunque la API se reinicie.

**Non-Goals:**
- Hora del resumen configurable, festivos, baja sin sesión, que un admin edite preferencias ajenas (ver propuesta).

## Decisions

### 1. Tabla `email_pref`, una fila por persona solo si cambia algo
`user_id` (PK, FK a usuario con borrado en cascada), `enabled` (bool), `types` (texto[] con los tipos de aviso),
`project_mode` (`todos` | `solo` | `silenciar`), `project_ids` (int[]), `min_priority` (texto o null), `mode`
(`inmediato` | `resumen`), `last_digest_at` (fecha o null) y `updated_at`. **Sin fila = valores por defecto**
(activado; asignación, mención y plazo; todos los proyectos; sin prioridad mínima; al momento): no hace falta
migrar a nadie y el comportamiento de hoy se mantiene.

*Alternativa descartada:* columnas en la tabla de usuarios. Mezclaría auth con avisos y obligaría a tocar el
repositorio de usuarios.

### 2. Reglas en el paquete portable `@modulos/correo` (decisión de Pablo: modular, para Atalaya)
Nuevo módulo `preferencias` del paquete, sin Prisma ni Nest ni nada de Tareas:
- **Catálogo de la app** (`CatalogoAvisos`): los tipos de aviso con su etiqueta y si vienen activados por defecto.
  Tareas declara sus 8 tipos; Atalaya, los suyos.
- **`PreferenciasCorreo`**: `activo`, `tipos`, `ambitos` (`{ modo: 'todos' | 'solo' | 'silenciar', ids }`, en
  Tareas los proyectos), `nivelMinimo` (índice en una escala ordenada que da la app; en Tareas, Baja < Normal < Alta
  < Urgente) y `modo` (`inmediato` | `resumen`).
- Funciones puras: `preferenciasPorDefecto(catalogo)`, `normalizarPreferencias(dto, catalogo, escala)` (valida),
  `pasaPreferencias(pref, aviso)` con `aviso = { tipo, ambitoId, nivel }`, y
  `tocaResumen(ahora, ultimoResumen, horario)` con `horario = { zona, hora, dias }`. Tareas usa `Europe/Madrid`, 8,
  lunes a viernes; Atalaya podrá pasar uno por empresa. Usa `Intl`, que resuelve el horario de verano.
- `componerResumen(marca, persona, avisos, enlacePerfil)`: un correo con un enlace por aviso.
- Puerto `AlmacenPreferencias` (leer y guardar por persona, y fecha del último resumen) para que cada app ponga su
  almacenamiento.
En Tareas (`tareas/domain/avisos-correo.ts`) solo queda lo propio: el catálogo de sus tipos, la escala de
prioridades y la traducción de un aviso (`proyecto → ámbito`, `prioridad → nivel`). `vaPorCorreo` deja de ser la
lista fija de tres tipos: pasa a «cualquier aviso de tarea» (todos menos `PASSWORD_RESET`).

*Alternativa descartada:* dejarlo en el dominio de Tareas. Atalaya tendría que copiarlo y adaptarlo a mano.

### 3. El trabajador aplica las preferencias
- **Al momento:** como hoy, pero tomando todos los tipos de aviso de tarea y aplicando `pasaPreferencias`. Si la
  persona está en modo resumen, el aviso no se encola ahora. Todos los avisos mirados se marcan con
  `email_queued_at`, se envíen o no, para no volver a mirarlos.
- **Resumen:** en cada paso, si `tocaResumen` para alguien con modo resumen y el interruptor personal encendido,
  junta sus avisos **sin leer** (`read_at` nulo), posteriores a su `last_digest_at` (la primera vez, los últimos 3
  días) y a cuando el admin encendió el interruptor, que pasen sus preferencias y sean de proyectos que ve.
  Encola un correo de tipo `aviso.resumen` si hay alguno y fija `last_digest_at = ahora` **haya o no avisos**.
  Ese campo en base de datos es lo que impide un segundo resumen el mismo día, también tras un reinicio. Si la API
  estuvo caída a las 8:00, el resumen sale en cuanto vuelve, ese mismo día.
- El interruptor del admin sigue mandando: apagado, no se encola nada (ni al momento ni resumen).

### 4. Plantilla: lista de enlaces y enlace al pie (en el paquete)
`componer` de `@modulos/correo` admite dos opcionales genéricos: `enlaces` (lista de «texto → url», para el
resumen) y `notaPie` (un enlace al pie, para «Cambia qué correos recibes»). Es útil también para Atalaya, y lo de
siempre sigue igual si no se usan.

### 5. API `/me/correo` y página «Mi perfil»
- `GET /me/correo` y `PUT /me/correo`: siempre sobre la persona de la sesión (o del token), sin parámetro de usuario.
  Así nadie puede tocar las preferencias de otro. Requieren sesión, pero ninguna feature: cualquiera configura lo
  suyo. DTOs en `@yorga/contracts`.
- Web: página `/perfil` con datos (solo lectura), botón «Cambiar contraseña» (el modal de siempre) y la sección
  Correo. El bloque con tu nombre en el pie del menú pasa a ser un enlace a `/perfil`. La lista de proyectos para
  elegir sale de los que la persona ve (`useProyectos`).

## Risks / Trade-offs

- **Resumen y tiempo de lectura:** un aviso leído entre el momento en que llega y las 8:00 no sale en el resumen.
  Es lo pedido («solo sin leer»).
- **Elegir solo unos proyectos y que se creen otros nuevos:** con «solo estos», un proyecto nuevo no manda correo
  hasta que la persona lo añada. Con «silenciar estos», sí. La pantalla lo explica.
- **Volumen al activar comentarios o cambios de estado:** puede ser mucho correo; cada uno decide, y siempre puede
  pasar al resumen.
- **Hora de Madrid fija en Tareas:** el equipo está en España. El paquete recibe el horario como parámetro, así que Atalaya puede usar uno por empresa.

## Despliegue y vuelta atrás

1. Sin variables de entorno nuevas. Merge del PR → despliegue automático desde main; la migración (tabla
   `email_pref`) solo añade y se aplica al arrancar.
2. Nadie tiene fila al principio: todos siguen recibiendo lo de hoy hasta que cambien algo en «Mi perfil».
3. **Vuelta atrás rápida:** el interruptor del admin en «Correo» corta todos los avisos por correo al momento.
   **Completa:** revertir el PR. La tabla puede quedarse; sin ella el trabajador vuelve a la lista fija de tres
   tipos.
