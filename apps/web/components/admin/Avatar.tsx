/** Avatar généré (initiales sur fond coloré) — pas de photo stockée pour les clients. */
const COLORS = ['#EE2C24', '#08065d', '#12833f', '#a85f00', '#6c3fb5', '#0f7a8c', '#c2410c'];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function Avatar({
  firstName,
  lastName,
  size = 36,
}: {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
}) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const bg = colorFor(`${firstName ?? ''}${lastName ?? ''}` || '?');
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.4,
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </span>
  );
}
