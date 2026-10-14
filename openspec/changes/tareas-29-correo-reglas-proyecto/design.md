# Design

## Context

- Las reglas (`automation_rule`) guardan condiciones y acciones como JSON con un catálogo cerrado
  (`RuleActionsDto`), validado en `RulesService.validar` y ejecutado en `TasksService.ejecutarReglas` después de
  guardar la tarea (fuera de transacciones): asigna, añade seguidores, prioridad, etiquetas y `notifyUserIds`
  (aviso RULE en la campana).
- El correo de avisos (TAREAS-27/28) sale del trabajador `AvisosPorCorreoService`, que lee avisos guardados y aplica
  las preferencias de cada persona. Las preferencias se guardan en `email_pref` (sin fila = por defecto).

## Goals / Non-Goals

**Goals:** acción «Enviar correo a» independiente de «Avisar a»; el correo sale al momento y por encima de las
preferencias, salvo el interruptor personal y el del admin.

**Non-Goals:** direcciones externas, destinatarios dinámicos (responsable o seguidores), plantillas por regla.

## Decisions

### 1. Nueva acción `emailUserIds` en `RuleActionsDto` (sin migración)
Las acciones ya son JSON. Se valida como `notifyUserIds`: ids limpios y todas las personas activas. Cuenta como
acción para «la regla no hace nada».

### 2. Encolar directamente al saltar, no a través de un aviso
`ejecutarReglas` ya corre después de guardar la tarea. Al saltar, para cada persona: activa, con email, que ve el
proyecto (`AccessService`), con el interruptor personal encendido (`email_pref.enabled`, por defecto encendido) y con
el interruptor del admin encendido → `ServicioCorreo.encolar` con tipo `aviso.regla-correo`. Al empezar por
`aviso.`, apagar el interruptor del admin descarta también los pendientes.

*Alternativa descartada:* crear un aviso y que lo mande el trabajador. Las preferencias lo filtrarían (que es
justo lo que la regla tiene que saltarse) y habría que distinguir «aviso RULE de campana» de «correo de regla».

Un fallo al encolar se registra y no rompe la regla (como el resto de `ejecutarReglas`).

### 3. Composición en el dominio de Tareas
`componerCorreoRegla(regla, tarea, evento, persona, marca)` en `tareas/domain/avisos-correo.ts`: asunto
«CLAVE · título», título «Regla «X»: se ha creado CLAVE» o «…: CLAVE ha pasado a Estado», prioridad y responsable,
botón a la tarea y nota al pie («Te llega por la regla «X» del proyecto Nombre.» + enlace a «Mi perfil»). Usa
`componer` del paquete (con `notaPie`). La etiqueta del asunto la añade `encolar`.

### 4. Pantalla de Reglas
Campo «Enviar correo a» con el mismo selector de personas que «Avisar a», una línea de ayuda («les llega aunque
hayan bajado sus avisos por correo; solo lo para su interruptor personal») y «correo a …» en el resumen de la regla.

## Risks / Trade-offs

- **Saltarse las preferencias** puede molestar: por eso solo lo configura quien gestiona proyectos, el pie explica
  el motivo y el interruptor personal sigue funcionando.
- **Reglas que saltan mucho** (p. ej. en cada cambio de estado) pueden generar mucho correo: es responsabilidad de
  quien las configura; el registro de envíos lo deja ver.

## Despliegue y vuelta atrás

1. Sin migración ni variables nuevas. Merge del PR → despliegue automático desde main.
2. Ninguna regla existente cambia: la acción nueva no la tiene nadie hasta que se añada.
3. **Vuelta atrás rápida:** quitar la acción de la regla, o apagar los avisos por correo del admin. **Completa:**
   revertir el PR; las reglas que la tengan simplemente la ignoran (el JSON se conserva).
