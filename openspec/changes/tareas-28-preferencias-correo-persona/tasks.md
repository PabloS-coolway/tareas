# Tasks

## 1. Rama

- [x] 1.1 Crear la rama `feat/TAREAS-28-preferencias-correo` desde main con este cambio dentro. Verificación: `git branch --show-current`.

## 2. Módulo portable de preferencias (en `@modulos/correo`)

- [x] 2.1 `packages/correo/src/preferencias/`: catálogo, `PreferenciasCorreo`, `preferenciasPorDefecto`, `normalizarPreferencias`, `pasaPreferencias` (interruptor, tipo, ámbitos todos/solo/silenciar, nivel mínimo), `tocaResumen` (horario con zona, hora y días; uno por día local) y el puerto `AlmacenPreferencias`. Verificación: tests vitest de cada regla, incluidos sábado y domingo, 7:59 frente a 8:00, ya enviado hoy, el último domingo de octubre (cambio de hora) y otra zona horaria (p. ej. America/Santiago).
- [x] 2.2 `componer` admite `enlaces` y `notaPie` opcionales (con escapado), y `componerResumen`. Verificación: tests del paquete; lo existente sin esos campos sale igual.
- [x] 2.3 Nada de Tareas ni frameworks en el paquete. Verificación: `grep -riE "yorga|coolway|prisma|@nestjs|proyecto|prioridad" packages/correo/src` sin resultados.
- [x] 2.4 Tareas: catálogo de sus 8 tipos, escala de prioridades, traducción aviso → `{ tipo, ambitoId, nivel }`, `vaPorCorreo` a «cualquier aviso de tarea» y enlace «Cambia qué correos recibes» en los avisos. Verificación: tests jest.

## 3. Datos y API

- [x] 3.1 Migración Prisma: tabla `email_pref`. Verificación: `npm run db:generate`, `npm run typecheck` y SQL idéntico al que genera Prisma.
- [ ] 3.2 `GET/PUT /me/correo` (persona de la sesión, sin feature), DTOs en `@yorga/contracts`; PUT valida con `normalizar` (400 si algo no vale). Verificación: test de que la ruta no acepta id de usuario, y prueba con curl en local de que cada persona solo ve lo suyo.
- [ ] 3.3 El trabajador aplica las preferencias al momento y prepara el resumen (`last_digest_at` como cerrojo diario), respetando el interruptor del admin. Verificación: prueba de punta a punta en local (Postgres embebido + buzón SMTP) con persona por defecto, sin menciones, solo un proyecto, prioridad mínima, resumen forzando la hora y el interruptor personal.

## 4. Web

- [ ] 4.1 Página `/perfil` (datos, «Cambiar contraseña», sección Correo) y el nombre del pie del menú como enlace. La sección Correo es un componente autocontenido (`PreferenciasCorreo`) que recibe por props el catálogo de tipos, los ámbitos (proyectos), la escala de niveles y el horario del resumen, para copiarlo tal cual a Atalaya. Verificación: Chromium en local, escritorio y móvil, sin errores de consola; guardar y recargar conserva lo elegido.
- [ ] 4.2 Comprobaciones completas. Verificación: `npm run typecheck && npm test && npm run build` en verde.

## 5. Merge del PR (caso B)

- [ ] 5.1 Abrir el PR con la clave TAREAS-28 y mergearlo (lo hace Pablo). El resumen de las 8:00 y la entrega real solo se comprueban en producción: el cambio se mergea abierto y se archiva después.

## 6. Verificación con el negocio (en producción, después del merge)

- [ ] 6.1 Criterio 1: entrar en «Mi perfil» desde el nombre del menú; sin tocar nada, los valores por defecto son asignación, mención y plazo, al momento.
- [ ] 6.2 Criterios 2 a 4: con el usuario de prueba (Gmail de Pablo), desactivar mención, activar comentarios, «solo un proyecto» y prioridad mínima; comprobar en el registro de envíos qué sale y qué no.
- [ ] 6.3 Criterio 5: poner el usuario de prueba en resumen; generarle avisos; comprobar que no salen sueltos y que el siguiente día laborable a las 8:00 llega un único resumen con los no leídos (y nada si se leyeron).
- [ ] 6.4 Criterios 6 y 7: interruptor personal apagado = sin correos de avisos; el enlace del pie abre «Mi perfil».
- [ ] 6.5 Criterio 8: comprobado por diseño (la ruta solo usa la sesión) y con una prueba con dos usuarios.
- [ ] 6.6 Dejar el resultado de cada criterio en TAREAS-28 y limpiar los datos de prueba.

## Workflow follow-up

- Archivar con `/sdd:cerrar tareas-28-preferencias-correo-persona` en un PR corto tras la verificación.
- Después: TAREAS-29 (reglas de correo por proyecto).
