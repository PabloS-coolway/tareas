import { useEffect, useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { BookmarkStar, Trash } from 'react-bootstrap-icons';
import type { SavedViewDto, ViewFilters } from '@yorga/contracts';
import { tareasGateway } from '../composition';

interface Props {
  scope: 'project' | 'global';
  projectId?: number | null;
  /** Filtros actuales de la página (lo que se guarda). */
  actual: ViewFilters;
  /** Aplica una vista guardada. */
  aplicar: (f: ViewFilters) => void;
  onError: (m: string) => void;
}

/** Desplegable «Vistas»: aplicar, guardar la actual (privada o compartida) y borrar. */
export function VistasGuardadas({ scope, projectId, actual, aplicar, onError }: Props) {
  const [vistas, setVistas] = useState<SavedViewDto[]>([]);

  const load = () => tareasGateway.vistas(scope, projectId).then(setVistas).catch(() => setVistas([]));
  useEffect(() => {
    void load();
  }, [scope, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(shared: boolean) {
    const name = window.prompt(shared ? 'Nombre de la vista (la verá todo el equipo):' : 'Nombre de la vista:');
    if (!name?.trim()) return;
    try {
      await tareasGateway.guardarVista({ scope, projectId: projectId ?? null, name: name.trim(), filters: actual, shared });
      await load();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function borrar(v: SavedViewDto) {
    if (!window.confirm(`¿Borrar la vista "${v.name}"?`)) return;
    try {
      await tareasGateway.borrarVista(v.id);
      await load();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  const activos = Object.values(actual).filter((v) => v !== '' && v !== false && v !== null && v !== undefined).length;
  return (
    <Dropdown align="end">
      <Dropdown.Toggle size="sm" variant="outline-secondary" id="vistas-dd" title="Vistas guardadas">
        <BookmarkStar className="me-1" /> Vistas{vistas.length > 0 && <span className="text-secondary ms-1">({vistas.length})</span>}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {vistas.length === 0 && <Dropdown.ItemText className="small text-secondary">Sin vistas guardadas.</Dropdown.ItemText>}
        {vistas.map((v) => (
          <Dropdown.Item key={v.id} as="div" className="d-flex align-items-center gap-2 pe-2">
            <button type="button" className="btn btn-link p-0 text-decoration-none text-start flex-grow-1 text-reset" onClick={() => aplicar(v.filters)}>
              {v.name}
              {v.shared && <span className="small text-secondary ms-1">· equipo</span>}
            </button>
            {v.mine && <button type="button" className="btn btn-link p-0 text-secondary" title="Borrar" onClick={() => borrar(v)}><Trash /></button>}
          </Dropdown.Item>
        ))}
        <Dropdown.Divider />
        <Dropdown.Item onClick={() => guardar(false)} disabled={activos === 0}>Guardar filtros actuales…</Dropdown.Item>
        <Dropdown.Item onClick={() => guardar(true)} disabled={activos === 0}>Guardar y compartir con el equipo…</Dropdown.Item>
        {activos === 0 && <Dropdown.ItemText className="small text-secondary">Aplica algún filtro para poder guardarlo.</Dropdown.ItemText>}
      </Dropdown.Menu>
    </Dropdown>
  );
}
