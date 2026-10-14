import { ErrorCorreo } from '../dominio/tipos';
import { AvisoFiltrable, CatalogoAvisos, IdAmbito, MODOS_AMBITOS, MODOS_ENVIO, PreferenciasCorreo } from './tipos';

/** Las de quien no ha tocado nada: activado, los tipos marcados «por defecto», todos los ámbitos, al momento. */
export function preferenciasPorDefecto(catalogo: CatalogoAvisos): PreferenciasCorreo {
  return { activo: true, tipos: catalogo.filter((t) => t.porDefecto).map((t) => t.clave), ambitos: { modo: 'todos', ids: [] }, nivelMinimo: null, modo: 'inmediato' };
}

const MAX_AMBITOS = 500;

/**
 * Valida y limpia lo que llega de la pantalla. `niveles` = cuántos niveles tiene la escala de la app. Lanza
 * ErrorCorreo con un mensaje que se puede enseñar.
 */
export function normalizarPreferencias(dto: unknown, catalogo: CatalogoAvisos, niveles: number): PreferenciasCorreo {
  if (!dto || typeof dto !== 'object') throw new ErrorCorreo('Faltan las preferencias.');
  const d = dto as Partial<PreferenciasCorreo>;
  const claves = new Set(catalogo.map((t) => t.clave));
  if (!Array.isArray(d.tipos)) throw new ErrorCorreo('Faltan los tipos de aviso.');
  const desconocido = d.tipos.find((t) => !claves.has(t));
  if (desconocido !== undefined) throw new ErrorCorreo(`Tipo de aviso desconocido: ${String(desconocido)}.`);
  const modoAmbitos = d.ambitos?.modo;
  if (!modoAmbitos || !MODOS_AMBITOS.includes(modoAmbitos)) throw new ErrorCorreo('Elige de qué ámbitos quieres correos.');
  const ids = Array.isArray(d.ambitos?.ids) ? d.ambitos!.ids : [];
  if (ids.length > MAX_AMBITOS || ids.some((i) => (typeof i !== 'string' && typeof i !== 'number') || i === '')) throw new ErrorCorreo('La lista de ámbitos no es válida.');
  if (modoAmbitos === 'solo' && ids.length === 0) throw new ErrorCorreo('Con «solo estos», elige al menos uno.');
  const nivel = d.nivelMinimo ?? null;
  if (nivel !== null && (!Number.isInteger(nivel) || nivel < 0 || nivel >= niveles)) throw new ErrorCorreo('El nivel mínimo no es válido.');
  if (!d.modo || !MODOS_ENVIO.includes(d.modo)) throw new ErrorCorreo('Elige si quieres los correos al momento o en resumen.');
  return {
    activo: d.activo !== false,
    tipos: catalogo.map((t) => t.clave).filter((c) => d.tipos!.includes(c)), // orden del catálogo, sin repetidos
    ambitos: { modo: modoAmbitos, ids: modoAmbitos === 'todos' ? [] : [...new Set(ids.map((i) => (typeof i === 'number' ? i : String(i))))] as IdAmbito[] },
    nivelMinimo: nivel,
    modo: d.modo,
  };
}

const mismoId = (a: IdAmbito, b: IdAmbito) => String(a) === String(b);

/** ¿Este aviso va por correo a esta persona, según sus preferencias? (El cuándo lo decide `modo`.) */
export function pasaPreferencias(p: PreferenciasCorreo, a: AvisoFiltrable): boolean {
  if (!p.activo || !p.tipos.includes(a.tipo)) return false;
  if (a.ambitoId !== null) {
    const dentro = p.ambitos.ids.some((id) => mismoId(id, a.ambitoId as IdAmbito));
    if (p.ambitos.modo === 'solo' && !dentro) return false;
    if (p.ambitos.modo === 'silenciar' && dentro) return false;
  }
  if (p.nivelMinimo !== null && a.nivel !== null && a.nivel < p.nivelMinimo) return false;
  return true;
}
