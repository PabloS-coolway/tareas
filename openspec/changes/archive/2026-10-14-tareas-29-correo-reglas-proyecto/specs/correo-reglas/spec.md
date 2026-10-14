# Spec Delta

## Purpose

Que quien gestiona un proyecto pueda hacer que sus reglas manden un correo a personas concretas cuando saltan,
para que lo importante llegue aunque esas personas hayan bajado sus avisos por correo.

## ADDED Requirements

### Requirement: Acción «Enviar correo a» en las reglas
Las reglas de un proyecto SHALL poder tener la acción «Enviar correo a» con una lista de personas activas de la app,
independiente de «Avisar a». Solo quien gestiona proyectos SHALL poder añadirla o cambiarla, y la lista de reglas
SHALL mostrarla.

#### Scenario: Incidencia urgente en ATC
- **WHEN** quien gestiona proyectos añade «Enviar correo a: Catalina» a la regla «Incidencia urgente» de ATC
- **THEN** la regla se guarda y en la lista se lee «correo a Catalina»

#### Scenario: Sin permiso
- **WHEN** Robert, que no gestiona proyectos, intenta cambiar la regla
- **THEN** el sistema lo rechaza por falta de permiso

#### Scenario: Persona no válida
- **WHEN** se intenta guardar la acción con una persona desactivada o que no existe
- **THEN** no se guarda y se explica que alguna persona no es válida

### Requirement: Envío al saltar la regla
Cuando una regla con esta acción salta, el sistema SHALL encolar al momento un correo para cada persona de la lista
que esté activa, tenga correo y vea el proyecto; MUST NOT enviarse a las demás. El resto de acciones de la regla
SHALL seguir igual.

#### Scenario: Entra una incidencia urgente
- **WHEN** alguien crea en ATC una tarea con prioridad Urgente y la regla «Incidencia urgente» salta
- **THEN** Catalina recibe un correo en menos de 2 minutos, y la regla además asigna, avisa o etiqueta como antes

#### Scenario: Persona que no ve el proyecto
- **WHEN** la lista incluye a alguien que no pertenece a ningún equipo con acceso a ATC
- **THEN** a esa persona no se le envía el correo

### Requirement: La regla manda sobre las preferencias
El correo de una regla MUST enviarse aunque la persona tenga en «Mi perfil» desactivado ese tipo de aviso, el
proyecto excluido, una prioridad mínima mayor o el resumen diario, y siempre al momento. Solo MUST NOT enviarse si la
persona tiene apagado «Recibir avisos por correo» o el admin tiene apagados los avisos por correo.

#### Scenario: Catalina tiene ATC silenciado y está en resumen
- **WHEN** Catalina silenció ATC, está en resumen diario y salta la regla «Incidencia urgente»
- **THEN** le llega el correo al momento

#### Scenario: Interruptor personal apagado
- **WHEN** Catalina tiene apagado «Recibir avisos por correo» y salta la regla
- **THEN** no le llega el correo (sí el aviso en la campana, si la regla también avisa)

#### Scenario: El admin apaga los avisos por correo
- **WHEN** el interruptor general del admin está apagado y salta la regla
- **THEN** no sale ningún correo

### Requirement: Contenido del correo de una regla
El correo SHALL llevar en el asunto la clave y el título de la tarea, en el cuerpo el nombre de la regla, qué ha
pasado (se ha creado o ha pasado a un estado), la prioridad y el responsable, un botón que abre la tarea y, al pie,
por qué le llega y el enlace a «Mi perfil».

#### Scenario: Correo de la incidencia
- **WHEN** salta «Incidencia urgente» al crear ATC-31 «Sucursal Madrid sin datáfono» (Urgente, sin responsable)
- **THEN** el correo se titula «Regla «Incidencia urgente»: se ha creado ATC-31», dice Urgente y «sin responsable»,
  abre /t/ATC-31 y explica al pie que llega por esa regla del proyecto
