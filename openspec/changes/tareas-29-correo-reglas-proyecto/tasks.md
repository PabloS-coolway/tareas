# Tasks

## 1. Rama

- [x] 1.1 Crear la rama `feat/TAREAS-29-correo-reglas` desde main con este cambio dentro. Verificación: `git branch --show-current`.

## 2. Dominio y API

- [x] 2.1 `emailUserIds` en `RuleActionsDto` y validación en `RulesService` (ids limpios, personas activas, cuenta como acción). Verificación: test de la validación (persona desactivada → 400; solo esta acción → válida).
- [x] 2.2 `componerCorreoRegla` en el dominio (asunto, título según disparador, prioridad, responsable, botón y nota al pie). Verificación: tests jest de ambos disparadores y del escapado.
- [x] 2.3 En `ejecutarReglas`, encolar el correo para cada persona activa, con email, que ve el proyecto y con su interruptor personal y el del admin encendidos; un fallo no rompe la regla. Verificación: prueba de punta a punta en local (Postgres embebido + buzón SMTP) con una regla «al crear, Urgente»: llega a quien toca, también con preferencias que lo excluirían; no llega con el interruptor personal o el del admin apagados, ni a quien no ve el proyecto.

## 3. Web

- [x] 3.1 Campo «Enviar correo a» en la pantalla de Reglas, con ayuda, y «correo a …» en el resumen de la regla. Verificación: Chromium en local (crear la regla, ver el resumen, editar y quitarla), sin errores de consola.
- [x] 3.2 Comprobaciones completas. Verificación: `npm run typecheck && npm test && npm run build`.

## 4. Merge del PR (caso B)

- [ ] 4.1 Abrir el PR con la clave TAREAS-29 y mergearlo (lo hace Pablo). La entrega real se comprueba en producción.

## 5. Verificación con el negocio (en producción, después del merge)

- [ ] 5.1 Criterios 1 y 2: en un proyecto de prueba o ATC, regla «al crear, Urgente» con «Enviar correo a» el usuario de prueba (Gmail de Pablo); crear una tarea urgente y comprobar que llega con el nombre de la regla y el botón.
- [ ] 5.2 Criterio 3: con el usuario de prueba en resumen y el proyecto silenciado, llega igual; con su interruptor personal apagado, no.
- [ ] 5.3 Criterios 4 a 6: comprobados en local y por permisos (la pantalla de Reglas ya exige gestionar proyectos).
- [ ] 5.4 Dejar el resultado en TAREAS-29 y limpiar la regla y el usuario de prueba.

## Workflow follow-up

- Archivar con `/sdd:cerrar tareas-29-correo-reglas-proyecto` en un PR corto tras la verificación.
- Con esto se cierra la épica TAREAS-26.
