import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { api } from '@/lib/api';
import { PackFilter, type PackCard } from '@/components/bricopacks/PackFilter';
import { ComposePack } from '@/components/bricopacks/ComposePack';
import { Truck, ShieldCheck, PackageIcon } from '@/components/icons';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'BricoPacks — tout le matériel d’un chantier en un pack | BRICOLOC',
  description:
    'La gamme BricoPack : machines, accessoires et outillage réunis autour de votre projet. Une tâche, un pack, un prix — jusqu’à −30 % vs la location séparée.',
};

const FAMILIES: [string, string][] = [
  ['tous', 'Tous'],
  ['peinture', 'Peinture'],
  ['sols-bois', 'Sols & bois'],
  ['carrelage', 'Carrelage'],
  ['gros-oeuvre', 'Gros œuvre'],
  ['plomberie', 'Plomberie'],
  ['electricite', 'Électricité'],
  ['jardin', 'Jardin'],
  ['nettoyage', 'Nettoyage'],
  ['hauteur', 'Hauteur'],
  ['manutention', 'Manutention'],
];

export default async function BricoPacksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { packs, count, composedPack } = await api<{
    packs: PackCard[];
    count: number;
    composedPack?: { enabled: boolean; tiers: { minMachines: number; pct: number }[] };
  }>(`/api/public/bricopacks?locale=${locale}`, { next: { revalidate: 120 } }).catch(() => ({
    packs: [] as PackCard[],
    count: 0,
    composedPack: undefined,
  }));

  return (
    <>
      <section className="bp-hero">
        <span className="kicker">— La gamme BricoPack 2026</span>
        <h1>
          Choisissez le résultat.
          <br />
          <i>On prépare le reste.</i>
        </h1>
        <p className="bp-hero__lead">
          Machines, accessoires, protections et petit outillage réunis autour de votre projet.
          Les consommables se calculent séparément, selon vos quantités.
        </p>
        <div className="bp-hero__stat">
          <strong>{count}</strong>
          <span>packs essentiels</span>
        </div>
      </section>

      <PackFilter packs={packs} families={FAMILIES} />

      {composedPack?.enabled && composedPack.tiers.length > 0 && (
        <ComposePack tiers={composedPack.tiers} />
      )}

      <section className="bp-bottom">
        <div>
          <PackageIcon />
          <h3>Le matériel réutilisable</h3>
          <p>Machines, accessoires, petit outillage et protections sont préparés ensemble, prêts à l’emploi.</p>
        </div>
        <div>
          <Truck />
          <h3>Retrait ou livraison</h3>
          <p>Retirez le pack au dépôt de Ruisbroek ou faites-le livrer à domicile ou sur le chantier.</p>
        </div>
        <div>
          <ShieldCheck />
          <h3>La juste quantité</h3>
          <p>Les consommables s’ajoutent à part, selon votre surface : vous ne payez que le nécessaire.</p>
        </div>
      </section>

      <section className="ccta reveal">
        <div>
          <span className="kicker" style={{ color: '#fff', opacity: 0.7 }}>
            — Un doute sur le pack ?
          </span>
          <h2>
            On vous aide à <i>choisir.</i>
          </h2>
        </div>
        <Link href="/contact">Nous contacter</Link>
      </section>
    </>
  );
}
