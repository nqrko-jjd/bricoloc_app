'use client';
import { code128Bars } from '@bricoloc/shared';

/** Code-barres Code 128 rendu en SVG (aucune dépendance). */
export function Barcode({
  value,
  height = 44,
  unit = 1.5,
  showText = true,
  fluid = false,
}: {
  value: string;
  height?: number;
  unit?: number;
  showText?: boolean;
  /** Occupe toute la largeur du conteneur (barres étirées, hauteur du conteneur). */
  fluid?: boolean;
}) {
  const bars = code128Bars(value);
  const width = bars.reduce((a, b) => a + b, 0) * unit;
  let x = 0;
  const rects: React.ReactNode[] = [];
  bars.forEach((w, i) => {
    if (i % 2 === 0) {
      rects.push(<rect key={i} x={x} y={0} width={w * unit} height={height} fill="#000" />);
    }
    x += w * unit;
  });
  const totalH = showText ? height + 14 : height;
  return (
    <svg
      viewBox={`0 0 ${Math.ceil(width)} ${totalH}`}
      width={fluid ? '100%' : Math.ceil(width)}
      height={fluid ? '100%' : totalH}
      preserveAspectRatio={fluid ? 'none' : undefined}
      role="img" aria-label={value}>
      {rects}
      {showText && (
        <text x={width / 2} y={height + 11} fontSize={10} textAnchor="middle" fontFamily="monospace">
          {value}
        </text>
      )}
    </svg>
  );
}
