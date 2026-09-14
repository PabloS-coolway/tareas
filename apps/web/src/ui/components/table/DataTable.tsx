import { useMemo, useState } from 'react';
import { Button, OverlayTrigger, Pagination, Popover, Table } from 'react-bootstrap';
import { CaretDownFill, CaretUpFill, Funnel, FunnelFill, XLg } from 'react-bootstrap-icons';
import { ColumnFilterPopover } from './ColumnFilter';
import { tipoDeFiltro } from './useMemoryTable';
import { Column, TableModel } from './types';

/** Ventana de páginas: 1 … 4 5 6 … 20 */
function ventana(actual: number, total: number): (number | '…')[] {
  const out: (number | '…')[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - actual) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

/**
 * Tabla unificada de la app (REQ-002): cabeceras ordenables + filtro por columna, como en Excel.
 *
 * Es TONTA a propósito: no sabe de dónde vienen los datos. Recibe un `TableModel`, que hoy produce
 * `useMemoryTable` y mañana producirá `useServerTable` (maestro). Así, cuando el maestro pase a
 * filtrarse en la BD, esta UI no cambia.
 */
export function DataTable<T>({
  model,
  rowKey,
  /** Filas de la tabla original, para decidir el tipo de filtro de cada columna por su cardinalidad. */
  allRows,
  empty = 'Sin resultados.',
  size = 'sm',
}: {
  model: TableModel<T>;
  rowKey: (row: T, i: number) => string;
  allRows: T[];
  empty?: string;
  size?: 'sm';
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  const kinds = useMemo(
    () => new Map(model.columns.map((c) => [c.key, tipoDeFiltro(c, allRows)] as const)),
    [model.columns, allRows],
  );

  const cabecera = (col: Column<T>) => {
    const kind = kinds.get(col.key) ?? 'none';
    const filtrada = !!model.filters[col.key];
    const ordenada = model.sort?.key === col.key;
    const sortable = col.sortable !== false;

    return (
      <th key={col.key} className={col.align === 'end' ? 'text-end' : undefined}>
        <div className={`d-flex align-items-center gap-1 ${col.align === 'end' ? 'justify-content-end' : ''}`}>
          {sortable ? (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none text-reset fw-semibold"
              onClick={() => model.toggleSort(col.key)}
              aria-label={`Ordenar por ${col.label}`}
            >
              {col.label}
              {ordenada &&
                (model.sort!.dir === 'asc' ? (
                  <CaretUpFill className="ms-1" aria-hidden="true" />
                ) : (
                  <CaretDownFill className="ms-1" aria-hidden="true" />
                ))}
            </button>
          ) : (
            <span className="fw-semibold">{col.label}</span>
          )}

          {kind !== 'none' && (
            <OverlayTrigger
              trigger="click"
              rootClose
              placement="bottom-start"
              show={abierta === col.key}
              onToggle={(next) => {
                setAbierta(next ? col.key : null);
                // Contra el servidor, las facetas hay que pedirlas: no se pueden deducir de la página.
                if (next) model.requestFacets?.(col.key);
              }}
              overlay={
                <Popover>
                  <ColumnFilterPopover
                    kind={kind}
                    facets={model.facets(col.key)}
                    filter={model.filters[col.key]}
                    onChange={(f) => model.setColumnFilter(col.key, f)}
                    onClose={() => setAbierta(null)}
                  />
                </Popover>
              }
            >
              <button
                type="button"
                className={`btn btn-link btn-sm p-0 text-decoration-none ${filtrada ? 'text-primary' : 'text-secondary'}`}
                aria-label={`Filtrar por ${col.label}${filtrada ? ' (filtro activo)' : ''}`}
              >
                {filtrada ? <FunnelFill aria-hidden="true" /> : <Funnel aria-hidden="true" />}
              </button>
            </OverlayTrigger>
          )}
        </div>
      </th>
    );
  };

  return (
    <div>
      {/* Contador SIEMPRE visible: nunca confundir "lo que veo" con "lo que hay". */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="text-secondary small">
          {model.filteredCount === model.totalCount ? (
            <>{model.totalCount.toLocaleString('es-ES')} filas</>
          ) : (
            <>
              <strong>{model.filteredCount.toLocaleString('es-ES')}</strong> de{' '}
              {model.totalCount.toLocaleString('es-ES')} filas
            </>
          )}
        </span>
        {model.activeFilterCount > 0 && (
          <Button size="sm" variant="link" className="p-0 small" onClick={model.clearFilters}>
            <XLg className="me-1" aria-hidden="true" />
            Quitar {model.activeFilterCount} filtro{model.activeFilterCount > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Sin `responsive`: envolvería la tabla en otro overflow y ROMPERÍA el header sticky
          (el sticky se ancla a ese wrapper, que no hace scroll vertical). `.labels-preview`
          ya da scroll en ambos ejes. */}
      <div className="labels-preview">
        <Table size={size} striped hover className="mb-0 align-middle">
          <thead>
            <tr>{model.columns.map(cabecera)}</tr>
          </thead>
          <tbody>
            {model.rows.length === 0 && (
              <tr>
                <td colSpan={model.columns.length} className="text-secondary text-center py-3">
                  {empty}
                </td>
              </tr>
            )}
            {model.rows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {model.columns.map((c) => (
                  <td key={c.key} className={c.align === 'end' ? 'text-end' : undefined}>
                    {c.render ? c.render(row) : (c.value(row) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {model.totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
          <span className="text-secondary small">
            Página {model.page} de {model.totalPages}
          </span>
          <Pagination size="sm" className="mb-0">
            <Pagination.Prev
              aria-label="Página anterior"
              disabled={model.page === 1}
              onClick={() => model.setPage(Math.max(1, model.page - 1))}
            />
            {ventana(model.page, model.totalPages).map((p, i) =>
              p === '…' ? (
                <Pagination.Ellipsis key={`e${i}`} disabled />
              ) : (
                <Pagination.Item
                  key={p}
                  active={p === model.page}
                  aria-label={`Página ${p}`}
                  onClick={() => model.setPage(p)}
                >
                  {p}
                </Pagination.Item>
              ),
            )}
            <Pagination.Next
              aria-label="Página siguiente"
              disabled={model.page === model.totalPages}
              onClick={() => model.setPage(Math.min(model.totalPages, model.page + 1))}
            />
          </Pagination>
        </div>
      )}
    </div>
  );
}
