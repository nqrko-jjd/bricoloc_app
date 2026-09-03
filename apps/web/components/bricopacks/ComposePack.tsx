import type { CSSProperties } from 'react';
import { Link } from '@/i18n/navigation';
import { ArrowUpRight } from '@/components/icons';

type Tier = { minMachines: number; pct: number };

/**
 * Bloc « Composez votre pack » — pédagogie de la remise multi-machines.
 * Les paliers viennent de l'API (Admin → Paramètres) pour rester synchronisés.
 */
export function ComposePack({ tiers }: { tiers: Tier[] }) {
  const clean = [...tiers].filter((t) => t.pct > 0).sort((a, b) => a.minMachines - b.minMachines);
  if (clean.length === 0) return null;
  const max = clean[clean.length - 1]!;

  return (
    <section className="cpack" id="composer">
      <div className="cpack__intro">
        <span className="kicker">— Pas de pack tout fait pour votre projet ?</span>
        <h2>
          Composez le vôtre.
          <br />
          <i>La remise tombe toute seule.</i>
        </h2>
        <p>
          Ajoutez vos machines une à une au panier : dès {clean[0]!.minMachines}, une remise
          s’applique automatiquement sur la location — même pour une seule journée. Aucun code, aucun
          minimum de durée. Elle se cumule avec le tarif dégressif et la remise Pro.
        </p>
        <Link href="/catalogue" className="btn btn-primary">
          Composer mon pack <ArrowUpRight />
        </Link>
        <p className="cpack__note">
          Les BricoPacks préparés ci-dessus restent la meilleure affaire (jusqu’à −30 %) : accessoires
          et protections déjà inclus.
        </p>
      </div>

      <ol className="cpack__ladder" aria-label="Paliers de remise">
        {clean.map((t, i) => (
          <li
            key={t.minMachines}
            className={i === clean.length - 1 ? 'is-max' : undefined}
            style={
              { '--h': `${34 + (i * 46) / Math.max(1, clean.length - 1)}%` } as CSSProperties
            }
          >
            <span className="cpack__pct">−{Math.round(t.pct * 100)}%</span>
            <span className="cpack__bar" aria-hidden />
            <span className="cpack__count">
              {t.minMachines}
              {i === clean.length - 1 ? '+' : ''} machine{t.minMachines > 1 ? 's' : ''}
            </span>
          </li>
        ))}
      </ol>

      <p className="cpack__sronly">
        {clean.map((t) => `${t.minMachines} machines : −${Math.round(t.pct * 100)} %.`).join(' ')}
        {` À partir de ${max.minMachines}, la remise reste à −${Math.round(max.pct * 100)} %.`}
      </p>
    </section>
  );
}
