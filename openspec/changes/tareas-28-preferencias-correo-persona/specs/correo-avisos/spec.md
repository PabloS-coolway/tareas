# Spec Delta

## MODIFIED Requirements

### Requirement: Avisos que se envían por correo
Con el interruptor encendido, el sistema SHALL enviar por correo a la persona avisada los avisos de los tipos que
tenga activados en sus preferencias, de los proyectos y prioridades que haya elegido; por defecto, solo: le asignan
una tarea, la mencionan en un comentario, y vence el plazo de respuesta de una tarea que tiene que atender. MUST NOT
enviarse por correo a quien hizo la acción, ni a personas desactivadas o sin dirección de correo.

#### Scenario: Asignación
- **WHEN** David asigna COOL-203 «Badges de descuento en cards y PDP» a Catalina, que no ha cambiado sus preferencias
- **THEN** a Catalina le llega un correo en menos de 2 minutos; a David no

#### Scenario: Mención
- **WHEN** Pablo escribe en COOL-205 un comentario con «@Pablo Vázquez revisa el LCP de la PDP»
- **THEN** a Pablo Vázquez le llega un correo con la mención, si tiene activadas las menciones

#### Scenario: Plazo de respuesta vencido
- **WHEN** vence el plazo de respuesta de una incidencia de ATC que entró por el formulario de sucursal
- **THEN** a las personas que reciben ese aviso en la app y tienen activado ese tipo les llega también por correo

#### Scenario: Otros avisos
- **WHEN** alguien comenta en una tarea que Robert sigue, o cambia su estado, y Robert no ha activado esos tipos
- **THEN** Robert lo ve en la campana de la app, pero no recibe correo

#### Scenario: Otros avisos, activados
- **WHEN** Robert activa «comentarios» en «Mi perfil» y alguien comenta en una tarea que sigue
- **THEN** a Robert le llega un correo con el comentario

### Requirement: Contenido del correo de un aviso
Cada correo de aviso SHALL llevar en el asunto la clave y el título de la tarea, en el cuerpo el mismo texto que el
aviso de la app (quién y qué), un botón que abre la tarea en la URL pública configurada, el nombre y pie de la app
configurados, y un enlace «Cambia qué correos recibes» a «Mi perfil». MUST NOT incluir datos de tareas de proyectos
que la persona no puede ver.

#### Scenario: Abrir desde el correo
- **WHEN** Catalina pulsa «Abrir tarea» en el correo de la asignación de COOL-203
- **THEN** se abre https://tareas-yorga-ewv2n.ondigitalocean.app/t/COOL-203

#### Scenario: Cambiar qué correos recibe
- **WHEN** Catalina pulsa «Cambia qué correos recibes» al pie de un correo de aviso
- **THEN** se abre su página «Mi perfil» (tras iniciar sesión si no la tenía abierta)
