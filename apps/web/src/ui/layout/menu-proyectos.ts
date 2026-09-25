import type { ProjectDto } from '@yorga/contracts';

/**
 * Qué proyectos enseña el menú. Con «solo mis proyectos» se ven los que tienen alguna tarea mía (en cualquier
 * estado), los que tienen avisos míos sin leer (si no, el número rojo no tendría dónde salir) y el que estoy
 * viendo, para que abrir uno por un enlace no lo deje fuera de la lista.
 *
 * Es solo presentación: el acceso lo decide la API por equipo (`AccessService`). Si el filtro dejara la lista
 * vacía —alguien sin ninguna tarea asignada— se enseñan todos, para no dejar un menú sin proyectos.
 */
export function proyectosDelMenu(proyectos: ProjectDto[], soloMios: boolean, claveActual?: string, sinLeer: Record<string, number> = {}): ProjectDto[] {
  if (!soloMios) return proyectos;
  const mios = proyectos.filter((p) => p.mineTotalCount > 0 || (sinLeer[p.key] ?? 0) > 0 || p.key === claveActual);
  return mios.length > 0 ? mios : proyectos;
}
