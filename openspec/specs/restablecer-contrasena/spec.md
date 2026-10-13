# restablecer-contrasena Specification

## Purpose
Cómo recupera el acceso una persona que ha olvidado su contraseña: por correo si hay correo configurado, o con
ayuda de un admin si no.

## Requirements

### Requirement: Enlace de restablecimiento por correo
Cuando una persona activa pide restablecer su contraseña y hay correo configurado (en el panel o por variables de
entorno), el sistema SHALL enviarle un enlace de un solo uso que caduca en 1 hora, usando el proveedor configurado.
El sistema MUST NOT revelar si la dirección existe.

#### Scenario: Catalina olvida su contraseña
- **WHEN** Catalina pide restablecer la contraseña de catalina@coolway.com con Brevo configurado
- **THEN** le llega un correo con el enlace, y con él puede poner una contraseña nueva

#### Scenario: Dirección que no existe
- **WHEN** alguien pide restablecer la contraseña de noexiste@coolway.com
- **THEN** la pantalla responde igual que si existiera y no se envía nada

### Requirement: Sin correo, avisa a los admins
Si no hay correo configurado, el sistema SHALL avisar en la app a los admins activos de que esa persona pidió
restablecer su contraseña, como hasta ahora.

#### Scenario: Sin proveedor
- **WHEN** Alfonso pide restablecer su contraseña y no hay correo configurado
- **THEN** los admins ven un aviso en la app para ponerle una contraseña temporal
