Tarea: TAREAS-27 — Correo 1 · Envío: proveedor configurable desde el panel, cola y registro
(https://tareas-yorga-ewv2n.ondigitalocean.app/t/TAREAS-27 · épica TAREAS-26)

## Why

Tareas solo avisa dentro de la app: si no la abres, no te enteras de que te han asignado algo, te han mencionado
o se ha pasado el plazo de una incidencia. Además, «He olvidado mi contraseña» no manda nada en producción (no hay
servidor de correo configurado) y depende de que un admin la cambie a mano. Queremos que Tareas envíe correo con el
proveedor que elijamos desde el panel, sin tocar variables de entorno, y hacerlo como un módulo que luego se pueda
llevar tal cual a Atalaya (la versión marca blanca).

## What Changes

- Nueva pantalla de admin **Correo** (en el menú de administración, junto a Integraciones):
  - proveedor: **Brevo** (por su API) o **SMTP** (un buzón del propio dominio u otro servidor);
  - clave del proveedor (o URL del servidor SMTP), remitente (nombre y dirección) y dirección de respuesta opcional;
  - datos de la marca para las plantillas: nombre de la app, URL pública y pie del correo;
  - interruptor **«Enviar avisos por correo»**;
  - botón **«Enviar correo de prueba»**;
  - **registro** de los últimos correos: a quién, asunto, estado (pendiente, enviado, fallido) y el error si lo hubo.
- La clave del proveedor se guarda **cifrada**; después de guardarla solo se ven sus últimos 4 caracteres.
- Los correos salen de una **cola**: se envían en segundo plano, con reintentos si el proveedor falla, sin bloquear
  ni romper lo que hace la persona en la app.
- Con el interruptor activado, llegan por correo **tres avisos**: te asignan una tarea, te mencionan en un
  comentario, y vence el plazo de respuesta de una incidencia. Cada correo lleva el texto del aviso y un botón que
  abre la tarea.
- «He olvidado mi contraseña» envía el enlace por el proveedor configurado. Si no hay correo configurado, sigue como
  hoy: avisa a los admins en la app.
- Todo el motor de correo vive en un paquete propio y sin marca (`packages/correo`), preparado para guardar una
  configuración por «propietario» (Tareas usa uno; Atalaya, uno por empresa).

## Capabilities

### New Capabilities
- `correo-envio`: configuración del proveedor desde el panel, guardado seguro de la clave, correo de prueba, cola
  con reintentos y registro de envíos.
- `correo-avisos`: qué avisos de la app se envían también por correo, a quién y con qué contenido.
- `restablecer-contrasena`: cómo llega a la persona el enlace para poner una contraseña nueva.

### Modified Capabilities
(ninguna: no hay especificaciones vivas todavía en este repo)

## Criterios de aceptación

1. Un admin entra en **Correo**, elige Brevo (o SMTP), pega la clave y el remitente,
   pulsa «Enviar correo de prueba» y el correo le llega a su buzón.
2. Al volver a la pantalla, la clave no se ve entera: solo «••••» y sus últimos 4 caracteres.
3. Con «Enviar avisos por correo» activado, cuando alguien asigna COOL-203 a Catalina, a ella le llega en menos de
   2 minutos un correo con el título de la tarea y un botón que la abre. Igual cuando la mencionan en un comentario
   y cuando vence el plazo de respuesta de una incidencia de ATC de la que es responsable.
4. Quien hace la acción no recibe correo de su propia acción (como pasa con los avisos de la app).
5. Si el proveedor falla (por ejemplo, la clave es incorrecta), la app sigue funcionando con normalidad; el registro
   muestra el error, se reintenta y, tras varios intentos, queda como «fallido».
6. «He olvidado mi contraseña» manda el enlace por el proveedor configurado y el enlace funciona.
7. Al desactivar «Enviar avisos por correo», dejan de salir correos de avisos (el de la contraseña sigue saliendo).

## Fuera de alcance

- Preferencias de cada persona (qué avisos quiere, filtros, resumen diario): es TAREAS-28. Hasta entonces el
  único freno es el interruptor general del admin.
- Correos por reglas de proyecto («enviar correo a…»): es TAREAS-29.
- Otros avisos por correo (comentarios, cambios de estado, seguimiento, bloqueo resuelto, reglas).
- Varias configuraciones a la vez (una por empresa): el paquete lo admite, pero Tareas usa una sola.
- Editor de plantillas, adjuntos, seguimiento de aperturas o rebotes, y correos de marketing o campañas.
- SendGrid y Mailchimp Transactional: se descartan porque ya no tienen plan gratuito (SendGrid solo da una prueba de
  60 días; Mailchimp Transactional es un complemento de pago). El paquete permite añadir otro proveedor más adelante
  sin tocar el resto.

## Impact

- **Quién lo nota:** todo el equipo que usa Tareas (Robert, Juanmi, Pablo Vázquez, Catalina, Gemma, David, Tomás…)
  empezará a recibir correos de asignaciones, menciones y plazos en cuanto un admin active el interruptor. Atención al
  cliente se entera antes de las incidencias que vencen. El admin gana una pantalla nueva.
- **Herramientas:** Tareas Yorga (API y web). Ninguna tienda Shopify se ve afectada.
- **Fuera del repo:** hace falta una cuenta de Brevo (plan gratuito: 300 correos al día, sin tarjeta) con el dominio del remitente verificado, y una variable de entorno nueva en DigitalOcean con la
  clave maestra para cifrar.
- **Código:** paquete nuevo `packages/correo`; tablas nuevas para la configuración y la cola; nueva pantalla de admin;
  cambio en «He olvidado mi contraseña»; el Dockerfile compila el paquete nuevo.
- **Atalaya:** el paquete se copia tal cual; allí se implementa el almacenamiento por empresa.
