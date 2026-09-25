/**
 * Tope de conexiones del pool de Prisma. Sin él, Prisma abre 2×CPU+1, y en DigitalOcean cuenta las CPU de la
 * máquina anfitriona, no las de la instancia: agotaba la base de datos de desarrollo (pocas conexiones) y el
 * panel del equipo, que lanza muchas consultas a la vez, daba «Too many database connections».
 * Si la URL ya trae `connection_limit`, se respeta.
 */
export function conTopeDeConexiones(url: string | undefined, tope: number): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${tope}`;
}
