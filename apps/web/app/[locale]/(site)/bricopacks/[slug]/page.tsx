import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { formatEUR } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { CheckCircle, ArrowRight } from '@/components/icons';
import { ReservePack } from '@/components/bricopacks/ReservePack';

export const dynamic = 'force-dynamic';

type Pack = {
  id: string;
  slug: string;
  name: string;
  intro: string;
  image: string | null;
  family: string;
  level: string | null;
  teamSize: string | null;
  dailyPrice: number;
  separateTotal: number;
  savingPerDay: number;
  discountPct: number | null;
  items: { slug: string; role: string; why: string; name: string; dailyPrice: number; image: string | null }[];
  consumables: { label: string; detail: string; price: number }[];
  related: { slug: string; name: string; family: string | null }[];
};

const FAM_LABEL: Record<string, string> = {
  peinture: 'Peinture',
  'sols-bois': 'Sols & bois',
  carrelage: 'Carrelage',
  'gros-oeuvre': 'Gros œuvre',
  plomberie: 'Plomberie',
  electricite: 'Électricité',
  jardin: 'Jardin',
  nettoyage: 'Nettoyage',
  hauteur: 'Hauteur',
  manutention: 'Manutention',
};

async function getPack(slug: string, locale: string) {
  return api<{ pack: Pack }>(`/api/public/bricopacks/${slug}?locale=${locale}`, {
    next: { revalidate: 120 },
  })
    .then((r) => r.pack)
    .catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const pack = await getPack(slug, locale);
  if (!pack) return { title: 'BricoPack introuvable' };
  return {
    title: `BricoPack ${pack.name} — ${pack.items.length} outils, ${formatEUR(pack.dailyPrice)}/jour | BRICOLOC`,
    description: pack.intro,
  };
}

