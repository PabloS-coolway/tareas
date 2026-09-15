import { useMemo, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import type { UserRefDto } from '@yorga/contracts';
import { Avatar } from './tareas-ui';

/** Cuadro de comentario con menciones: al escribir @ sale la lista de personas; Enter o clic la inserta. */
export function ComentarioInput({ value, onChange, equipo, id, placeholder }: { value: string; onChange: (v: string) => void; equipo: UserRefDto[]; id?: string; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [sel, setSel] = useState(0);
  const [caret, setCaret] = useState(0);

  // Texto tras el último @ antes del cursor (sin espacios) → término de búsqueda.
  const termino = useMemo(() => {
    const antes = value.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(antes);
    return m ? m[1] : null;
  }, [value, caret]);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const candidatos = useMemo(() => (termino === null ? [] : equipo.filter((u) => norm(u.name).includes(norm(termino)) || norm(u.email).startsWith(norm(termino))).slice(0, 6)), [termino, equipo]);

  function insertar(u: UserRefDto) {
    const antes = value.slice(0, caret).replace(/@[^\s@]*$/, `@${u.name} `);
    const despues = value.slice(caret);
    onChange(antes + despues);
    setTimeout(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = antes.length;
        setCaret(antes.length);
      }
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!candidatos.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, candidatos.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertar(candidatos[Math.min(sel, candidatos.length - 1)]);
    } else if (e.key === 'Escape') {
      setCaret(-1);
    }
  }

  return (
    <div className="mention-box">
      {candidatos.length > 0 && (
        <div className="mention-list">
          {candidatos.map((u, i) => (
            <button key={u.id} type="button" className={`mention-item ${i === sel ? 'sel' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => insertar(u)}>
              <Avatar user={u} />
              <span>{u.name}</span>
              <span className="small text-secondary ms-auto">{u.email}</span>
            </button>
          ))}
        </div>
      )}
      <Form.Control
        as="textarea"
        ref={ref}
        id={id}
        rows={3}
        placeholder={placeholder ?? 'Escribe un comentario… (@ para mencionar)'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret((e.target as HTMLTextAreaElement).selectionStart ?? e.target.value.length);
          setSel(0);
        }}
        onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
