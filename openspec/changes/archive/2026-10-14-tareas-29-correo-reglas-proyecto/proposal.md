Tarea: TAREAS-29 — Correo 3 · Reglas por proyecto: acción «enviar correo a…»
(https://tareas-yorga-ewv2n.ondigitalocean.app/t/TAREAS-29 · épica TAREAS-26)

## Why

Cada proyecto tiene Reglas (al crear una tarea o al pasar a un estado, con condiciones de tipo, prioridad o
etiqueta) que pueden asignar, añadir seguimiento o «avisar a» personas en la campana. Para lo urgente, la campana
no basta: quien gestiona el proyecto necesita que ciertas personas reciban un correo sí o sí, aunque hayan bajado
sus avisos por correo en «Mi perfil». Por ejemplo: «en ATC, cuando entra una incidencia urgente, correo a Catalina».

## What Changes

- Nueva acción en las Reglas de cada proyecto: **«Enviar correo a»**, una lista de **personas de la app** (se eligen
  del equipo, como en «Avisar a»). Es independiente de «Avisar a»: una regla puede hacer una, otra o las dos.
- Cuando la regla salta, cada persona de la lista recibe **al momento** un correo con el nombre de la regla, qué ha
  pasado (se ha creado la tarea o ha pasado a tal estado), la tarea (clave, título, prioridad y responsable) y el
  botón para abrirla. Al pie, por qué le llega («por la regla X del proyecto ATC»).
- **La regla manda sobre las preferencias** de «Mi perfil» (tipos, proyectos, prioridad mínima y resumen): el
  correo llega igual. Solo lo paran el interruptor personal «Recibir avisos por correo» y el interruptor general del
  admin.
- En la lista de reglas se ve la acción («correo a Catalina»).

## Capabilities

### New Capabilities
- `correo-reglas`: la acción «enviar correo a» de las reglas de proyecto: a quién, cuándo sale y qué lleva.

### Modified Capabilities
(ninguna: las preferencias de `correo-preferencias` no cambian; esta capacidad dice cuándo no se aplican)

## Criterios de aceptación

1. Quien gestiona proyectos abre las Reglas de ATC y, en la regla «Incidencia urgente» (al crear una tarea, prioridad
   Urgente), añade «Enviar correo a: Catalina». En la lista se ve «correo a Catalina».
2. Al crear en ATC una tarea urgente, Catalina recibe en menos de 2 minutos un correo con el nombre de la regla, la
   tarea y un botón que la abre; el resto de acciones de la regla siguen funcionando como antes.
3. Le llega aunque en «Mi perfil» tenga desactivado «Una regla del proyecto te avisa», tenga ATC silenciado, una
   prioridad mínima mayor o el resumen diario. No le llega si tiene apagado «Recibir avisos por correo».
4. Con los avisos por correo apagados por el admin, no sale ningún correo de reglas.
5. No se envía a personas desactivadas, sin correo o que no ven el proyecto.
6. Quien no gestiona proyectos no puede añadir ni cambiar esta acción (como el resto de las reglas).

## Fuera de alcance

- Direcciones de fuera de la app (partners, clientes, agencias): decidido por Pablo (14-oct-2026) dejarlo para más
  adelante.
- Nuevos disparadores o condiciones de las reglas (siguen: al crear y al pasar a un estado; tipo, prioridad,
  etiqueta y estado).
- Plantillas de correo por regla o texto libre en el correo.
- Mandar el correo a «el responsable» o «los seguidores» de la tarea en vez de a personas concretas.

## Impact

- **Quién lo nota:** quien gestiona proyectos (una acción más en Reglas) y las personas a las que se manda (correos
  que llegan aunque hayan bajado sus avisos). Atención al cliente es el caso principal (incidencias urgentes de ATC).
- **Herramientas:** Tareas Yorga (API y web). Ninguna tienda Shopify afectada.
- **Código:** acción `emailUserIds` en las reglas (las acciones se guardan en JSON: sin migración), validación,
  ejecución al saltar la regla, composición del correo y campo en la pantalla de Reglas.
- **Atalaya:** las reglas son de Tareas y viajan con su código; el envío usa el motor portable `@modulos/correo`.
