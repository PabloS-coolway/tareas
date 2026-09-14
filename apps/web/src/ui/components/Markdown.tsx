import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Texto enriquecido en Markdown (GitHub Flavored: tablas, listas de tareas, tachado, enlaces automáticos).
 * Sin HTML crudo: lo que venga como etiqueta se pinta como texto, así un comentario no puede inyectar nada.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
          input: ({ checked }) => <input type="checkbox" checked={!!checked} readOnly className="form-check-input me-1" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
