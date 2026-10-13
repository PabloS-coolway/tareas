# Spec Delta

## Purpose

Qué avisos de la app llegan también por correo, a quién y con qué contenido, para que nadie se pierda lo
importante aunque no tenga Tareas abierto.

## ADDED Requirements

### Requirement: Interruptor general de avisos por correo
El sistema SHALL tener un interruptor «Enviar avisos por correo», apagado por defecto, que solo puede cambiar quien
gestiona usuarios. Con el interruptor apagado o sin correo configurado, MUST NOT enviarse ningún aviso por correo.
Al encenderlo SHALL NOT enviarse avisos anteriores a ese momento.

#### Scenario: Recién configurado
- **WHEN** el admin configura Brevo pero no enciende el interruptor
- **THEN** no sale ningún correo de avisos (sí el de prueba y el de la contraseña)

#### Scenario: Se enciende con avisos antiguos
- **WHEN** el admin enciende el interruptor y Catalina tiene 40 avisos de asignación sin leer de la semana pasada
- **THEN** no le llega ningún correo por esos avisos antiguos; solo por los que se generen a partir de ahora

#### Scenario: Se apaga
- **WHEN** el admin apaga el interruptor
- **THEN** dejan de salir correos de avisos, incluidos los que aún no se habían enviado

### Requirement: Avisos que se envían por correo
Con el interruptor encendido, el sistema SHALL enviar por correo a la persona avisada estos tres avisos, y solo
estos: le asignan una tarea, la mencionan en un comentario, y vence el plazo de respuesta de una tarea que tiene que
atender. MUST NOT enviarse por correo a quien hizo la acción, ni a personas desactivadas o sin dirección de correo.

#### Scenario: Asignación
- **WHEN** David asigna COOL-203 «Badges de descuento en cards y PDP» a Catalina
- **THEN** a Catalina le llega un correo en menos de 2 minutos; a David no

#### Scenario: Mención
- **WHEN** Pablo escribe en COOL-205 un comentario con «@Pablo Vázquez revisa el LCP de la PDP»
- **THEN** a Pablo Vázquez le llega un correo con la mención

#### Scenario: Plazo de respuesta vencido
- **WHEN** vence el plazo de respuesta de una incidencia de ATC que entró por el formulario de sucursal
- **THEN** a las personas que reciben ese aviso en la app les llega también por correo

#### Scenario: Otros avisos
- **WHEN** alguien comenta en una tarea que Robert sigue, o cambia su estado
- **THEN** Robert lo ve en la campana de la app, pero no recibe correo

### Requirement: Contenido del correo de un aviso
Cada correo de aviso SHALL llevar en el asunto la clave y el título de la tarea, en el cuerpo el mismo texto que el
aviso de la app (quién y qué), un botón que abre la tarea en la URL pública configurada, y el nombre y pie de la app
configurados. MUST NOT incluir datos de tareas de proyectos que la persona no puede ver.

#### Scenario: Abrir desde el correo
- **WHEN** Catalina pulsa «Abrir tarea» en el correo de la asignación de COOL-203
- **THEN** se abre https://tareas-yorga-ewv2n.ondigitalocean.app/t/COOL-203
