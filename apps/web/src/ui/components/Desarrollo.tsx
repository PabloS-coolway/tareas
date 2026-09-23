import { useEffect, useState } from 'react';
import { Badge, Button, Card, Form, InputGroup } from 'react-bootstrap';
import { Clipboard, Diagram2, Git as GitIcon, Github } from 'react-bootstrap-icons';
import type { DevelopmentDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { hace } from './tareas-ui';

const VISIBLES = 5;
const corto = (repo: string) => repo.split('/').pop() ?? repo;

/**
 * Panel «Desarrollo» (como en Jira): ramas, commits y pull requests de GitHub que mencionan la tarea, y un
 * botón para empezar una rama con el nombre ya puesto.
 */
export function Desarrollo({ taskId, taskKey }: { taskId: number; taskKey: string }) {
  const [d, setD] = useState<DevelopmentDto | null>(null);
  const [todos, setTodos] = useState(false);
  const [crear, setCrear] = useState(false);
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    setD(null);
    tareasGateway.desarrollo(taskId).then(setD).catch(() => setD({ branches: [], commits: [], pullRequests: [], suggestedBranch: '' }));
  }, [taskId]);

  const copiar = (texto: string, que: string) => {
    void navigator.clipboard.writeText(texto).then(() => {
      setCopiado(que);
      setTimeout(() => setCopiado(''), 1500);
    });
  };

  if (!d) return null;
  const vacio = !d.branches.length && !d.commits.length && !d.pullRequests.length;
  const commits = todos ? d.commits : d.commits.slice(0, VISIBLES);

  return (
    <Card className="mb-3 dev-panel">
      <Card.Body>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <Card.Title className="mb-0 d-flex align-items-center gap-2"><Github /> Desarrollo</Card.Title>
          {d.suggestedBranch && <Button size="sm" variant="outline-secondary" onClick={() => setCrear((c) => !c)}><Diagram2 /> Crear rama</Button>}
        </div>

        {crear && d.suggestedBranch && (
          <div className="dev-crear mb-3">
            <Form.Label className="small text-secondary mb-1" htmlFor="dev-rama">Nombre de la rama</Form.Label>
            <InputGroup size="sm" className="mb-2">
              <Form.Control id="dev-rama" readOnly value={d.suggestedBranch} className="font-monospace" />
              <Button variant="outline-secondary" onClick={() => copiar(d.suggestedBranch, 'rama')} title="Copiar"><Clipboard /></Button>
            </InputGroup>
            <Form.Label className="small text-secondary mb-1" htmlFor="dev-git">En la terminal, dentro del repo</Form.Label>
            <InputGroup size="sm">
              <Form.Control id="dev-git" readOnly value={`git checkout -b ${d.suggestedBranch}`} className="font-monospace" />
              <Button variant="outline-secondary" onClick={() => copiar(`git checkout -b ${d.suggestedBranch}`, 'git')} title="Copiar"><Clipboard /></Button>
            </InputGroup>
            {copiado && <div className="small text-success mt-1">Copiado.</div>}
            <div className="small text-secondary mt-2">Con la clave en el nombre, la rama y sus commits salen aquí solos al subirlos.</div>
          </div>
        )}

        {vacio ? (
          <div className="small text-secondary">Nada en GitHub todavía. Menciona <span className="task-key">{taskKey}</span> en un commit o en una PR, o crea la rama con el botón.</div>
        ) : (
          <>
            {d.pullRequests.length > 0 && (
              <div className="dev-seccion">
                <div className="dev-titulo">Pull requests <span className="count">{d.pullRequests.length}</span></div>
                {d.pullRequests.map((p) => (
                  <a key={`${p.repo}#${p.number}`} href={p.url} target="_blank" rel="noreferrer" className="dev-fila" title={`${p.repo} · ${p.branch ?? ''}`}>
                    <Badge bg={p.state === 'merged' ? 'success' : 'primary'} className="dev-estado">{p.state === 'merged' ? 'Mergeada' : 'Abierta'}</Badge>
                    <span className="text-truncate"><b>#{p.number}</b> {p.title}</span>
                  </a>
                ))}
              </div>
            )}
            {d.branches.length > 0 && (
              <div className="dev-seccion">
                <div className="dev-titulo">Ramas <span className="count">{d.branches.length}</span></div>
                {d.branches.map((b) => (
                  <a key={`${b.repo}:${b.name}`} href={b.url} target="_blank" rel="noreferrer" className="dev-fila" title={b.repo}>
                    <Diagram2 className="flex-shrink-0 text-secondary" />
                    <span className="text-truncate font-monospace small">{b.name}</span>
                    <span className="ms-auto small text-secondary text-nowrap">{corto(b.repo)}</span>
                  </a>
                ))}
              </div>
            )}
            {d.commits.length > 0 && (
              <div className="dev-seccion">
                <div className="dev-titulo">Commits <span className="count">{d.commits.length}</span></div>
                {commits.map((c) => (
                  <a key={`${c.repo}@${c.sha}`} href={c.url} target="_blank" rel="noreferrer" className="dev-fila dev-commit" title={`${c.message}\n${c.repo}${c.branch ? ` · ${c.branch}` : ''}`}>
                    <GitIcon className="flex-shrink-0 text-secondary" />
                    <span className="font-monospace small">{c.sha.slice(0, 7)}</span>
                    <span className="text-truncate">{c.message}</span>
                    <span className="ms-auto small text-secondary text-nowrap">{c.at ? hace(c.at) : ''}</span>
                  </a>
                ))}
                {d.commits.length > VISIBLES && (
                  <Button variant="link" size="sm" className="p-0" onClick={() => setTodos((t) => !t)}>{todos ? 'Ver menos' : `Ver los ${d.commits.length}`}</Button>
                )}
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
