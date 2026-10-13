# Spec Delta

## Purpose

Que la app pueda enviar correo con el proveedor que elija un administrador desde el panel (Brevo o SMTP), guardando la clave de forma segura, y que cada envío sea fiable y quede registrado.

## ADDED Requirements

### Requirement: Configuración del proveedor desde el panel
El sistema SHALL permitir a quien gestiona usuarios elegir el proveedor de correo (Brevo o
SMTP), su credencial (clave de API o URL del servidor SMTP), el remitente (nombre y dirección), una dirección de
respuesta opcional y los datos de marca de las plantillas (nombre de la app, URL pública y pie). Nadie sin ese
permiso SHALL poder ver ni cambiar esta configuración.

#### Scenario: Pablo configura Brevo
- **WHEN** Pablo (admin) elige Brevo, pega la clave `xkeysib-…`, pone el remitente «Tareas Yorga <tareas@coolway.com>» y guarda
- **THEN** la configuración queda guardada y la pantalla indica que el correo está configurado

#### Scenario: Una persona sin permiso intenta verla
- **WHEN** Catalina (rol miembro) pide la configuración de correo
- **THEN** el sistema la rechaza por falta de permiso y no devuelve ningún dato

#### Scenario: Datos incompletos
- **WHEN** el admin intenta guardar Brevo sin clave o con un remitente que no es una dirección válida
- **THEN** el sistema no guarda nada y explica qué falta

### Requirement: Etiqueta en el asunto
El sistema SHALL permitir configurar una etiqueta opcional (máximo 30 caracteres) que se pone delante del asunto de
todos los correos que envía la app (avisos, contraseña y prueba), para que quien los recibe pueda filtrarlos o
redirigirlos con una regla de su correo. Sin etiqueta, el asunto queda tal cual.

#### Scenario: Pablo filtra los correos de Tareas
- **WHEN** el admin pone la etiqueta «[Tareas]» y después asignan COOL-203 a Catalina
- **THEN** el correo llega con el asunto «[Tareas] COOL-203 · Badges de descuento en cards y PDP»

#### Scenario: Sin etiqueta
- **WHEN** la etiqueta está vacía
- **THEN** el asunto es «COOL-203 · Badges de descuento en cards y PDP»

### Requirement: La credencial nunca se vuelve a mostrar
El sistema SHALL guardar la credencial del proveedor cifrada y MUST NOT devolverla entera por ninguna vía después
de guardarla: solo SHALL mostrar que existe y, si es una clave de API, sus últimos 4 caracteres. De una URL SMTP
MUST NOT mostrar ningún carácter, porque lleva la contraseña de un buzón. Para cambiar otros datos SHALL NOT hacer
falta volver a escribirla.

#### Scenario: Volver a la pantalla
- **WHEN** el admin vuelve a abrir la pantalla de correo tras guardar la clave de Brevo
- **THEN** ve «••••» seguido de los últimos 4 caracteres de la clave, y nunca la clave entera

#### Scenario: Buzón por SMTP
- **WHEN** el admin vuelve a la pantalla tras guardar la URL SMTP con la contraseña del buzón de Pablo
- **THEN** ve solo «••••», sin ningún carácter de la contraseña

#### Scenario: Cambiar solo el remitente
- **WHEN** el admin cambia el nombre del remitente sin tocar el campo de la clave y guarda
- **THEN** la clave guardada se mantiene y los envíos siguen funcionando

#### Scenario: Falta la clave maestra del servidor
- **WHEN** el servidor no tiene configurada la clave maestra de cifrado y el admin intenta guardar una credencial
- **THEN** el sistema no guarda la credencial y avisa de que falta configurar el servidor

### Requirement: Correo de prueba
El sistema SHALL permitir al admin enviar un correo de prueba a la dirección que indique (por defecto, la suya) con
la configuración guardada, y SHALL decirle al momento si el proveedor lo aceptó o el error que devolvió.

#### Scenario: Prueba correcta
- **WHEN** Pablo pulsa «Enviar correo de prueba» con Brevo bien configurado
- **THEN** la pantalla confirma que se ha enviado y el correo llega a pablo.silva@coolway.com

#### Scenario: Clave incorrecta
- **WHEN** el admin prueba con una clave de Brevo revocada
- **THEN** la pantalla muestra el error del proveedor y no se da el correo por enviado

### Requirement: Envío en segundo plano con reintentos
Los correos SHALL encolarse y enviarse en segundo plano, de modo que un fallo o lentitud del proveedor MUST NOT
hacer fallar ni retrasar la acción de la persona en la app. Un envío fallido SHALL reintentarse con esperas
crecientes y, tras agotar los intentos, SHALL quedar como fallido con el último error.

#### Scenario: El proveedor está caído
- **WHEN** Brevo no responde en el momento en que a Robert le asignan COOL-205
- **THEN** la asignación se guarda con normalidad y el correo queda pendiente y se reintenta más tarde

#### Scenario: Se agotan los intentos
- **WHEN** un correo falla en todos sus intentos
- **THEN** queda como «fallido» con el último error y no se vuelve a intentar

### Requirement: Registro de envíos
El sistema SHALL mostrar al admin los últimos correos con destinatario, asunto, estado (pendiente, enviado o
fallido), número de intentos, fecha y error si lo hubo. Los registros de más de 90 días SHALL borrarse.

#### Scenario: Revisar qué ha salido
- **WHEN** el admin abre el registro tras una mañana de asignaciones
- **THEN** ve cada correo con su estado, y los fallidos con el motivo

### Requirement: Compatibilidad con el SMTP por variables de entorno
Mientras no haya configuración guardada en el panel, el sistema SHALL seguir usando el servidor SMTP definido en
las variables de entorno, si lo hay. En cuanto se guarde una configuración en el panel, SHALL usar esa.

#### Scenario: Sin configurar en el panel
- **WHEN** nadie ha configurado el correo en el panel y el servidor tiene SMTP_URL y MAIL_FROM
- **THEN** los correos salen por ese SMTP como hasta ahora
