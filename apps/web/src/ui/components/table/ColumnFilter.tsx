import { useMemo, useState } from 'react';
import { Button, Form, InputGroup, Popover } from 'react-bootstrap';
import { Search } from 'react-bootstrap-icons';
import { ColumnFilter as Filtro, Facet, FilterKind } from './types';

/**
 * El desplegable de filtro de una columna. Dos formas, según la naturaleza de la columna:
 *  · `values` → casillas con los valores distintos (el autofiltro de Excel), con buscador si hay muchos.
 *  · `text`   → "contiene", para columnas casi únicas (sku, ean13, upc): 5.736 casillas no las usa nadie.
 */
export function ColumnFilterPopover({
  kind,
  facets,
  filter,
  onChange,
  onClose,
}: {
  kind: FilterKind;
  facets: Facet[];
  filter: Filtro | undefined;
  onChange: (f: Filtro | undefined) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [texto, setTexto] = useState(filter?.text ?? '');

  // Sin selección explícita = todos marcados (igual que Excel al abrirlo por primera vez).
  const seleccion = useMemo(
    () => new Set(filter?.selected ?? facets.map((f) => f.value)),
    [filter?.selected, facets],
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? facets.filter((f) => f.value.toLowerCase().includes(q)) : facets;
  }, [facets, busqueda]);

  const aplicarSeleccion = (valores: Set<string>) => {
    // Todos marcados = sin filtro (no ensuciamos el estado ni el contador de filtros activos).
    // Ninguno marcado SÍ es un filtro (0 filas): es el paso intermedio de "desmarcar todo y elegir".
    if (valores.size === facets.length) onChange(undefined);
    else onChange({ selected: [...valores] });
  };

  const alternar = (valor: string) => {
    const next = new Set(seleccion);
    if (next.has(valor)) next.delete(valor);
    else next.add(valor);
    aplicarSeleccion(next);
  };

  if (kind === 'text') {
    return (
      <Popover.Body className="p-2" style={{ minWidth: 220 }}>
        <InputGroup size="sm">
          <InputGroup.Text>
            <Search aria-hidden="true" />
          </InputGroup.Text>
          <Form.Control
            autoFocus
            placeholder="Contiene…"
            value={texto}
            aria-label="Filtrar: contiene"
            onChange={(e) => {
              setTexto(e.target.value);
              onChange(e.target.value.trim() ? { text: e.target.value } : undefined);
            }}
          />
        </InputGroup>
        <div className="d-flex justify-content-between mt-2">
          <Button
            size="sm"
            variant="link"
            className="p-0"
            onClick={() => {
              setTexto('');
              onChange(undefined);
            }}
          >
            Quitar filtro
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Popover.Body>
    );
  }

  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((f) => seleccion.has(f.value));
  const algunoVisibleMarcado = visibles.some((f) => seleccion.has(f.value));
  // Estado "indeterminado" (guion) cuando la selección es parcial: es la señal de Excel.
  const parcial = algunoVisibleMarcado && !todosVisiblesMarcados;

  return (
    <Popover.Body className="p-2" style={{ minWidth: 240 }}>
      {facets.length > 8 && (
        <InputGroup size="sm" className="mb-2">
          <InputGroup.Text>
            <Search aria-hidden="true" />
          </InputGroup.Text>
          <Form.Control
            autoFocus
            placeholder="Buscar valor…"
            value={busqueda}
            aria-label="Buscar valor en el filtro"
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </InputGroup>
      )}

      <Form.Check
        type="checkbox"
        id="filtro-todos"
        className="small fw-semibold border-bottom pb-1 mb-1"
        label={busqueda ? '(Seleccionar lo visible)' : '(Seleccionar todo)'}
        checked={todosVisiblesMarcados}
        // Marcado a medias → guion, no casilla vacía: dice "hay algo seleccionado, pero no todo".
        ref={(el: HTMLInputElement | null) => {
          if (el) el.indeterminate = parcial;
        }}
        onChange={() => {
          const next = new Set(seleccion);
          // Si está todo (o parte) marcado, el clic DESMARCA: así se vacía y se eligen los que interesan.
          if (todosVisiblesMarcados || parcial) visibles.forEach((f) => next.delete(f.value));
          else visibles.forEach((f) => next.add(f.value));
          aplicarSeleccion(next);
        }}
      />

      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {visibles.length === 0 && <div className="text-secondary small px-1">Sin valores</div>}
        {visibles.map((f) => (
          <Form.Check
            key={f.value}
            type="checkbox"
            id={`filtro-${f.value}`}
            className="small"
            checked={seleccion.has(f.value)}
            onChange={() => alternar(f.value)}
            label={
              <span className="d-flex justify-content-between gap-2">
                <span>{f.value}</span>
                <span className="text-secondary">{f.count}</span>
              </span>
            }
          />
        ))}
      </div>

      <div className="d-flex justify-content-between mt-2 pt-1 border-top">
        <Button size="sm" variant="link" className="p-0" onClick={() => onChange(undefined)}>
          Quitar filtro
        </Button>
        <Button size="sm" variant="outline-secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Popover.Body>
  );
}
