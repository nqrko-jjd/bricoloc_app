/** Mini graphe en aires, SVG pur (aucune dépendance). */
export function Sparkline({
  data,
  height = 48,
  accent = 'var(--primary)',
}: {
  data: number[];
  height?: number;
  accent?: string;
}) {
  const w = 240;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => [i * step, height - (v / max) * (height - 4) - 2] as const);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <path d={area} fill={accent} opacity="0.12" />
      <path d={line} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r="3" fill={accent} />
      )}
    </svg>
  );
}
