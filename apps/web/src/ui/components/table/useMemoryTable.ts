import { useCallback, useEffect, useMemo, useState } from 'react';
import { Column, ColumnFilter, Facet, FilterKind, Filters, SortState, TableModel, VACIO } from './types';

/** A partir de cuántos valores distintos deja de tener sentido un desplegable de casillas. */
const MAX_VALORES_PARA_CASILLAS = 60;

const texto = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));

/** Ordena números como números y texto como texto (para que 9 < 10 y no "10" < "9"). */
function comparar(a: unknown, b: unknown): number {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return texto(a).localeCompare(texto(b), 'es', { numeric: true, sensitivity: 'base' });
}

/** ¿Pasa la fila el filtro de esa columna? */
function cumple<T>(row: T, col: Column<T>, f: ColumnFilter | undefined): boolean {
  if (!f) return true;
  const v = texto(col.value(row));

  if (f.text) return v.toLowerCase().includes(f.text.trim().toLowerCase());
  // OJO: `selected: []` (nada marcado) SÍ es un filtro → no pasa ninguna fila. Es lo que permite
  // desmarcar todo y luego marcar sólo los valores que interesan, como en Excel.
  if (f.selected) return f.selected.includes(v === '' ? VACIO : v);
  return true;
}

/**
 * Motor de tabla EN MEMORIA (fase 1 de REQ-002): filtra, ordena, pagina y calcula las facetas
 * sobre un array que ya está en el navegador. Sirve para etiquetas, avisos y usuarios.
 *
 * El maestro NO puede usar esto: está paginado en servidor y filtrar aquí sólo miraría las filas
 * de la página, dando un resultado FALSO con apariencia de correcto. Para eso irá `useServerTable`.
 */
export function useMemoryTable<T>(
  allRows: T[],
  columns: Column<T>[],
  opts: { pageSize?: number } = {},
): TableModel<T> {
  const pageSize = opts.pageSize ?? 50;

  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);

  const colByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  /** Filas que pasan TODOS los filtros salvo el de `exceptoKey` (así se calculan las facetas). */
  const filtrar = useCallback(
    (excepto?: string) =>
      allRows.filter((row) =>
        columns.every((c) => (c.key === excepto ? true : cumple(row, c, filters[c.key]))),
      ),
    [allRows, columns, filters],
  );

  const filtered = useMemo(() => {
    const rows = filtrar();
    if (!sort) return rows;
    const col = colByKey.get(sort.key);
    if (!col) return rows;
    const signo = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => signo * comparar(col.value(a), col.value(b)));
  }, [filtrar, sort, colByKey]);

  // Al cambiar el filtro, volver a la página 1: si no, te quedas mirando una página vacía.
  useEffect(() => setPage(1), [filters, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const facets = useCallback(
    (key: string): Facet[] => {
      const col = colByKey.get(key);
      if (!col) return [];
      // Como en Excel: los valores que se ofrecen ya tienen en cuenta los filtros de las OTRAS columnas.
      const base = filtrar(key);
      const cuenta = new Map<string, number>();
      for (const row of base) {
        const v = texto(col.value(row)) || VACIO;
        cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
      }
      return [...cuenta.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => comparar(a.value, b.value));
    },
    [colByKey, filtrar],
  );

  const setColumnFilter = useCallback((key: string, filter: ColumnFilter | undefined) => {
    setFilters((prev) => {
      const next = { ...prev };
      // Para QUITAR el filtro se pasa `undefined`. Un `selected: []` NO es quitarlo: es
      // "no quiero ninguno" (0 filas), que es un estado legítimo mientras se re-marca a mano.
      if (!filter) delete next[key];
      else next[key] = filter;
      return next;
    });
  }, []);

  const toggleSort = useCallback((key: string) => {
    // asc → desc → sin orden (como en Excel: se puede volver al orden original)
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }, []);

  return {
    columns,
    rows,
    filteredCount: filtered.length,
    totalCount: allRows.length,
    sort,
    toggleSort,
    filters,
    setColumnFilter,
    clearFilters: () => setFilters({}),
    activeFilterCount: Object.keys(filters).length,
    facets,
    page,
    setPage,
    totalPages,
    allFilteredRows: () => filtered,
  };
}

/**
 * Decide el tipo de filtro de una columna si no se ha declarado: casillas cuando hay pocos valores
 * distintos (talla, modelo, color…), texto cuando son casi únicos (sku, ean13, upc).
 */
export function tipoDeFiltro<T>(col: Column<T>, rows: T[]): FilterKind {
  if (col.filter) return col.filter;
  const distintos = new Set(rows.map((r) => texto(col.value(r))));
  return distintos.size <= MAX_VALORES_PARA_CASILLAS ? 'values' : 'text';
}
