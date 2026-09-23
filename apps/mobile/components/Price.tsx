import { Text, type TextStyle } from 'react-native';
import { formatEUR } from '@/lib/format';
import { usePriceDisplay } from '@/lib/usePriceDisplay';

/**
 * Affiche un prix stocké HT au bon tarif client : TVAC par défaut (loi belge —
 * prix affiché au grand public = TTC), HTVA pour les comptes PRO. Ne jamais
 * passer `formatEUR(product.dailyPrice)` directement dans un écran client.
 */
export function Price({
  amountHT,
  suffix,
  style,
}: {
  amountHT: number;
  suffix?: string;
  style?: TextStyle | TextStyle[];
}) {
  const { display } = usePriceDisplay();
  return (
    <Text style={style}>
      {formatEUR(display(amountHT))}
      {suffix}
    </Text>
  );
}
