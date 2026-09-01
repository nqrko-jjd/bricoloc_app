import { Link } from '@/i18n/navigation';

export function Logo({ href = '/', onDark = false }: { href?: string; onDark?: boolean }) {
  return (
    <Link href={href} className={`logo${onDark ? ' on-dark' : ''}`} aria-label="BRICOLOC">
      <span className="b">BRICO</span>
      <span className="l">LOC</span>
    </Link>
  );
}
