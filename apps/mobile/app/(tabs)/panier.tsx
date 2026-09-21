import { useState } from 'react';
import { Image, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import { mediaUrl } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import { Screen, H1, H2, P, Card, Button } from '@/components/ui';
import { DateRangePicker } from '@/components/DateRangePicker';

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `${s.toLocaleDateString('fr-BE', opts)} → ${e.toLocaleDateString('fr-BE', opts)} · ${days} jour${days > 1 ? 's' : ''}`;
}

export default function PanierScreen() {
  const { cart, setQty, removeItem, addItem, setPeriod } = useStore();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

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

      <Card style={cart.period ? undefined : { borderWidth: 2, borderColor: C.brico, borderStyle: 'dashed' }}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 4,
          }}
        >
          <View>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700' }}>DATES DE LOCATION</Text>
            <Text style={{ color: C.locDeep, fontWeight: '800', fontSize: 14.5, marginTop: 2 }}>
              {cart.period ? formatPeriod(cart.period.start, cart.period.end) : 'Choisir mes dates'}
            </Text>
          </View>
          <Text style={{ color: C.brico, fontWeight: '800', fontSize: 13 }}>
            {cart.period ? 'Modifier' : 'Choisir →'}
          </Text>
        </Pressable>
        {!cart.period && (
          <Text style={{ color: C.muted, fontSize: 12.5, marginTop: 6 }}>
            Pour voir le prix exact, la disponibilité de chaque article et les réductions longue durée.
          </Text>
        )}
      </Card>


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
                {al.status === 'PARTIAL' && al.availableQty > 0 ? (
                  <Text
                    onPress={() => setQty(al.productId, al.availableQty)}
                    style={{ color: C.loc, fontWeight: '800' }}
                  >
                    {'  '}Ramener à {al.availableQty}
                  </Text>
                ) : null}
              </Text>
            );
          })}
          <Text
            onPress={() => setPickerOpen(true)}
            style={{ color: C.loc, fontWeight: '800', marginTop: 6 }}
          >
            Modifier mes dates →
          </Text>
        </Card>
      )}

      {cart.items.map((it) => (
        <Card key={it.id}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {it.image ? (
              <Image
                source={{ uri: mediaUrl(it.image) }}
                style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: C.surface2 }}
                resizeMode="contain"
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '900',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: C.brico,
                }}
              >
                {it.isConsumable ? 'Consommable' : 'Machine'}
              </Text>
              <Text style={{ fontWeight: '800', color: C.ink, fontSize: 14.5, marginTop: 2 }}>{it.name}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>
                {formatEUR(it.dailyPrice)} / {it.isConsumable ? 'unité' : 'jour'}
                {!it.isConsumable && ` · caution ${formatEUR(it.deposit)}`}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 }}>
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
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              {cart.quote?.lines.find((l) => l.productId === it.productId) ? (
                <Text style={{ fontWeight: '800', color: C.loc }}>
                  {formatEUR(cart.quote.lines.find((l) => l.productId === it.productId)!.lineHT)}
                  <Text style={{ fontWeight: '400', color: C.muted, fontSize: 12 }}> HTVA</Text>
                </Text>
              ) : null}
              <Pressable onPress={() => removeItem(it.productId)}>
                <Text style={{ color: C.err, fontWeight: '600', marginTop: 2 }}>Retirer</Text>
              </Pressable>
            </View>
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
          <P muted>Choisissez vos dates ci-dessus pour calculer le prix et la TVA.</P>
        )}
      </Card>

      <Button
        title="Valider le panier"
        onPress={() => router.push('/commande')}
        disabled={cart.hasBlockingIssue || !cart.period}
      />
      {!cart.period && (
        <P muted>Choisissez vos dates de location avant de continuer.</P>
      )}
      {cart.hasBlockingIssue && (
        <P muted>Corrigez les articles indisponibles avant de continuer.</P>
      )}

      <DateRangePicker
        visible={pickerOpen}
        initialStart={cart.period?.start}
        initialEnd={cart.period?.end}
        onClose={() => setPickerOpen(false)}
        onConfirm={async (range) => {
          await setPeriod(range);
          setPickerOpen(false);
        }}
      />
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
