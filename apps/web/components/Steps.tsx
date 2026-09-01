const LABELS = [
  'Matériel principal',
  'Accessoires',
  'Retrait / livraison',
  'Coordonnées',
  'Paiement',
  'Confirmation',
];

export function Steps({ current }: { current: number }) {
  return (
    <div className="steps">
      {LABELS.map((l, i) => (
        <div
          key={l}
          className={`step${i === current ? ' active' : ''}${i < current ? ' done' : ''}`}
        >
          {i + 1}. {l}
        </div>
      ))}
    </div>
  );
}
