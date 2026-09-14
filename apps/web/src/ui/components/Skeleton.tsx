/**
 * Placeholder de carga (skeleton) con brillo, para no mostrar el contenido "apareciendo de golpe" desde el
 * centro. Se usa mientras una vista carga; se reemplaza por el contenido real cuando llega.
 */
export function Skeleton({ className, width, height, rounded = true, style }: { className?: string; width?: number | string; height?: number | string; rounded?: boolean; style?: React.CSSProperties }) {
  return <span className={`skeleton ${rounded ? 'skeleton-rounded' : ''} ${className ?? ''}`} style={{ width, height, ...style }} aria-hidden />;
}

/** Varias líneas de skeleton (para textos/listas). */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={14} className="d-block mb-2" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/** Skeleton de una tabla: cabecera + N filas. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-row skeleton-head">
        {Array.from({ length: cols }, (_, i) => (<Skeleton key={i} height={12} />))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skeleton-row">
          {Array.from({ length: cols }, (_, i) => (<Skeleton key={i} height={14} />))}
        </div>
      ))}
    </div>
  );
}
