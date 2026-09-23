import type { ActivityDto } from '@yorga/contracts';

const CAMPOS: Record<string, string> = {
  title: 'el título',
  description: 'la descripción',
  type: 'el tipo',
  priority: 'la prioridad',
  status: 'el estado',
  assignee: 'el asignado',
  followers: 'el seguimiento',
  parent: 'el padre',
  sprint: 'el sprint',
  estimate: 'la estimación',
  dueDate: 'la fecha de vencimiento',
  startDate: 'la fecha de inicio',
  tags: 'las etiquetas',
};

/** Frase legible de una entrada de actividad ("PabloS cambió el estado de X a Y"). */
export function ActividadTexto({ a }: { a: ActivityDto }) {
  const quien = a.actor?.name ?? 'Alguien';
  switch (a.action) {
    case 'created':
      return <><b>{quien}</b> creó la tarea</>;
    case 'imported':
      return <><b>{quien}</b> la importó de ClickUp</>;
    case 'comment':
      return <><b>{quien}</b> comentó</>;
    case 'attachment':
      return <><b>{quien}</b> adjuntó <span className="chg">{a.after}</span></>;
    case 'attachment_removed':
      return <><b>{quien}</b> quitó el adjunto <span className="chg">{a.before}</span></>;
    case 'rule':
      return <>se aplicó la regla <span className="chg">{a.after}</span>{a.actor ? <> (al actuar {quien})</> : null}</>;
    case 'description':
      return <><b>{quien}</b> editó la descripción</>;
    default:
      return (
        <>
          <b>{quien}</b> cambió {CAMPOS[a.action] ?? a.action}
          {a.before !== null && <> de <span className="chg">{a.before || '—'}</span></>}
          {a.after !== null && <> a <span className="chg">{a.after || '—'}</span></>}
        </>
      );
  }
}
