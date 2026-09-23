import { Button, Form } from 'react-bootstrap';
import { Eye, EyeSlash, X } from 'react-bootstrap-icons';
import type { UserRefDto } from '@yorga/contracts';
import { Avatar } from './tareas-ui';

interface Props {
  seguidores: UserRefDto[];
  equipo: UserRefDto[];
  yo: number | undefined;
  puedeEditar: boolean;
  /** Lista completa de ids que queda tras el cambio. */
  cambiar: (ids: number[]) => void;
}

/** Personas de seguimiento de una tarea (además del responsable): reciben sus mismos avisos. */
export function Seguimiento({ seguidores, equipo, yo, puedeEditar, cambiar }: Props) {
  const ids = seguidores.map((u) => u.id);
  const lasigo = yo !== undefined && ids.includes(yo);
  const libres = equipo.filter((u) => !ids.includes(u.id));

  return (
    <div className="field field-top">
      <label htmlFor="t-follow">Seguimiento</label>
      <div className="d-flex flex-column gap-1">
        {seguidores.map((u) => (
          <span key={u.id} className="seguidor">
            <Avatar user={u} />
            <span className="flex-grow-1 text-truncate">{u.name}</span>
            {puedeEditar && (
              <button type="button" className="btn btn-sm btn-link p-0 text-secondary" title={`Quitar a ${u.name} del seguimiento`} onClick={() => cambiar(ids.filter((i) => i !== u.id))}>
                <X />
              </button>
            )}
          </span>
        ))}
        {puedeEditar ? (
          <>
            <Form.Select id="t-follow" size="sm" value="" onChange={(e) => e.target.value && cambiar([...ids, Number(e.target.value)])} disabled={libres.length === 0}>
              <option value="">{seguidores.length ? 'Añadir a alguien más…' : 'Añadir persona…'}</option>
              {libres.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Form.Select>
            {yo !== undefined && (
              <Button
                variant="link"
                size="sm"
                className="p-0 small text-decoration-none align-self-start"
                onClick={() => cambiar(lasigo ? ids.filter((i) => i !== yo) : [...ids, yo])}
                title={lasigo ? 'Dejar de recibir sus avisos' : 'Recibir sus avisos aunque no seas el responsable'}
              >
                {lasigo ? <><EyeSlash /> Dejar de seguir</> : <><Eye /> Seguir yo</>}
              </Button>
            )}
          </>
        ) : (
          seguidores.length === 0 && <span className="small text-secondary">Nadie</span>
        )}
      </div>
    </div>
  );
}
