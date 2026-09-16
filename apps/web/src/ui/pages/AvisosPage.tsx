import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card } from 'react-bootstrap';
import { X } from 'react-bootstrap-icons';
import type { NotificationDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar, hace } from '../components/tareas-ui';
import { Skeleton } from '../components/Skeleton';
import { avisarAvisosLeidos } from '../layout/Sidebar';

const ICONO: Record<NotificationDto['type'], string> = { MENTION: '@', ASSIGNED: '👤', COMMENT: '💬', STATUS: '↻', BLOCKER_DONE: '✅', PASSWORD_RESET: '🔑' };

/** Avisos: menciones, asignaciones, comentarios y cambios de estado en tus tareas. */
export function AvisosPage() {
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const p = await tareasGateway.avisos(100);
      setItems(p.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function marcarTodo() {
    await tareasGateway.marcarAvisosLeidos().catch(() => undefined);
    avisarAvisosLeidos();
    await load();
  }

  async function borrarTodo() {
    if (!items?.length || !window.confirm(`¿Borrar los ${items.length} avisos? No se puede deshacer.`)) return;
    await tareasGateway.borrarAvisos().catch((e) => setError((e as Error).message));
    avisarAvisosLeidos();
    await load();
  }

  async function borrarUno(id: number) {
    setItems((its) => (its ?? []).filter((i) => i.id !== id));
    await tareasGateway.borrarAvisos(id).catch((e) => setError((e as Error).message));
    avisarAvisosLeidos();
  }

  const sinLeer = items?.filter((i) => !i.readAt).length ?? 0;
  return (
    <div className="page page-wide">
      <header className="page-head mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-1">Avisos</h1>
          <p className="text-secondary mb-0">Menciones, asignaciones, comentarios y cambios en tus tareas.</p>
        </div>
        <div className="d-flex gap-2">
          {sinLeer > 0 && <Button size="sm" variant="outline-secondary" onClick={marcarTodo}>Marcar todos como leídos ({sinLeer})</Button>}
          {!!items?.length && <Button size="sm" variant="outline-danger" onClick={borrarTodo}>Borrar todos</Button>}
        </div>
      </header>
      {error && <Alert variant="danger">⚠ {error}</Alert>}
      {!items ? (
        <Skeleton className="skeleton-rounded" width="100%" height={200} />
      ) : items.length === 0 ? (
        <Card><Card.Body className="text-secondary">Nada por aquí. Te avisaremos cuando te mencionen, te asignen algo o comenten en tus tareas.</Card.Body></Card>
      ) : (
        <Card>
          <Card.Body className="p-0">
            {items.map((n) => (
              <Link
                key={n.id}
                to={n.taskKey ? `/t/${n.taskKey}` : n.type === 'PASSWORD_RESET' ? '/usuarios' : '/inicio'}
                className={`aviso ${n.readAt ? '' : 'unread'}`}
                onClick={() => {
                  if (!n.readAt) {
                    void tareasGateway.marcarAvisosLeidos(n.id).then(avisarAvisosLeidos);
                  }
                }}
              >
                <span className="aviso-ico" aria-hidden>{ICONO[n.type]}</span>
                <Avatar user={n.actor} />
                <span className="aviso-text">
                  <b>{n.actor?.name ?? 'Alguien'}</b> {n.text}
                  {n.taskTitle && <span className="d-block small text-secondary text-truncate">{n.taskKey} · {n.taskTitle}</span>}
                </span>
                <span className="small text-secondary text-nowrap">{hace(n.createdAt)}</span>
                <button type="button" className="aviso-x" title="Borrar aviso" aria-label="Borrar aviso" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void borrarUno(n.id); }}><X /></button>
              </Link>
            ))}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
