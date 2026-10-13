/** Mismo formato de clave que la API (COOL-12, ATENCION-AL-CLIENTE-3): el número va tras el ÚLTIMO guion. */
const CLAVE_TAREA = /^([A-Za-z][A-Za-z0-9-]{0,23})-(\d{1,9})$/;

export interface Destino {
  to: string;
  etiqueta: string;
}

/**
 * Lo que se escribe o se pega en el buscador, si lleva directo a algún sitio: una clave de tarea (cool-111),
 * un enlace a una tarea (de producción o de local, da igual) o cualquier enlace de esta misma app.
 * Instalada como PWA no hay barra de direcciones: esto la sustituye.
 */
export function destinoDirecto(texto: string, origen: string): Destino | null {
  const t = texto.trim();
  if (!t) return null;
  const clave = CLAVE_TAREA.exec(t);
  if (clave) return tarea(`${clave[1]}-${clave[2]}`);

  let url: URL;
  try {
    url = new URL(t, origen);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !(t.startsWith('/') || /^https?:\/\//i.test(t))) return null;
  const enTarea = /^\/t\/([^/?#]+)/.exec(url.pathname);
  if (enTarea && CLAVE_TAREA.test(decodeURIComponent(enTarea[1]))) return tarea(decodeURIComponent(enTarea[1]));
  if (url.origin !== new URL(origen).origin) return null;
  return { to: `${url.pathname}${url.search}${url.hash}`, etiqueta: 'Abrir el enlace' };
}

function tarea(clave: string): Destino {
  const k = clave.toUpperCase();
  return { to: `/t/${k}`, etiqueta: `Abrir ${k}` };
}
