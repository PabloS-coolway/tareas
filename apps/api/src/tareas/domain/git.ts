/**
 * Claves de tarea mencionadas en un texto de git (mensaje de commit, título o cuerpo de una PR):
 * «Arregla la guía (COOL-32)», «TAREAS-6: seguidores»… Sólo las de proyectos que existen, sin repetir,
 * en el orden en que aparecen. Mayúsculas, como se escriben las claves.
 */
export function clavesEnTexto(texto: string, proyectos: string[]): string[] {
  const validos = new Set(proyectos);
  const out: string[] = [];
  for (const m of texto.matchAll(/(?<![A-Za-z0-9-])([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*)-(\d+)(?![A-Za-z0-9])/g)) {
    const clave = `${m[1]}-${Number(m[2])}`;
    if (validos.has(m[1]) && !out.includes(clave)) out.push(clave);
  }
  return out;
}

/** Primera línea del mensaje, recortada (lo que se enseña en el comentario). */
export function primeraLinea(mensaje: string, max = 140): string {
  const l = (mensaje ?? '').split('\n')[0].trim();
  return l.length > max ? `${l.slice(0, max - 1)}…` : l;
}
