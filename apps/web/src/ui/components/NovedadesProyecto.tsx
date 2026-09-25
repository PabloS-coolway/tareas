import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from 'react-bootstrap';
import { BellFill, X } from 'react-bootstrap-icons';
import type { NotificationDto } from '@yorga/contracts';
import { tareasGateway } from '../composition';
import { Avatar, hace } from './tareas-ui';
import { avisarAvisosLeidos } from '../layout/Sidebar';
import { ICONO } from '../pages/AvisosPage';

/**
 * «Novedades» al abrir un proyecto: los avisos sin leer de sus tareas (lo que cuenta el número rojo del menú).
 * Al enseñarlos se marcan leídos —solo esos, no uno que llegue mientras— y el número desaparece; la franja se
 * queda a la vista hasta cerrarla o salir del proyecto.
 */
export function NovedadesProyecto({ proyecto }: { proyecto: string }) {
  const [items, setItems] = useState<NotificationDto[]>([]);

  useEffect(() => {
    let cancelado = false;
    setItems([]);
    tareasGateway
      .avisos(50, { proyecto, soloSinLeer: true })
      .then(async (p) => {
        if (cancelado || !p.items.length) return;
        setItems(p.items);
        await tareasGateway.marcarAvisosVistos(p.items.map((n) => n.id));
        avisarAvisosLeidos();
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [proyecto]);

  if (!items.length) return null;
  return (
    <Card className="novedades mb-3">
      <div className="novedades-head">
        <BellFill className="text-danger" />
        <b>Novedades</b>
        <span className="text-secondary small">{items.length} aviso{items.length === 1 ? '' : 's'} desde tu última visita · ya marcados como leídos</span>
        <Button size="sm" variant="link" className="ms-auto p-0 text-secondary" title="Cerrar" aria-label="Cerrar novedades" onClick={() => setItems([])}>
          <X size={20} />
        </Button>
      </div>
      <div className="novedades-lista">
        {items.map((n) => (
          <Link key={n.id} to={n.taskKey ? `/t/${n.taskKey}` : '/avisos'} className="aviso unread">
            <span className="aviso-ico" aria-hidden>{ICONO[n.type]}</span>
            <Avatar user={n.actor} />
            <span className="aviso-text">
              <b>{n.actor?.name ?? 'Alguien'}</b> {n.text}
              {n.taskTitle && <span className="d-block small text-secondary text-truncate">{n.taskKey} · {n.taskTitle}</span>}
            </span>
            <span className="small text-secondary text-nowrap">{hace(n.createdAt)}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
