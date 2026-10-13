# Design

## Context

- Hoy el correo es una función suelta (`apps/api/src/auth/infrastructure/mailer.ts`) con nodemailer y SMTP por
  variables de entorno (`SMTP_URL`, `MAIL_FROM`). Solo la usa «He olvidado mi contraseña». En producción no está
  configurado, así que el restablecimiento acaba en un aviso a los admins.
- Los avisos de la app (`NotificationsService.notify`) se escriben casi siempre **dentro de una transacción**
  (asignar, comentar, cambiar estado…). Si se mandara el correo ahí mismo, un rollback dejaría correos de cosas que
  no pasaron, y un proveedor lento retrasaría la acción.
- No hay tabla de ajustes editables desde el panel: los secretos viven en variables de entorno de DigitalOcean.
- La API corre en **una sola instancia**. Ya hay un temporizador en proceso (`IntakeService.vigilarPlazos`, cada
  5 min) que sirve de patrón para trabajos en segundo plano.
- Los paquetes del monorepo se consumen desde su código fuente vía `paths` de TypeScript (`@yorga/contracts`) y, en
  la imagen Docker, compilados (el Dockerfile cambia su `main` a `dist`).
- Requisito de la épica TAREAS-26: el motor tiene que poder copiarse a **Atalaya** (marca blanca, multiempresa) sin
  tocarlo.

## Goals / Non-Goals

**Goals:**
- Motor de correo portable: un paquete sin marca, sin Prisma ni NestJS dentro, con puertos que cada app implementa.
- Proveedor, credencial, remitente y marca editables desde el panel; credencial cifrada.
- Ningún envío dentro de una transacción ni en el camino de la petición del usuario (salvo el correo de prueba,
  que es síncrono a propósito para dar el resultado al momento).
- Avisos de asignación, mención y plazo por correo, con interruptor general.

**Non-Goals:**
- Preferencias por persona (TAREAS-28), reglas por proyecto (TAREAS-29), resumen diario.
- Varias instancias de API trabajando la cola a la vez (no hace falta hoy; ver Riesgos).
- Webhooks de rebotes o aperturas de los proveedores.

## Decisions

### 1. Paquete `packages/correo` (nombre de paquete `correo`, sin ámbito de marca)
Contiene solo TypeScript «puro» + `nodemailer` y `fetch`:
- `dominio/`: tipos (`Proveedor = 'brevo' | 'smtp'`, `ConfigCorreo`, `MensajeCorreo`), validación
  de la configuración, `enmascarar()`, cifrado AES-256-GCM con `node:crypto` (`cifrar`/`descifrar` con clave
  maestra), cálculo del siguiente reintento (esperas 1, 5, 15, 60 min; 5 intentos) y la plantilla HTML base
  (escapando todo lo que venga del usuario).
- `puertos`: `AlmacenConfigCorreo` (leer/guardar por `propietario`), `ColaCorreo` (encolar, tomar pendientes,
  marcar enviado/fallido, listar registro, purgar), `Transporte` (enviar un mensaje).
- `transportes/`: Brevo (`POST https://api.brevo.com/v3/smtp/email`, cabecera `api-key`, por `fetch`, sin SDK) y
  SMTP (nodemailer). Añadir otro proveedor es añadir un transporte más y su valor en `Proveedor`.
- `ServicioCorreo`: `configurar`, `leerParaPanel` (con la credencial enmascarada), `probar`, `encolar`,
  `procesarCola` (un «tick» del trabajador) y `purgar`.
- **Propietario**: una cadena. Tareas usa siempre `'default'`; Atalaya pasará el id de la empresa.

*Alternativas:* módulo NestJS dentro de `apps/api` (no se puede copiar limpio a Atalaya) o SDK oficiales de
los proveedores (una dependencia más para una sola llamada HTTP).

### 1b. Brevo y SMTP; fuera SendGrid y Mailchimp
SendGrid retiró su plan gratuito en 2025 (queda una prueba de 60 días; después, desde ~20 $/mes) y Mailchimp
Transactional es un complemento de pago. Brevo da 300 correos al día gratis con API y SMTP, es europea (protección de
datos) y aguanta el volumen de Tareas y los primeros clientes de Atalaya. SMTP se queda por compatibilidad con la
configuración actual y para usar un buzón del propio dominio.

### 2. Adaptadores y API en Tareas (`apps/api/src/correo/`)
- Prisma: `MailConfig` (propietario como clave, proveedor, credencial cifrada + últimos 4, remitente, respuesta,
  marca, `notificationsEnabled`, `notificationsSince`, quién y cuándo) y `MailMessage` (cola y registro a la vez:
  destinatario, asunto, html, texto, tipo, estado `PENDING|SENT|FAILED`, intentos, `nextAttemptAt`, último error,
  id del proveedor, fechas). En `Notification`, columna nueva `emailQueuedAt`.
