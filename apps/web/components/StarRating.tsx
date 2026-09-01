/** Affichage d'une note sur 5 en étoiles (demi-étoiles supportées à l'arrondi). */
export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="stars" aria-label={`${value} sur 5`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rounded ? 'is-full' : i - 0.5 === rounded ? 'is-half' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}
