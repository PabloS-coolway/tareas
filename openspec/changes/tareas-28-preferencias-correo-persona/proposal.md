Tarea: TAREAS-28 — Correo 2 · Preferencias de cada persona: qué avisos le llegan por correo
(https://tareas-yorga-ewv2n.ondigitalocean.app/t/TAREAS-28 · épica TAREAS-26)

## Why

Desde TAREAS-27 todo el equipo recibe por correo sus asignaciones, menciones y plazos vencidos, y nadie puede
cambiarlo: o todo o nada (el interruptor del admin). Cada persona necesita decidir qué le llega, de qué proyectos
y cuándo, para que el correo le sirva y no le llene el buzón.

## What Changes

- Nueva página **«Mi perfil»** (se llega pulsando tu nombre abajo en el menú), con tus datos, el botón de cambiar
  contraseña y una sección **«Correo»** con tus preferencias:
  - **interruptor general** «Recibir avisos por correo» (apagarlo = ningún aviso por correo);
  - **qué avisos**, uno a uno: te asignan una tarea, te mencionan, vence un plazo de respuesta, una regla te avisa,
    comentan en una tarea tuya, cambia el estado, te añaden al seguimiento, se termina lo que te bloqueaba. Por
    defecto, solo los tres que ya llegan hoy (asignación, mención y plazo);
  - **de qué proyectos**: todos, solo unos concretos, o todos menos unos silenciados;
  - **prioridad mínima** de la tarea (p. ej. solo Alta y Urgente);
  - **cuándo**: al momento, o un **resumen diario** de lunes a viernes a las 8:00 (hora de Madrid) con los avisos
    que sigan sin leer en la app.
- Quien no toque nada sigue recibiendo exactamente lo mismo que hoy.
- Los correos de avisos llevan al pie un enlace «Cambia qué correos recibes» que abre «Mi perfil».
- El interruptor del admin en «Correo» sigue mandando sobre todo: si está apagado, no sale ningún aviso para nadie.

## Capabilities

### New Capabilities
- `correo-preferencias`: preferencias de correo de cada persona (interruptor, tipos, proyectos, prioridad mínima,
  al momento o resumen) y la página «Mi perfil» donde se cambian.
- `correo-resumen-diario`: el correo de resumen de lunes a viernes a las 8:00 con los avisos sin leer.

### Modified Capabilities
- `correo-avisos`: «Avisos que se envían por correo» deja de ser una lista fija de tres tipos: depende de las
  preferencias de cada persona (con esos tres como valor por defecto). El contenido del correo añade el enlace a
  «Mi perfil».

## Criterios de aceptación

1. Catalina pulsa su nombre abajo en el menú, entra en «Mi perfil» y ve sus preferencias de correo; sin haber tocado
   nada, tiene activados asignación, mención y plazo vencido, y recibe lo mismo que hasta ahora.
2. Si Catalina desactiva «mención», deja de recibir el correo cuando la mencionan (el aviso sigue en la campana).
   Si activa «comentarios», recibe un correo cuando alguien comenta en una tarea que sigue o le han asignado.
3. Si Catalina deja solo el proyecto ATC, no le llegan correos de tareas de COOL; si silencia ULK, no le llegan los
   de ULK y sí los demás.
4. Con prioridad mínima «Alta», una asignación de una tarea Normal no le llega por correo y la de una Urgente sí.
5. Con «resumen diario», no recibe correos sueltos de avisos; un día laborable a las 8:00 recibe un único correo con
   los avisos que sigan sin leer, con un enlace a cada tarea. Si no hay ninguno sin leer, no recibe nada; sábados y
   domingos no hay resumen (el del lunes incluye el fin de semana).
6. Con «Recibir avisos por correo» apagado, no recibe ningún aviso por correo (el de «He olvidado mi contraseña» sí).
7. Desde el pie de cualquier correo de aviso, «Cambia qué correos recibes» abre su «Mi perfil».
8. Nadie puede ver ni cambiar las preferencias de otra persona, tampoco un admin.

## Fuera de alcance

- Elegir la hora o los días del resumen (es fijo: L-V 8:00, hora de Madrid) y tener en cuenta festivos.
- Cambiar qué se ve en la campana de la app: las preferencias solo afectan al correo.
- Que un admin cambie las preferencias de otras personas.
- Darse de baja con un clic sin iniciar sesión (el enlace lleva a «Mi perfil», que pide sesión).
- Correos por reglas de proyecto («enviar correo a…»): es TAREAS-29.
- Editar en «Mi perfil» el nombre o el correo de la cuenta (siguen gestionándolos los admins).

## Impact

- **Quién lo nota:** todo el equipo que usa Tareas (y quien use Atalaya después): cada uno controla su correo. Quien
  esté saturado puede pasar al resumen de las 8:00 o silenciar proyectos. Sin tocar nada, nadie nota diferencia.
- **Herramientas:** Tareas Yorga (API y web). Ninguna tienda Shopify afectada.
- **Código:** tabla nueva de preferencias (una fila por persona, solo si cambia algo), el trabajador de avisos por
  correo aplica las preferencias y prepara el resumen, rutas `/me/correo`, página «Mi perfil» y enlace desde el
  menú. Una migración que solo añade.
- **Atalaya (decisión de Pablo, 14-oct-2026: modular):** las reglas de preferencias y del resumen van en el paquete
  portable `@modulos/correo`, de forma genérica: tipos de aviso definidos por cada app, «ámbitos» (en Tareas, los
  proyectos), «niveles» ordenados (en Tareas, la prioridad) y horario del resumen como parámetro (zona, hora y días;
  en Atalaya, por empresa). Tareas solo aporta su catálogo, el almacenamiento con Prisma y la pantalla.