export default async function BricoPackDetail({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const pack = await getPack(slug, locale);
  if (!pack) notFound();

  const consoBase = pack.consumables.reduce((a, c) => a + c.price, 0);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className={`bpd-hero${pack.image ? ' bpd-hero--img' : ''}`}>
        {pack.image && (
          <div className="bpd-hero__media" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pack.image} alt="" />
          </div>
        )}
        <div className="bpd-hero__text">
          <span className="kicker">— BricoPack · {FAM_LABEL[pack.family] ?? pack.family}</span>
          <h1>
            {pack.name}
            <i>.</i>
          </h1>
          <p className="bpd-hero__lead">{pack.intro}</p>
          <div className="bpd-hero__badges">
            <span>{pack.items.length} outils inclus</span>
            {pack.level && <span>Niveau {pack.level}</span>}
            <span>Assistance incluse</span>
          </div>
          <a href="#contenu" className="csection__link">
            Découvrir le contenu ↓
          </a>
        </div>
      </section>

      <section className="bpd-tagline">
        <p>
          Une seule caisse. <i>Tout votre projet.</i>
        </p>
      </section>

      {/* ---------- CONTENU ---------- */}
      <section className="bpd-items" id="contenu">
        <div className="csection__head">
          <div>
            <span className="kicker">— Votre pack se dévoile</span>
            <h2>
              Chaque outil a <i>une vraie raison d’être.</i>
            </h2>
          </div>
        </div>

        <ol className="bpd-list">
          {pack.items.map((it, i) => (
            <li key={it.slug} className="bpd-item reveal">
              <span className="bpd-item__n">{String(i + 1).padStart(2, '0')}</span>
              <div className="bpd-item__art">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt={it.name} loading="lazy" />
                ) : (
                  <span className="bpd-item__ph" aria-hidden />
                )}
              </div>
              <div className="bpd-item__body">
                <span className="bpd-item__role">{it.role}</span>
                <h3>{it.name}</h3>
                <p>{it.why}</p>
                <span className="bpd-item__price">
                  Location seule&nbsp;: {formatEUR(it.dailyPrice)} / jour
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- COMPARATIF ---------- */}
      <section className="bpd-compare reveal">
        <span className="kicker">— Le pack est plus avantageux</span>
        <h2>
          Tout louer séparément&nbsp;? <i>Faites le calcul.</i>
        </h2>
        <div className="bpd-compare__grid">
          <div>
            <span>{pack.items.length} outils séparés</span>
            <strong className="is-strike">{formatEUR(pack.separateTotal)} / jour</strong>
          </div>
          <div className="is-pack">
            <span>Prix du BricoPack</span>
            <strong>{formatEUR(pack.dailyPrice)} / jour</strong>
          </div>
          <div className="bpd-compare__save">
            <span>Vous économisez</span>
            <strong>{formatEUR(pack.savingPerDay)} / jour</strong>
            {pack.discountPct ? <em>−{Math.round(pack.discountPct * 100)} %</em> : null}
          </div>
        </div>
        <p className="bpd-compare__note">
          Un seul retrait, une seule réservation, du matériel pensé pour fonctionner ensemble.
        </p>
      </section>

      {/* ---------- CONSOMMABLES ---------- */}
      {pack.consumables.length > 0 && (
        <section className="bpd-conso">
          <div className="csection__head">
            <div>
              <span className="kicker">— Complétez votre pack</span>
              <h2>
                Ajoutez <i>ce qu’il vous faut.</i>
              </h2>
            </div>
          </div>
          <p className="bpd-conso__lead">
            Les consommables restent optionnels et s’ajoutent au panier après la réservation du
            pack, selon votre surface.
          </p>
          <div className="bpd-conso__grid">
            {pack.consumables.map((c) => (
              <div key={c.label} className="bpd-conso__card">
                <span className="bpd-conso__name">{c.label}</span>
                <span className="bpd-conso__detail">{c.detail}</span>
                {c.price > 0 && <span className="bpd-conso__price">{formatEUR(c.price)}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- RÉASSURANCE ---------- */}
      <section className="bpd-trust reveal">
        <span className="kicker">— À vous de jouer</span>
        <h2>
          Le bon matériel. <i>Au bon moment.</i>
        </h2>
        <ul>
          <li>
            <CheckCircle /> Matériel vérifié et prêt à l’emploi
          </li>
          <li>
            <CheckCircle /> Tutoriel accessible depuis votre réservation
          </li>
          <li>
            <CheckCircle /> Assistance pendant votre projet
          </li>
        </ul>
      </section>

      {/* ---------- PACKS LIÉS ---------- */}
      {pack.related.length > 0 && (
        <section className="bpd-related">
          <div className="csection__head">
            <div>
              <span className="kicker">— Pour continuer votre projet</span>
              <h2>D’autres packs qui pourraient vous aider.</h2>
            </div>
            <Link href="/bricopacks" className="csection__link">
              Tous les BricoPacks <ArrowRight />
            </Link>
          </div>
          <div className="bpd-related__grid">
            {pack.related.map((r) => (
              <Link key={r.slug} href={`/bricopacks/${r.slug}`} className="bpd-related__card">
                <span>{FAM_LABEL[r.family ?? ''] ?? r.family}</span>
                <strong>{r.name}</strong>
                <em>Découvrir le pack →</em>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- RÉSERVATION ---------- */}
      <section className="bpd-reserve" id="reserver">
        <div>
          <span className="kicker">— Votre réservation</span>
          <h2>
            Prêt à <i>commencer&nbsp;?</i>
          </h2>
          <p className="bpd-reserve__note">
            Le choix des dates et la disponibilité viennent à l’étape suivante.
          </p>
        </div>
        <div className="bpd-reserve__box">
          <div className="bpd-reserve__line">
            <span>BricoPack {pack.name}</span>
            <strong>{formatEUR(pack.dailyPrice)}</strong>
          </div>
          <div className="bpd-reserve__line bpd-reserve__line--muted">
            <span>Consommables (optionnels)</span>
            <span>dès {formatEUR(consoBase)}</span>
          </div>
          <ReservePack packId={pack.id} price={pack.dailyPrice} />
        </div>
      </section>
    </>
  );
}
