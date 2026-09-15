import { useMemo, useState } from 'react';
import type { BurndownDto } from '@yorga/contracts';

/**
 * Burndown del sprint: tareas sin terminar por día (línea) frente a la línea ideal (gris discontinua).
 * SVG puro: eje único, rejilla discreta, etiqueta directa del último valor y tooltip al pasar el ratón.
 */
export function Burndown({ data, puntos }: { data: BurndownDto; puntos: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const M = { top: 16, right: 56, bottom: 28, left: 34 };
  const serie = data.points.map((p) => (puntos ? p.remainingPoints : p.remaining));
  const total = puntos ? data.totalPoints : data.total;
  const n = data.points.length;
  const maxY = Math.max(total, ...serie, 1);
  const x = (i: number) => M.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - M.left - M.right));
  const y = (v: number) => M.top + (1 - v / maxY) * (H - M.top - M.bottom);
  const ideal = data.points.map((p) => (puntos && data.total ? (p.ideal / data.total) * data.totalPoints : p.ideal));
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = useMemo(() => {
    const paso = maxY <= 5 ? 1 : maxY <= 20 ? 5 : maxY <= 50 ? 10 : Math.ceil(maxY / 5 / 10) * 10;
    const t: number[] = [];
    for (let v = 0; v <= maxY; v += paso) t.push(v);
    return t;
  }, [maxY]);
  const fecha = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return `${d.getUTCDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getUTCMonth()]}`;
  };
  const etiquetasX = n <= 8 ? data.points.map((_, i) => i) : data.points.map((_, i) => i).filter((i) => i % Math.ceil(n / 7) === 0 || i === n - 1);
  const last = n - 1;
  const unidad = puntos ? 'pt' : 'tareas';

  if (n === 0) return <div className="text-secondary small">Sin datos todavía: el sprint no tiene tareas o no ha empezado.</div>;

  return (
    <div>
      <svg className="burndown" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Burndown: ${unidad} sin terminar por día`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={M.left - 6} y={y(t) + 3.5} fontSize={10} textAnchor="end" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {etiquetasX.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize={10} textAnchor="middle" fill="var(--muted)">{fecha(data.points[i].date)}</text>
        ))}
        {/* ideal: referencia neutra discontinua, de total a 0 en el rango del sprint */}
        <path d={path(ideal)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" />
        {/* real */}
        <path d={path(serie)} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(serie[last])} r={4} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
        <text x={x(last) + 8} y={y(serie[last]) + 4} fontSize={11} fontWeight={700} fill="var(--ink)">{serie[last]} {unidad}</text>
        {/* hover: zonas invisibles por punto + cruz */}
        {data.points.map((_, i) => (
          <rect key={i} x={x(i) - (n <= 1 ? 20 : (W - M.left - M.right) / (n - 1) / 2)} y={M.top} width={n <= 1 ? 40 : (W - M.left - M.right) / (n - 1)} height={H - M.top - M.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={x(hover)} cy={y(serie[hover])} r={5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
            <g transform={`translate(${Math.min(x(hover) + 10, W - 150)}, ${Math.max(M.top, y(serie[hover]) - 40)})`}>
              <rect width={140} height={44} rx={8} fill="var(--surface)" stroke="var(--border)" />
              <text x={8} y={16} fontSize={11} fill="var(--muted)">{fecha(data.points[hover].date)}</text>
              <text x={8} y={33} fontSize={12} fontWeight={700} fill="var(--ink)">{serie[hover]} {unidad} · ideal {Math.round(ideal[hover])}</text>
            </g>
          </g>
        )}
      </svg>
      <div className="d-flex gap-3 small text-secondary mt-1">
        <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px solid var(--brand)', verticalAlign: 'middle', marginRight: 6 }} />Sin terminar</span>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px dashed var(--muted)', verticalAlign: 'middle', marginRight: 6 }} />Ideal</span>
      </div>
    </div>
  );
}
