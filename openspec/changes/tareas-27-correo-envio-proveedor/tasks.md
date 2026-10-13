# Tasks

## 1. Rama

- [x] 1.1 Crear la rama `feat/TAREAS-27-correo-envio` desde main (SDD ya mergeado en #13) con este cambio dentro. Verificación: `git branch --show-current`.

## 2. Paquete portable `packages/correo`

- [ ] 2.1 Crear el paquete (`package.json` con nombre `correo`, `tsconfig`, scripts build/typecheck/test con vitest; dependencia `nodemailer`) y añadir su `path` en `apps/api/tsconfig.json`. Verificación: `npm run typecheck` en verde con el paquete vacío.
- [ ] 2.2 Dominio: tipos, validación de la configuración (proveedor, credencial, remitente, URL), `enmascarar`, cifrado AES-256-GCM, cálculo de reintentos y plantilla HTML base con escapado. Verificación: tests unitarios (cifrar/descifrar ida y vuelta, clave maestra incorrecta falla, enmascarado, validación, reintentos, escapado de `<script>`).
- [ ] 2.3 Puertos (`AlmacenConfigCorreo`, `ColaCorreo`, `Transporte`) y transportes Brevo (por `fetch`) y SMTP (nodemailer). Verificación: tests con `fetch` simulado que comprueban URL, cabecera `api-key` y cuerpo de Brevo, y que un error HTTP se convierte en error legible.
- [ ] 2.4 `ServicioCorreo` (configurar conservando la credencial si llega vacía, leer para el panel, probar, encolar, procesar la cola con reintentos, purgar). Verificación: tests con almacén y cola en memoria (envío correcto, fallo con reintento, agotar intentos → FAILED, credencial nunca devuelta).
- [ ] 2.5 Comprobar que el paquete no contiene nada de Yorga/Coolway ni depende de Prisma/NestJS. Verificación: `grep -riE "yorga|coolway|prisma|@nestjs" packages/correo/src` sin resultados.

## 3. Datos y API en Tareas

- [ ] 3.1 Migración Prisma: `mail_config`, `mail_message` y `notification.email_queued_at`. Verificación: `npm run db:generate` y `npm run typecheck`; la migración solo añade.
- [ ] 3.2 Adaptadores Prisma de los puertos y transporte por defecto desde `SMTP_URL`/`MAIL_FROM` cuando no hay configuración en el panel. Verificación: test del selector de transporte (sin config + env → SMTP; con config → la del panel; nada → «sin correo»).
- [ ] 3.3 Endpoints `/admin/correo` (GET, PUT, POST `/prueba`, GET `/registro`) con `usuarios.gestionar`, DTOs en `@yorga/contracts`; sin `MAIL_ENCRYPTION_KEY` el PUT con credencial responde con un error claro. Verificación: test del controlador/servicio y comprobación de que un miembro recibe 403.
- [ ] 3.4 Trabajador en proceso (cada 30 s, apagado en tests): avisos `ASSIGNED`/`MENTION`/`SLA` → cola (persona activa, con email, que ve el proyecto, posteriores a `notificationsSince`), procesado de la cola y purga diaria de >90 días; apagar el interruptor descarta los pendientes de avisos. Verificación: tests de la función que decide qué avisos se encolan (tipo, fecha, persona inactiva, sin permiso de proyecto).
- [ ] 3.5 Contenido de los correos de aviso: asunto con clave y título, texto del aviso, botón a `<URL pública>/t/<CLAVE>`, nombre y pie de la app. Verificación: test de la composición del correo.
- [ ] 3.6 «He olvidado mi contraseña» por el motor nuevo (encolar + procesado inmediato; sin correo, aviso a admins) y borrar `mailer.ts`. Verificación: tests del flujo con y sin correo configurado.
- [ ] 3.7 `MAIL_ENCRYPTION_KEY` en `apps/api/.env.example` y en `.do/app.yaml` (SECRET, sin valor); Dockerfile compila `correo` y cambia su `main` a `dist`. Verificación: `docker build` o, si no hay Docker, revisión del Dockerfile + `npm run build -w correo`.

## 4. Pantalla de admin

- [ ] 4.1 Página **Correo** en el menú de administración: proveedor, credencial (con «••••1234» si existe), remitente, respuesta, marca, interruptor de avisos, «Enviar correo de prueba» y registro con estado y error. Verificación: `npm run build` y revisión en el navegador en local.
- [ ] 4.2 Comprobaciones completas del repo. Verificación: `npm run typecheck && npm test && npm run build` en verde.

## 5. Merge del PR (caso B)

- [ ] 5.1 Crear `MAIL_ENCRYPTION_KEY` en DigitalOcean (SECRET) ANTES del merge, abrir el PR con la clave TAREAS-27 y mergearlo (lo hace Pablo). Los criterios que piden un proveedor real (1, 3, 5, 6, 7) solo se pueden comprobar en producción: el cambio se mergea abierto y se archiva después en un PR corto.

## 6. Verificación con el negocio (en producción, después del merge)

- [ ] 6.1 Criterio 1: crear la cuenta de Brevo (gratuita), verificar el dominio del remitente, configurarla en Correo y enviar la prueba; llega al buzón.
- [ ] 6.2 Criterio 2: al recargar la pantalla la clave sale como «••••» + 4 caracteres.
- [ ] 6.3 Criterios 3 y 4: con el interruptor encendido, asignar una tarea de prueba a otra persona y mencionarla; le llega el correo en <2 min con botón a la tarea; quien actúa no recibe nada. Plazo vencido: comprobar con el siguiente aviso de ATC (o forzándolo en una tarea de prueba).
- [ ] 6.4 Criterio 5: guardar una clave errónea, provocar un aviso y ver en el registro el error, los reintentos y el «fallido» final; volver a poner la buena.
- [ ] 6.5 Criterio 6: pedir «He olvidado mi contraseña» con una cuenta de prueba; llega el enlace y funciona.
- [ ] 6.6 Criterio 7: apagar el interruptor y comprobar que deja de salir el correo de una asignación.
- [ ] 6.7 Dejar el resultado de cada criterio en TAREAS-27.

## Workflow follow-up

- Archivar el cambio con `/sdd:cerrar tareas-27-correo-envio-proveedor` en un PR corto tras la verificación.
- Después: TAREAS-28 (preferencias por persona) y TAREAS-29 (reglas por proyecto).
