# Spec Delta

## Purpose

Que cada persona decida qué avisos de la app le llegan por correo, de qué proyectos, con qué prioridad mínima y si
al momento o en un resumen diario, desde su página «Mi perfil».

## ADDED Requirements

### Requirement: Página «Mi perfil»
El sistema SHALL ofrecer a cada persona con sesión una página «Mi perfil» con sus datos (nombre, correo y rol, sin
poder editarlos), el acceso a cambiar su contraseña y sus preferencias de correo. SHALL llegarse a ella desde el
menú («Mi perfil» y su nombre), desde el icono de persona de la barra del móvil y desde la página de Avisos.

#### Scenario: Catalina abre su perfil
- **WHEN** Catalina pulsa su nombre abajo en el menú
- **THEN** ve «Mi perfil» con su nombre, catalina@coolway.com, su rol y sus preferencias de correo

#### Scenario: Desde Avisos
- **WHEN** Robert está en Avisos y pulsa «Preferencias de correo»
- **THEN** se abre «Mi perfil»

### Requirement: Novedad en Inicio
El sistema SHALL enseñar en Inicio un aviso de novedad que explica que cada persona puede elegir qué avisos le
llegan por correo, con un botón a «Mi perfil». Al cerrarlo o al pulsar el botón, MUST NOT volver a salirle en ese
navegador.

#### Scenario: Catalina lo ve una vez
- **WHEN** Catalina entra en Inicio por primera vez tras el cambio y cierra la novedad
- **THEN** la próxima vez que entra en Inicio ya no la ve

### Requirement: Preferencias por defecto
Quien no haya cambiado sus preferencias SHALL tener el correo activado, solo los tipos asignación, mención y plazo
vencido, todos los proyectos, sin prioridad mínima y envío al momento, de modo que recibe lo mismo que antes de
existir las preferencias.

#### Scenario: Sin tocar nada
- **WHEN** David nunca ha abierto «Mi perfil» y le asignan COOL-211
- **THEN** le llega el correo al momento, como hasta ahora

### Requirement: Interruptor personal de avisos por correo
Cada persona SHALL poder apagar «Recibir avisos por correo»; apagado, MUST NOT enviársele ningún aviso por correo,
ni al momento ni en resumen. Los correos de cuenta (restablecer contraseña) SHALL seguir enviándose.

#### Scenario: Pablo Vázquez no quiere correos
- **WHEN** Pablo Vázquez apaga el interruptor y le asignan COOL-205
- **THEN** ve el aviso en la campana pero no recibe correo

#### Scenario: La contraseña sigue llegando
- **WHEN** con el interruptor apagado pide «He olvidado mi contraseña»
- **THEN** le llega el correo con el enlace

### Requirement: Tipos de aviso por correo
Cada persona SHALL poder activar o desactivar por separado el correo de cada tipo de aviso: asignación, mención,
plazo vencido, regla, comentario, cambio de estado, seguimiento y bloqueo resuelto. Solo se le envían por correo los
activados.

#### Scenario: Sin menciones
- **WHEN** Catalina desactiva «mención» y Pablo la menciona en COOL-204
- **THEN** ve el aviso en la campana pero no recibe correo

#### Scenario: Con comentarios
- **WHEN** Catalina activa «comentario» y David comenta en COOL-204, que tiene asignada
- **THEN** le llega un correo con el comentario

### Requirement: Filtro por proyectos
Cada persona SHALL poder recibir correo de todos los proyectos, solo de los que elija, o de todos menos los que
silencie. Un aviso de un proyecto excluido MUST NOT enviarse por correo.

#### Scenario: Solo ATC
- **WHEN** Catalina elige «solo estos proyectos: ATC» y le asignan COOL-204
- **THEN** no recibe correo; si le asignan una tarea de ATC, sí

#### Scenario: Silenciar Ulanka
- **WHEN** Robert silencia ULK y le asignan ULK-40 y COOL-230
- **THEN** recibe correo solo de COOL-230

### Requirement: Prioridad mínima
Cada persona SHALL poder elegir una prioridad mínima (Baja, Normal, Alta o Urgente); un aviso de una tarea con
prioridad menor MUST NOT enviarse por correo. Sin prioridad mínima, se envían todas.

#### Scenario: Solo lo importante
- **WHEN** Pablo Vázquez pone prioridad mínima «Alta» y le asignan COOL-207 (Baja) y COOL-206 (Urgente)
- **THEN** recibe correo solo de COOL-206

### Requirement: Cada uno solo ve y cambia lo suyo
Las preferencias de correo de una persona SHALL poder verlas y cambiarlas solo ella misma; MUST NOT poder hacerlo
otra persona, tampoco un admin.

#### Scenario: Un admin no puede
- **WHEN** Pablo (admin) intenta cambiar las preferencias de correo de Catalina
- **THEN** no hay forma de hacerlo: la app solo deja cambiar las propias
