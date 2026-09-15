import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { Plus, X } from 'react-bootstrap-icons';
import type { DependenciesDto, TaskDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar, EstadoPill } from './tareas-ui';

/** Dependencias de una tarea: «bloqueada por» (editable) y «bloquea a». */
export function Dependencias({ task, puedeEditar, onChanged, onError }: { task: TaskDto; puedeEditar: boolean; onChanged: () => void; onError: (m: string) => void }) {
  const [deps, setDeps] = useState<DependenciesDto | null>(null);
  const [q, setQ] = useState('');
  const [sugerencias, setSugerencias] = useState<TaskDto[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tareasGateway.dependencias(task.id).then(setDeps).catch((e) => onError((e as Error).message));
  }, [task.id, onError]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    const t = setTimeout(() => {
      tareasGateway
        .tareas({ q: q.trim(), pageSize: 8 })
        .then((p) => setSugerencias(p.items.filter((x) => x.id !== task.id)))
        .catch(() => setSugerencias([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, task.id]);

  async function anadir(clave: string) {
    if (!clave.trim()) return;
    setBusy(true);
    try {
      setDeps(await tareasGateway.anadirDependencia(task.id, clave.trim()));
      setQ('');
      setSugerencias([]);
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function quitar(blockerId: number) {
    setBusy(true);
    try {
      setDeps(await tareasGateway.quitarDependencia(task.id, blockerId));
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void anadir(q);
  }

  const abiertas = deps?.blockedBy.filter((d) => !d.done).length ?? 0;
  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Card.Title className="mb-0">
            Dependencias
            {abiertas > 0 && <span className="pill blocked ms-2">⛔ bloqueada por {abiertas}</span>}
            {busy && <Spinner as="span" size="sm" animation="border" className="ms-2" />}
          </Card.Title>
        </div>
        <div className="small fw-semibold text-secondary mb-1">Bloqueada por</div>
        {deps?.blockedBy.length ? (
          deps.blockedBy.map((d) => (
            <div key={d.id} className={`dep-row ${d.done ? 'done' : ''}`}>
              <Link to={`/t/${d.key}`} className="title"><span className="task-key me-2">{d.key}</span>{d.title}</Link>
              <EstadoPill s={d.status} />
              <Avatar user={d.assignee} />
              {puedeEditar && <Button size="sm" variant="link" className="p-0 text-secondary" title="Quitar" onClick={() => quitar(d.id)}><X /></Button>}
            </div>
          ))
        ) : (
          <div className="small text-secondary mb-1">Nada la bloquea.</div>
        )}
        {puedeEditar && (
          <Form onSubmit={submit} className="mt-2 position-relative">
            <div className="d-flex gap-2">
              <Form.Control size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Clave (COOL-12) o texto de la tarea que la bloquea…" />
              <Button size="sm" variant="outline-secondary" type="submit" disabled={!q.trim() || busy}><Plus /></Button>
            </div>
            {sugerencias.length > 0 && (
              <div className="mention-list" style={{ top: '100%', bottom: 'auto', left: 0, right: 0 }}>
                {sugerencias.map((s) => (
                  <button key={s.id} type="button" className="mention-item" onClick={() => anadir(s.key)}>
                    <span className="task-key">{s.key}</span>
                    <span className="text-truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </Form>
        )}
        {deps && deps.blocks.length > 0 && (
          <>
            <div className="small fw-semibold text-secondary mt-3 mb-1">Bloquea a</div>
            {deps.blocks.map((d) => (
              <div key={d.id} className={`dep-row ${d.done ? 'done' : ''}`}>
                <Link to={`/t/${d.key}`} className="title"><span className="task-key me-2">{d.key}</span>{d.title}</Link>
                <EstadoPill s={d.status} />
                <Avatar user={d.assignee} />
              </div>
            ))}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
