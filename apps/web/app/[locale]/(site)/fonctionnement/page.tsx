import { getTranslations } from 'next-intl/server';
import { ContentPage, contentMetadata } from '@/components/ContentPage';
import { Link } from '@/i18n/navigation';
import { Clock, Truck, ArrowRight } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentMetadata('how-it-works', 'Comment ça marche');

export default async function Page() {
  const t = await getTranslations('contentPage.highlights');
  return (
    <>
      <ContentPage contentKey="how-it-works" fallbackTitle="Comment ça marche" />
      <section className="hiw-highlights">
        <div className="container">
          <span className="kicker">{t('kicker')}</span>
          <div className="hiw-highlights__grid">
            <Link href="/click-collect" className="hiw-highlights__card">
              <Clock />
              <h2>{t('ccTitle')}</h2>
              <p>{t('ccText')}</p>
              <span className="hiw-highlights__cta">
                {t('ccCta')} <ArrowRight />
              </span>
            </Link>
            <Link href="/livraison" className="hiw-highlights__card">
              <Truck />
              <h2>{t('deliveryTitle')}</h2>
              <p>{t('deliveryText')}</p>
              <span className="hiw-highlights__cta">
                {t('deliveryCta')} <ArrowRight />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
