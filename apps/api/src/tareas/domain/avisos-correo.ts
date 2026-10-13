import { componer, type Marca, type MensajeCorreo } from '@modulos/correo';

/** Avisos de la app que también van por correo (TAREAS-27), con su tipo en la cola. */
export const AVISOS_POR_CORREO = { ASSIGNED: 'aviso.asignada', MENTION: 'aviso.mencion', SLA: 'aviso.plazo' } as const;
export type TipoAvisoCorreo = keyof typeof AVISOS_POR_CORREO;

export function vaPorCorreo(tipo: string): tipo is TipoAvisoCorreo {
  return Object.prototype.hasOwnProperty.call(AVISOS_POR_CORREO, tipo);
}

export interface AvisoParaCorreo {
  tipo: string;
  /** El texto del aviso de la app («te asignó COOL-12 · …»). */
  texto: string;
  actor: string | null;
  destinatario: { email: string; nombre: string; activo: boolean };
  tarea: { clave: string; titulo: string; projectId: number } | null;
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

/** El correo de un aviso: asunto con clave y título, el mismo texto que en la app y un botón a la tarea. */
export function componerAviso(a: AvisoParaCorreo & { tipo: TipoAvisoCorreo }, marca: Marca): MensajeCorreo {
  const frase = a.actor ? `${a.actor} ${a.texto}` : mayuscula(a.texto);
  const asunto = a.tarea ? `${a.tarea.clave} · ${a.tarea.titulo}` : frase;
  const { html, texto } = componer(marca, {
    titulo: frase,
    parrafos: [`Hola ${a.destinatario.nombre}, tienes un aviso nuevo en ${marca.nombre}.`],
    boton: a.tarea ? { texto: 'Abrir tarea', url: `${marca.url}/t/${a.tarea.clave}` } : { texto: 'Ver mis avisos', url: `${marca.url}/avisos` },
  });
  return { para: a.destinatario.email, asunto: asunto.slice(0, 200), html, texto, tipo: AVISOS_POR_CORREO[a.tipo] };
}
