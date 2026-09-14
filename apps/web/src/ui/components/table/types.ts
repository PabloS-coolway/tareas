import type { ReactNode } from 'react';

/**
 * Contrato de la tabla unificada (REQ-002).
 *
 * La `DataTable` es TONTA: pinta lo que le da un `TableModel`. De dónde salen los datos filtrados
 * y ordenados es problema del modelo:
 *   · `useMemoryTable`  → arrays que ya están en el navegador (etiquetas, avisos, usuarios).
 *   · `useServerTable`  → el maestro (5.736 SKU), que se filtra y ordena en la BD (fase 3).
 *
 * Gracias a esto, cuando el maestro entre por servidor NO hay que tocar ni la UI ni las páginas.
 */

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

/** Cómo se filtra una columna. Lo decide la CARDINALIDAD (ver diseño REQ-002). */
export type FilterKind =
  | 'values' // autofiltro tipo Excel: casillas con los valores distintos (talla, modelo, color…)
  | 'text' // "contiene": para columnas casi únicas (sku, ean13, upc), donde las casillas no sirven
  | 'none'; // columna no filtrable (acciones)

/** Filtro aplicado a una columna: valores marcados (autofiltro) o texto (contiene). */
export interface ColumnFilter {
  selected?: string[];
  text?: string;
}
export type Filters = Record<string, ColumnFilter>;

/** Un valor del desplegable de autofiltro, con cuántas filas tiene (como Excel). */
export interface Facet {
  value: string;
  count: number;
}

export interface Column<T> {
  key: string;
  label: string;
  /** Valor CRUDO: es lo que se ordena, se filtra y se exporta. Nunca JSX. */
  value: (row: T) => string | number | null | undefined;
  /** Pintado opcional (badges, varias líneas…). Si no se da, se pinta `value`. */
  render?: (row: T) => ReactNode;
  /** Por defecto se decide solo según cuántos valores distintos tenga la columna. */
  filter?: FilterKind;
  sortable?: boolean; // por defecto true
  align?: 'start' | 'end';
}

/** Lo que la DataTable necesita para pintarse. Lo produce un hook (memoria hoy, servidor mañana). */
export interface TableModel<T> {
  columns: Column<T>[];
  /** Filas de la página actual, ya filtradas y ordenadas. */
  rows: T[];
  /** Filas que cumplen el filtro (puede ser mayor que `rows.length`: hay paginación). */
  filteredCount: number;
  /** Filas totales sin filtrar. Se enseña siempre "N de M": nunca confundir lo que veo con lo que hay. */
  totalCount: number;
  loading?: boolean;

  sort: SortState | null;
  toggleSort: (key: string) => void;

  filters: Filters;
  setColumnFilter: (key: string, filter: ColumnFilter | undefined) => void;
  clearFilters: () => void;
  activeFilterCount: number;

  /** Valores del desplegable de una columna, YA respetando los filtros de las demás (como Excel). */
  facets: (key: string) => Facet[];
  /**
   * Aviso de que se ha abierto el desplegable de una columna. En memoria no hace falta (las facetas
   * se calculan al vuelo); contra el servidor es la señal para ir a buscarlas.
   */
  requestFacets?: (key: string) => void;
  /** Vuelve a pedir los datos (tras cargar/importar el maestro, la tabla debe reflejarlo). */
  reload?: () => void;

  page: number;
  setPage: (p: number) => void;
  totalPages: number;

  /** Todas las filas filtradas (sin paginar): para copiar / exportar la vista tal cual se ve. */
  allFilteredRows: () => T[];
}

/** Se muestra así en el desplegable cuando la celda está vacía (y es filtrable como tal). */
export const VACIO = '(vacío)';
