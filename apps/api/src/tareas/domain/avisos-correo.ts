import { componer, type AvisoFiltrable, type CatalogoAvisos, type HorarioResumen, type Marca, type MensajeCorreo } from '@modulos/correo';
import type { Priority } from '@yorga/contracts';

/**
 * Tipos de aviso de Tareas que pueden ir por correo, con su nombre en la pantalla y si vienen activados para quien
 * no ha tocado nada (asignación, mención y plazo: lo que llegaba antes de las preferencias). PASSWORD_RESET no está:
 * es para admins y no depende de preferencias.
 */
export const CATALOGO_AVISOS: CatalogoAvisos = [
  { clave: 'ASSIGNED', etiqueta: 'Te asignan una tarea', porDefecto: true },
  { clave: 'MENTION', etiqueta: 'Te mencionan en un comentario', porDefecto: true },
  { clave: 'SLA', etiqueta: 'Vence el plazo de respuesta de una incidencia', porDefecto: true },
  { clave: 'RULE', etiqueta: 'Una regla del proyecto te avisa', porDefecto: false },
  { clave: 'COMMENT', etiqueta: 'Comentan en una tarea tuya o que sigues', porDefecto: false },
  { clave: 'STATUS', etiqueta: 'Cambia el estado de una tarea tuya o que sigues', porDefecto: false },
  { clave: 'FOLLOW', etiqueta: 'Te añaden al seguimiento de una tarea', porDefecto: false },
  { clave: 'BLOCKER_DONE', etiqueta: 'Se termina una tarea que te bloqueaba', porDefecto: false },
];

/** Tipo de cada aviso en la cola de correo (para el registro). */
export const TIPO_EN_COLA: Record<string, string> = {
  ASSIGNED: 'aviso.asignada',
  MENTION: 'aviso.mencion',
  SLA: 'aviso.plazo',
  RULE: 'aviso.regla',
  COMMENT: 'aviso.comentario',
  STATUS: 'aviso.estado',
  FOLLOW: 'aviso.seguimiento',
  BLOCKER_DONE: 'aviso.desbloqueo',
};
export const TIPO_RESUMEN = 'aviso.resumen';

/** Escala de niveles para el «nivel mínimo»: la prioridad de la tarea, de menos a más. */
export const ESCALA_PRIORIDAD: readonly Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const nivelDePrioridad = (p: Priority): number => ESCALA_PRIORIDAD.indexOf(p);

/** El resumen diario de Tareas: de lunes a viernes a las 8:00, hora de Madrid. */
export const HORARIO_RESUMEN: HorarioResumen = { zona: 'Europe/Madrid', hora: 8, dias: [1, 2, 3, 4, 5] };

/** ¿Es un aviso de tarea que puede ir por correo? (cuál va de verdad lo deciden las preferencias de cada persona) */
export function vaPorCorreo(tipo: string): boolean {
  return Object.prototype.hasOwnProperty.call(TIPO_EN_COLA, tipo);
}

export interface AvisoParaCorreo {
  tipo: string;
  /** El texto del aviso de la app («te asignó COOL-12 · …»). */
  texto: string;
  actor: string | null;
  destinatario: { email: string; nombre: string; activo: boolean };
  tarea: { clave: string; titulo: string; projectId: number; prioridad: Priority } | null;
}

/** El aviso en el lenguaje del módulo de preferencias: el proyecto es el ámbito y la prioridad, el nivel. */
export function avisoFiltrable(a: AvisoParaCorreo): AvisoFiltrable {
  return { tipo: a.tipo, ambitoId: a.tarea?.projectId ?? null, nivel: a.tarea ? nivelDePrioridad(a.tarea.prioridad) : null };
}

/**
 * Por qué NO se envía un aviso por correo, o null si se envía. `proyectosVisibles` = proyectos que ve el
 * destinatario (null = todos).
 */
export function motivoParaNoEnviar(a: AvisoParaCorreo, proyectosVisibles: number[] | null): string | null {
  if (!vaPorCorreo(a.tipo)) return 'este aviso no va por correo';
  if (!a.destinatario.activo) return 'persona desactivada';
  if (!a.destinatario.email?.includes('@')) return 'sin dirección de correo';
  if (a.tarea && proyectosVisibles !== null && !proyectosVisibles.includes(a.tarea.projectId)) return 'no ve el proyecto';
  return null;
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «David te asignó COOL-12 · …»: la frase del aviso, igual que en la campana. */
export function fraseDelAviso(a: Pick<AvisoParaCorreo, 'actor' | 'texto'>): string {
  return a.actor ? `${a.actor} ${a.texto}` : mayuscula(a.texto);
}

/** El correo de un aviso: asunto con clave y título, el mismo texto que en la app, botón a la tarea y enlace a «Mi perfil». */
export function componerAviso(a: AvisoParaCorreo, marca: Marca): MensajeCorreo {
  const frase = fraseDelAviso(a);
  const asunto = a.tarea ? `${a.tarea.clave} · ${a.tarea.titulo}` : frase;
  const { html, texto } = componer(marca, {
    titulo: frase,
    parrafos: [`Hola ${a.destinatario.nombre}, tienes un aviso nuevo en ${marca.nombre}.`],
    boton: a.tarea ? { texto: 'Abrir tarea', url: `${marca.url}/t/${a.tarea.clave}` } : { texto: 'Ver mis avisos', url: `${marca.url}/avisos` },
    notaPie: { texto: 'Cambia qué correos recibes', url: `${marca.url}/perfil` },
  });
  return { para: a.destinatario.email, asunto: asunto.slice(0, 200), html, texto, tipo: TIPO_EN_COLA[a.tipo] ?? 'aviso' };
}