- Endpoints bajo `/admin/correo` con `@RequireFeature('usuarios.gestionar')` (mismo permiso que Integraciones; no se
  añade una feature nueva al catálogo): `GET` configuración enmascarada, `PUT` guardar (credencial vacía = mantener
  la actual), `POST /prueba {to}`, `GET /registro`.
- Web: página **Correo** en el menú de administración, con formulario, interruptor, prueba y registro.

### 3. Avisos por correo leyendo los avisos ya guardados (no se toca `notify`)
Un trabajador en proceso (cada 30 s) hace:
1. Si el interruptor está encendido: toma los avisos de tipo `ASSIGNED`, `MENTION` y `SLA` con
   `emailQueuedAt = null` y `createdAt >= notificationsSince`, comprueba que la persona está activa, tiene email y
   puede ver el proyecto (`AccessService`), compone el correo y lo encola; marca `emailQueuedAt` en el mismo paso.
2. Procesa la cola: hasta N mensajes con `nextAttemptAt <= ahora`, los envía y los marca.
3. Una vez al día, purga el registro de más de 90 días.

Como solo ve avisos ya **confirmados** en la base de datos, un rollback nunca genera correo y no hay que tocar las
transacciones existentes. Al apagar el interruptor se descartan también los pendientes de tipo aviso.
`notificationsSince` se fija al encender, para no enviar avisos antiguos.

*Alternativa descartada:* encolar desde `notify(…, tx)` (patrón outbox clásico). Habría que pasar config y datos de
la tarea por cada llamada en 8 sitios y acoplar el motor de avisos al de correo.

### 4. Clave maestra en variable de entorno
`MAIL_ENCRYPTION_KEY` (32 bytes en base64), de tipo SECRET en DigitalOcean y en `apps/api/.env` en local (ignorado
por git). Sin ella no se puede guardar una credencial y el panel lo dice. Cambiarla invalida las credenciales
guardadas: hay que volver a pegarlas (se documenta).

### 5. Compatibilidad
Si no existe `MailConfig`, el transporte se construye desde `SMTP_URL`/`MAIL_FROM` como hoy. «He olvidado mi
contraseña» encola el correo y pide un procesado inmediato de la cola; si no hay correo de ningún tipo, avisa a los
admins como ahora. `mailer.ts` desaparece.

### 6. Build
`apps/api/tsconfig.json` añade el `path` de `correo` (como `@yorga/contracts`) y el Dockerfile compila el paquete y
cambia su `main` a `dist`, igual que con contracts.

## Risks / Trade-offs

- **Varias instancias de API** enviarían duplicados. Hoy hay una (`instance_count: 1`). Si se escala, se toma la cola
  con `UPDATE … RETURNING` / `FOR UPDATE SKIP LOCKED`. Queda anotado en el código.
- **Dominio del remitente sin verificar** en Brevo: el proveedor rechaza o va a spam. La prueba
  muestra el error; hay que verificar el dominio coolway.com en Brevo (registros DNS, fuera del repo).
- **Límite del plan gratuito de Brevo** (300/día): si se supera, Brevo rechaza y los correos quedan como fallidos
  en el registro. Con ~10 personas no se espera llegar; el registro permite verlo.
- **Volumen**: con el interruptor encendido, toda la plantilla recibe correo de asignaciones y menciones sin poder
  desactivarlo hasta TAREAS-28. Lo decidió Pablo; el interruptor general es el freno.
- **Pérdida de la clave maestra**: las credenciales guardadas dejan de poder descifrarse; se vuelven a pegar.
- **Retraso**: hasta ~30 s de trabajador + lo que tarde el proveedor (dentro de los 2 min del criterio).

## Despliegue y vuelta atrás

1. **Antes del merge**: crear en DigitalOcean (app `tareas-yorga`, componente API) la variable
   `MAIL_ENCRYPTION_KEY` de tipo SECRET (`openssl rand -base64 32`). Nunca va al repo.
2. Merge del PR → despliegue automático desde main; la migración (tablas `mail_config`, `mail_message` y columna
   `notification.email_queued_at`) se aplica al arrancar. Solo añade, no cambia nada existente.
3. En producción el correo queda **sin configurar y con el interruptor apagado**: no sale nada hasta que un admin lo
   configure, pruebe y encienda el interruptor.
4. **Vuelta atrás rápida**: apagar el interruptor desde el panel (corta los avisos al momento). **Completa**: revertir
   el PR; las tablas nuevas pueden quedarse (no molestan) o borrarse con una migración posterior.
