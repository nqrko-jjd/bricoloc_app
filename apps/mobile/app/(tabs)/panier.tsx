import { Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { formatEUR } from '@/lib/format';
import { Screen, H1, H2, P, Card, Button } from '@/components/ui';

export default function PanierScreen() {
  const { cart, setQty, removeItem, addItem } = useStore();
  const router = useRouter();

  if (!cart || cart.items.length === 0)
    return (
      <Screen>
        <H1>Panier vide</H1>
        <P muted>Ajoutez des machines et accessoires depuis le catalogue.</P>
        <Button title="Voir le catalogue" onPress={() => router.push('/')} />
      </Screen>
    );

  return (
    <Screen>
      <H1>Votre panier</H1>

      {cart.availabilityAlerts.length > 0 && (
        <Card style={{ backgroundColor: C.warnBg, borderColor: '#f0d5a8' }}>
          <Text style={{ color: C.warn, fontWeight: '700' }}>Disponibilités</Text>
          {cart.availabilityAlerts.map((al) => {
            const it = cart.items.find((i) => i.productId === al.productId);
            return (
              <Text key={al.productId} style={{ color: C.warn, fontSize: 13 }}>
                • {it?.name} —{' '}
                {al.status === 'PARTIAL'
                  ? `${al.availableQty} dispo sur ${al.requestedQty}`
                  : al.status === 'NEARBY'
                    ? 'dispo à des dates proches'
                    : 'indisponible sur la période'}
              </Text>
            );
          })}
        </Card>
      )}

      {cart.items.map((it) => (
        <Card key={it.id}>
          <Text style={{ fontWeight: '700', color: C.loc }}>{it.name}</Text>
          <Text style={{ color: C.lightGray, fontSize: 12 }}>
            {formatEUR(it.dailyPrice)} / {it.isConsumable ? 'unité' : 'jour'}
            {!it.isConsumable && ` · caution ${formatEUR(it.deposit)}`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <Pressable
              onPress={() => setQty(it.productId, Math.max(1, it.quantity - 1))}
              style={step}
            >
              <Text style={stepT}>−</Text>
            </Pressable>
            <Text>{it.quantity}</Text>
            <Pressable onPress={() => setQty(it.productId, it.quantity + 1)} style={step}>
              <Text style={stepT}>+</Text>
            </Pressable>
            <Pressable onPress={() => removeItem(it.productId)} style={{ marginLeft: 'auto' }}>
              <Text style={{ color: C.err, fontWeight: '600' }}>Retirer</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      {cart.recommendations.map((g) => (
        <Card key={g.type + g.label}>
          <H2>{g.label}</H2>
          {g.products.map((rp) => (
            <View
              key={rp.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}
            >
              <Text style={{ flex: 1 }}>
                {rp.name}{' '}
                <Text style={{ color: C.lightGray }}>({formatEUR(rp.dailyPrice)})</Text>
              </Text>
              <Pressable
                onPress={() => addItem(rp.id, 1)}
                style={{ backgroundColor: C.loc, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: C.white, fontWeight: '700' }}>+ Ajouter</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ))}

      <Card>
        {cart.quote ? (
          <>
            <Row label="Location HTVA" value={formatEUR(cart.quote.totals.rentalHT)} />
            {(cart.quote.totals.composedPackDiscountHT ?? 0) > 0 && (
              <Row
                label={`Pack composé${cart.quote.totals.composedPackPct ? ` (−${Math.round(cart.quote.totals.composedPackPct * 100)} %)` : ''}`}
                value={`- ${formatEUR(cart.quote.totals.composedPackDiscountHT ?? 0)}`}
              />
            )}
            {(cart.quote.totals.promoDiscountHT ??
              cart.quote.totals.discountHT - (cart.quote.totals.composedPackDiscountHT ?? 0)) > 0 && (
              <Row
                label="Code promo"
                value={`- ${formatEUR(cart.quote.totals.promoDiscountHT ?? cart.quote.totals.discountHT - (cart.quote.totals.composedPackDiscountHT ?? 0))}`}
              />
            )}
            {cart.quote.composedPack?.next && (
              <Text style={{ color: C.brico, fontWeight: '800', fontSize: 12.5, marginVertical: 2 }}>
                + {cart.quote.composedPack.next.minMachines - cart.quote.composedPack.machineCount}{' '}
                machine
                {cart.quote.composedPack.next.minMachines - cart.quote.composedPack.machineCount > 1
                  ? 's'
                  : ''}{' '}
                → −{Math.round(cart.quote.composedPack.next.pct * 100)} %
              </Text>
            )}
            {cart.quote.totals.deliveryFeeHT > 0 && (
              <Row label="Livraison HTVA" value={formatEUR(cart.quote.totals.deliveryFeeHT)} />
            )}
            <Row
              label={`TVA ${Math.round(cart.quote.totals.vatRate * 100)} %`}
              value={formatEUR(cart.quote.totals.vatAmount)}
            />
            <Row label="Total TVAC" value={formatEUR(cart.quote.totals.totalTVAC)} bold />
            <Row label="Caution (restituée)" value={formatEUR(cart.quote.totals.depositsTotal)} muted />
            <Row label="À régler" value={formatEUR(cart.quote.totals.amountDue)} bold />
          </>
        ) : (
          <P muted>Indiquez vos dates (onglet Catalogue) pour calculer le prix et la TVA.</P>
        )}
      </Card>

      <Button
        title="Valider le panier"
        onPress={() => router.push('/commande')}
        disabled={cart.hasBlockingIssue}
      />
      {cart.hasBlockingIssue && (
        <P muted>Corrigez les articles indisponibles avant de continuer.</P>
      )}
    </Screen>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: muted ? C.lightGray : C.darkGray, fontWeight: bold ? '800' : '400' }}>
        {label}
      </Text>
      <Text style={{ color: bold ? C.loc : C.darkGray, fontWeight: bold ? '800' : '400' }}>
        {value}
      </Text>
    </View>
  );
}

const step = {
  backgroundColor: C.loc,
  width: 34,
  height: 34,
  borderRadius: 8,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const stepT = { color: C.white, fontSize: 18, fontWeight: '800' as const };
