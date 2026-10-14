# correo-resumen-diario Specification

## Purpose
Que quien prefiera no recibir correos sueltos reciba un único correo los días laborables por la mañana con los
avisos que sigan pendientes de leer.

## Requirements

### Requirement: Elegir resumen diario
Cada persona SHALL poder elegir recibir sus avisos por correo «al momento» o en un «resumen diario». Con resumen,
MUST NOT enviársele correos sueltos de avisos.

#### Scenario: Catalina pasa al resumen
- **WHEN** Catalina elige «resumen diario» y a las 11:00 le asignan COOL-204
- **THEN** no recibe un correo a las 11:00; el aviso irá en el resumen del día siguiente

### Requirement: Cuándo y qué lleva el resumen
El resumen SHALL enviarse de lunes a viernes a las 8:00 (hora de Madrid) con los avisos de los tipos, proyectos y
prioridades que la persona tiene activados, posteriores al resumen anterior y que sigan sin leer en la app, cada uno
con un enlace a su tarea. Sin avisos que incluir, MUST NOT enviarse.

#### Scenario: Martes por la mañana
- **WHEN** el lunes a Catalina le asignaron COOL-204 y la mencionaron en ATC-12, y solo ha leído la mención
- **THEN** el martes a las 8:00 recibe un resumen con la asignación de COOL-204 y un enlace a la tarea

#### Scenario: Todo leído
- **WHEN** Catalina leyó en la app todos sus avisos del día anterior
- **THEN** el día siguiente no recibe resumen

#### Scenario: Fin de semana
- **WHEN** el sábado le asignan COOL-230
- **THEN** el sábado y el domingo no hay resumen; el aviso va en el del lunes a las 8:00, si sigue sin leer

### Requirement: Un solo resumen por día
El sistema SHALL enviar como mucho un resumen al día por persona, aunque la API se reinicie.

#### Scenario: Reinicio a las 8:05
- **WHEN** el resumen ya salió a las 8:00 y la API se reinicia a las 8:05
- **THEN** no se envía un segundo resumen ese día
