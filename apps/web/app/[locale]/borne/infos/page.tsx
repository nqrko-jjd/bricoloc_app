'use client';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@bricoloc/shared';

const T: Record<Locale, { back: string; howTitle: string; steps: string[]; faqTitle: string; faq: [string, string][] }> = {
  fr: {
    back: '← Retour',
    howTitle: 'Comment ça marche',
    steps: [
      '1 · Choisissez vos dates de location, une seule fois pour toute la commande.',
      '2 · Ajoutez vos machines et les consommables adaptés.',
      '3 · Payez sur la borne ou au comptoir (espèces ou carte).',
      '4 · Présentez votre QR code au comptoir pour retirer le matériel.',
      '5 · Rapportez le matériel nettoyé : la caution est libérée après contrôle.',
    ],
    faqTitle: 'Questions fréquentes',
    faq: [
      ['Comment est calculé le prix ?', 'Au jour, à la semaine (4× le tarif jour) ou au mois (12× le tarif jour). Ce sont vos dates qui fixent la durée facturée.'],
      ['La caution, c’est quoi ?', 'Une empreinte bancaire : le montant est bloqué sans être débité, puis libéré au retour si tout est en ordre. En Click & Collect, elle peut être laissée en espèces.'],
      ['Offre week-end ?', 'Retrait le vendredi ou samedi, retour le lundi matin : une seule journée facturée.'],
      ['Le matériel est-il fiable ?', 'Chaque machine est suivie à l’exemplaire, entretenue et contrôlée avant chaque location.'],
      ['Et si je casse quelque chose ?', 'On l’évalue au retour ; seule la remise en état est facturée, prélevée sur la caution.'],
      ['Livrez-vous sur chantier ?', 'Oui, dans la zone desservie. Le tarif dépend de la distance depuis le dépôt de Ruisbroek.'],
    ],
  },
  nl: {
    back: '← Terug',
    howTitle: 'Zo werkt het',
    steps: [
      '1 · Kies uw huurdata, één keer voor de hele bestelling.',
      '2 · Voeg uw machines en de bijbehorende verbruiksartikelen toe.',
      '3 · Betaal aan de zuil of aan de balie (cash of kaart).',
      '4 · Toon uw QR-code aan de balie om het materiaal af te halen.',
      '5 · Breng het materiaal schoon terug: de borg wordt vrijgegeven na controle.',
    ],
    faqTitle: 'Veelgestelde vragen',
    faq: [
      ['Hoe wordt de prijs berekend?', 'Per dag, per week (4× het dagtarief) of per maand (12× het dagtarief). Uw data bepalen de gefactureerde duur.'],
      ['Wat is de borg?', 'Een bankafdruk: het bedrag wordt geblokkeerd zonder afschrijving en na een correcte teruggave vrijgegeven. Bij Click & Collect kan hij in cash.'],
      ['Weekendaanbieding?', 'Ophalen op vrijdag of zaterdag, terugbrengen op maandagochtend: slechts één dag gefactureerd.'],
      ['Is het materiaal betrouwbaar?', 'Elke machine wordt per exemplaar opgevolgd, onderhouden en gecontroleerd voor elke verhuring.'],
      ['En als ik iets breek?', 'We schatten het in bij teruggave; alleen de herstelling wordt aangerekend, van de borg afgehouden.'],
      ['Leveren jullie op de werf?', 'Ja, binnen het bediende gebied. Het tarief hangt af van de afstand vanaf het magazijn in Ruisbroek.'],
    ],
  },
  en: {
    back: '← Back',
    howTitle: 'How it works',
    steps: [
      '1 · Choose your rental dates, once for the whole order.',
      '2 · Add your machines and the matching consumables.',
      '3 · Pay at the kiosk or at the counter (cash or card).',
      '4 · Show your QR code at the counter to collect the equipment.',
      '5 · Bring the equipment back clean: the deposit is released after inspection.',
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      ['How is the price calculated?', 'Per day, per week (4× the daily rate) or per month (12× the daily rate). Your dates set the billed duration.'],
      ['What is the deposit?', 'A card hold: the amount is blocked without being charged, then released on return if all is in order. For Click & Collect it can be left in cash.'],
      ['Weekend offer?', 'Collect on Friday or Saturday, return Monday morning: only one day billed.'],
      ['Is the equipment reliable?', 'Every machine is tracked individually, serviced and checked before each rental.'],
      ['What if I break something?', 'We assess it on return; only the repair is charged, taken from the deposit.'],
      ['Do you deliver to sites?', 'Yes, within the served area. The rate depends on the distance from the Ruisbroek depot.'],
    ],
  },
};

export default function BorneInfos() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = T[locale] ?? T.fr;

  return (
    <div className="kiosk-body kiosk-scroll">
      <button className="kiosk-back" onClick={() => router.push('/borne')}>
        {t.back}
      </button>

      <div className="kiosk-panel">
        <h1>{t.howTitle}</h1>
        <ul className="kiosk-steps">
          {t.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="kiosk-panel" id="faq">
        <h1>{t.faqTitle}</h1>
        {t.faq.map(([q, a]) => (
          <div key={q} className="kiosk-faq">
            <strong>{q}</strong>
            <p>{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
