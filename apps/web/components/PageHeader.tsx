import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

interface Crumb {
  label: string;
  href?: string;
}

/**
 * En-tête de page pour les pages internes (catalogue, contenus, pro…).
 * Bande légèrement teintée navy, fil d'Ariane optionnel, titre display + chapô.
 */
export function PageHeader({
  title,
  lead,
  breadcrumb,
  children,
}: {
  title: string;
  lead?: string;
  breadcrumb?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="container">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="page-header__crumb small">
            {breadcrumb.map((c, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden> / </span>}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {lead && <p className="page-header__lead measure">{lead}</p>}
        {children}
      </div>
    </header>
  );
}
