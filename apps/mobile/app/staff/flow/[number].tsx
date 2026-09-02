import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import SignatureScreen from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { staffApi } from '@/lib/staff';
import { API_URL, mediaUrl } from '@/lib/api';
import { C, R } from '@/lib/theme';
import { StaffScreen, BigButton } from '@/components/staff/kit';
import { ScanInput } from '@/components/staff/ScanInput';

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = (n: number) => `${(n ?? 0).toFixed(2)} €`;
const PICKUP_CHECKS: [string, string][] = [
  ['complet', 'Matériel & accessoires complets'],
  ['propre', 'Propre, prêt à l’emploi'],
  ['fonctionnel', 'Testé, fonctionnel'],
  ['notice', 'Notice / consignes remises'],
];
const RETURN_CHECKS: [string, string][] = [
  ['complet', 'Complet (accessoires, câbles…)'],
  ['nettoye', 'Rendu nettoyé'],
  ['fonctionnel', 'Fonctionne normalement'],
];

export default function StaffFlow() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const [scan, setScan] = useState<any>(null);
  const [isReturn, setIsReturn] = useState(false);
  const [step, setStep] = useState<string>('summary');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [assigned, setAssigned] = useState<Record<string, { assetTag: string; productId: string }>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [cleaningFee, setCleaningFee] = useState('0');
  const [damages, setDamages] = useState<{ unitId: string; description: string; feeHT: string }[]>([]);
  const [depositAction, setDepositAction] = useState<'RELEASE' | 'PARTIAL' | 'CAPTURE'>('RELEASE');
  const [depositCaptured, setDepositCaptured] = useState('0');
  const [result, setResult] = useState('');
  const sigRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await staffApi<any>(`/api/ops/scan/${encodeURIComponent(number!)}`);
      setScan(r);
      setIsReturn(['OUT', 'RETURN_PENDING'].includes(r.reservation.status));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Réservation introuvable');
    }
  }, [number]);
  useFocusEffect(
    useCallback(() => {
      if (step === 'summary') load();
    }, [load, step]),
  );

  const r = scan?.reservation;
  const machineItems: any[] = useMemo(
    () => (r?.items ?? []).filter((i: any) => i.kind === 'MACHINE'),
    [r],
  );
  const totalMachines = machineItems.reduce((a, i) => a + i.quantity, 0);
  const assignedCount = Object.keys(assigned).length;
  const productNeeds = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of machineItems) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
    return m;
  }, [machineItems]);
  const rentedUnits: any[] = useMemo(
    () =>
      (r?.items ?? [])
        .flatMap((i: any) => (i.units ?? []).map((ru: any) => ru.unit))
        .filter(Boolean),
    [r],
  );

  function assignUnit(code: string) {
    setErr('');
    const unit = r.items
      .flatMap((i: any) => i.product.units)
      .find(
        (u: any) =>
          u.assetTag?.toUpperCase() === code.toUpperCase() || u.qrToken === code || u.barcode === code,
      );
    if (!unit) return setErr(`« ${code} » n’appartient pas à cette réservation`);
    if (assigned[unit.id]) return;
    const already = Object.values(assigned).filter((a) => a.productId === unit.productId).length;
    if (already >= (productNeeds.get(unit.productId) ?? 0))
      return setErr('Déjà assez d’exemplaires pour cette machine');
    if (unit.state !== 'AVAILABLE') return setErr(`${unit.assetTag} est « ${unit.state} »`);
    setAssigned((s) => ({ ...s, [unit.id]: { assetTag: unit.assetTag, productId: unit.productId } }));
  }

  async function addPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setErr('Accès caméra refusé');
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    const token = await AsyncStorage.getItem('bricoloc_staff_token');
    const fd = new FormData();
    fd.append('files', { uri: res.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
    try {
      const up = await fetch(`${API_URL}/api/admin/uploads`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await up.json();
      const url = j.media?.[0]?.url ?? j.files?.[0]?.url ?? j.url;
      if (url) setPhotos((p) => [...p, url]);
      else setErr('Photo non enregistrée');
    } catch {
      setErr('Photo non envoyée');
    }
  }

  async function collect(method: string) {
    setBusy(true);
    setErr('');
    try {
      await staffApi(`/api/ops/reservations/${r.id}/collect`, { method: 'POST', body: { method } });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Encaissement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function validatePickup(sig?: string | null) {
    setBusy(true);
    setErr('');
    try {
      await staffApi('/api/ops/pickup', {
        method: 'POST',
        body: {
          reservationId: r.id,
          unitIds: Object.keys(assigned),
          checklist: checks,
          photos,
          customerSignature: sig || 'data:image/png;base64,',
          note: '',
        },
      });
      setStep('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur à la validation');
    } finally {
      setBusy(false);
    }
  }

  async function validateReturn() {
    setBusy(true);
    setErr('');
    try {
      const res = await staffApi<any>('/api/ops/return', {
        method: 'POST',
        body: {
          reservationId: r.id,
          actualReturnAt: new Date().toISOString(),
          checklist: checks,
          photos,
          damages: damages
            .filter((d) => d.unitId)
            .map((d) => ({
              unitId: d.unitId,
              description: d.description,
              feeHT: Number(d.feeHT) || 0,
              photos: [],
            })),
          missingAccessories: [],
          cleaningFeeHT: Number(cleaningFee) || 0,
          otherFeeHT: 0,
          otherFeeReason: '',
          depositAction,
          depositCapturedAmount: Number(depositCaptured) || 0,
        },
      });
      setResult(
        `Retard ${res.lateDays} j (${money(res.lateFeeHT)}). ` +
          `Caution : remboursé ${money(res.deposit.refunded)}, retenu ${money(res.deposit.captured)}. ` +
          `Facture ${res.finalInvoice}.`,
      );
      setStep('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur au retour');
    } finally {
      setBusy(false);
    }
  }

  if (err && !r)
    return (
      <StaffScreen title="Réservation" onBack={() => router.replace('/staff/counter' as any)}>
        <Text style={{ color: C.err, fontWeight: '700' }}>{err}</Text>
      </StaffScreen>
    );
  if (!r)
    return (
      <StaffScreen title="Réservation">
        <ActivityIndicator color={C.loc} />
      </StaffScreen>
    );

  const customer = r.user
    ? `${r.user.firstName} ${r.user.lastName}`
    : `${r.contact?.firstName ?? ''} ${r.contact?.lastName ?? ''}`.trim() || 'Invité';

  /* ---- SIGNATURE plein écran ---- */
  if (step === 'sign') {
    return (
      <StaffScreen title={r.number} onBack={() => setStep('check')} scroll={false}>
        <Text style={{ fontWeight: '800', color: C.ink }}>Le client signe la remise</Text>
        <View style={{ flex: 1, borderWidth: 2, borderColor: C.border, borderRadius: 12, overflow: 'hidden' }}>
          <SignatureScreen
            ref={sigRef}
            onOK={(sig: string) => validatePickup(sig)}
            onEmpty={() => validatePickup(null)}
            descriptionText=""
            webStyle=".m-signature-pad--footer{display:none} .m-signature-pad{box-shadow:none;border:none} body,html{height:100%;margin:0}"
          />
        </View>
        {err ? <Text style={{ color: C.err, fontWeight: '700' }}>{err}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <BigButton label="Effacer" tone="outline" onPress={() => sigRef.current?.clearSignature()} />
          </View>
          <View style={{ flex: 2 }}>
            <BigButton
              label={busy ? '…' : 'Valider la sortie'}
              tone="red"
              disabled={busy}
              onPress={() => sigRef.current?.readSignature()}
            />
          </View>
        </View>
      </StaffScreen>
    );
  }

  return (
    <StaffScreen title={r.number} onBack={() => router.replace('/staff/counter' as any)}>
      {err ? <Text style={{ color: C.err, fontWeight: '700' }}>{err}</Text> : null}

      {/* ---- RÉSUMÉ ---- */}
      {step === 'summary' && (
        <>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{customer}</Text>
          <Text style={{ color: C.muted }}>
            {r.fulfilmentMode === 'DELIVERY' ? 'Livraison' : `Retrait — ${r.pickupPoint?.name ?? 'Dépôt'}`}
          </Text>
          <View style={{ gap: 2 }}>
            {r.items.map((i: any) => (
              <Text key={i.id} style={{ color: C.ink }}>
                {i.quantity}× {i.nameSnapshot}
              </Text>
            ))}
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            <Text
              style={{
                backgroundColor: scan.paid ? C.okBg : C.warnBg,
                color: scan.paid ? C.ok : C.warn,
                fontWeight: '800',
                padding: 12,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {scan.paid
                ? '✓ Location payée'
                : `● À encaisser${r.totals?.totalTVAC ? ` — ${money(r.totals.totalTVAC)}` : ''}`}
            </Text>
            <Text
              style={{
                backgroundColor: scan.depositHeld ? C.okBg : C.warnBg,
                color: scan.depositHeld ? C.ok : C.warn,
                fontWeight: '800',
                padding: 12,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              Caution {r.deposit ? money(r.deposit.amount) : '—'}
              {scan.depositHeld ? ' · empreinte OK' : ''}
            </Text>
          </View>

          {!scan.paid && !isReturn && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['CASH', 'BANCONTACT', 'CARD'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => collect(m)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: R.sm,
                    paddingVertical: 14,
                    alignItems: 'center',
                    backgroundColor: C.white,
                  }}
                >
                  <Text style={{ fontWeight: '800', color: C.ink }}>
                    {m === 'CASH' ? 'Espèces' : m === 'CARD' ? 'Carte' : 'Bancontact'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {isReturn ? (
            <BigButton label="Contrôler le retour →" onPress={() => setStep('check')} />
          ) : (
            <BigButton
              label={scan.paid ? 'Préparer le matériel →' : 'Encaisser d’abord'}
              tone="navy"
              disabled={!scan.paid}
              onPress={() => setStep(totalMachines > 0 ? 'units' : 'check')}
            />
          )}
        </>
      )}

      {/* ---- SCAN MACHINES ---- */}
      {step === 'units' && !isReturn && (
        <>
          <ScanInput onScan={assignUnit} hint="Scanner chaque machine prise en rayon" />
          <Text style={{ fontWeight: '800', color: C.ink }}>
            {assignedCount}/{totalMachines} scannées
          </Text>
          {machineItems.map((i: any) => {
            const got = Object.values(assigned).filter((a) => a.productId === i.productId);
            const locs = [
              ...new Set(
                (i.product?.units ?? [])
                  .filter((u: any) => u.state === 'AVAILABLE' && u.storageLocation)
                  .map((u: any) => u.storageLocation as string),
              ),
            ];
            return (
              <View
                key={i.id}
                style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 10 }}
              >
                <Text style={{ fontWeight: '700', color: C.ink }}>
                  {i.nameSnapshot} · {got.length}/{i.quantity}
                  {locs.length > 0 ? `   📍 ${locs.join(', ')}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {got.map((g) => (
                    <Text key={g.assetTag} style={{ color: C.ok, fontWeight: '700' }}>
                      ✓ {g.assetTag}
                    </Text>
                  ))}
                  {got.length < i.quantity && <Text style={{ color: C.muted }}>à scanner…</Text>}
                </View>
              </View>
            );
          })}
          <BigButton
            label="Contrôle →"
            disabled={assignedCount < totalMachines}
            onPress={() => setStep('check')}
          />
        </>
      )}

      {/* ---- CONTRÔLE ---- */}
      {step === 'check' && (
        <>
          {(isReturn ? RETURN_CHECKS : PICKUP_CHECKS).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setChecks((s) => ({ ...s, [k]: !s[k] }))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 2,
                borderColor: checks[k] ? C.ok : C.border,
                backgroundColor: checks[k] ? C.okBg : C.white,
                borderRadius: 14,
                padding: 16,
              }}
            >
              <Ionicons
                name={checks[k] ? 'checkmark-circle' : 'ellipse-outline'}
                size={26}
                color={checks[k] ? C.ok : C.muted}
              />
              <Text style={{ fontWeight: '700', color: C.ink, flex: 1 }}>{label}</Text>
            </Pressable>
          ))}

          <Text style={{ fontWeight: '800', color: C.ink, marginTop: 4 }}>
            Photos {isReturn ? 'au retour' : 'à la sortie'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {photos.map((u) => (
              <Image
                key={u}
                source={{ uri: mediaUrl(u) }}
                style={{ width: 74, height: 74, borderRadius: 10, backgroundColor: C.surface2 }}
              />
            ))}
            <Pressable
              onPress={addPhoto}
              style={{
                width: 74,
                height: 74,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: C.border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="camera" size={22} color={C.muted} />
            </Pressable>
          </View>

          {isReturn && (
            <>
              {rentedUnits.some((u) => u?.storageLocation) && (
                <View style={{ backgroundColor: C.surface2, borderRadius: 10, padding: 12, marginTop: 4 }}>
                  <Text style={{ fontWeight: '800', color: C.ink }}>À ranger :</Text>
                  {rentedUnits
                    .filter((u) => u?.storageLocation)
                    .map((u) => (
                      <Text key={u.id} style={{ color: C.ink }}>
                        {u.assetTag} 📍 {u.storageLocation}
                      </Text>
                    ))}
                </View>
              )}

              <Text style={{ fontWeight: '800', color: C.ink, marginTop: 4 }}>Frais de nettoyage HTVA</Text>
              <TextInput
                value={cleaningFee}
                onChangeText={setCleaningFee}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: C.white,
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: R.sm,
                  padding: 12,
                }}
              />

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 4,
                }}
              >
                <Text style={{ fontWeight: '800', color: C.ink }}>Dommages</Text>
                <Pressable
                  onPress={() =>
                    setDamages((s) => [
                      ...s,
                      { unitId: rentedUnits[0]?.id ?? '', description: '', feeHT: '0' },
                    ])
                  }
                >
                  <Text style={{ color: C.brico, fontWeight: '800' }}>+ Ajouter</Text>
                </Pressable>
              </View>
              {damages.map((d, idx) => (
                <View
                  key={idx}
                  style={{ gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 }}
                >
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {rentedUnits.map((u) => (
                      <Pressable
                        key={u.id}
                        onPress={() =>
                          setDamages((s) => s.map((x, i) => (i === idx ? { ...x, unitId: u.id } : x)))
                        }
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: R.pill,
                          backgroundColor: d.unitId === u.id ? C.loc : C.surface2,
                        }}
                      >
                        <Text
                          style={{
                            color: d.unitId === u.id ? '#fff' : C.muted,
                            fontWeight: '700',
                            fontSize: 12,
                          }}
                        >
                          {u.assetTag}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    placeholder="Description du dommage"
                    placeholderTextColor={C.muted}
                    value={d.description}
                    onChangeText={(t) =>
                      setDamages((s) => s.map((x, i) => (i === idx ? { ...x, description: t } : x)))
                    }
                    style={{
                      backgroundColor: C.white,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: R.sm,
                      padding: 10,
                    }}
                  />
                  <TextInput
                    placeholder="€ HT"
                    placeholderTextColor={C.muted}
                    value={d.feeHT}
                    onChangeText={(t) =>
                      setDamages((s) => s.map((x, i) => (i === idx ? { ...x, feeHT: t } : x)))
                    }
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: C.white,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: R.sm,
                      padding: 10,
                    }}
                  />
                </View>
              ))}
            </>
          )}

          <BigButton
            label={isReturn ? 'Caution →' : 'Signature →'}
            onPress={() => setStep(isReturn ? 'deposit' : 'sign')}
          />
        </>
      )}

      {/* ---- CAUTION (retour) ---- */}
      {step === 'deposit' && isReturn && (
        <>
          <Text style={{ fontWeight: '800', color: C.ink }}>
            Caution {r.deposit ? money(r.deposit.amount) : '—'}
          </Text>
          {(
            [
              ['RELEASE', 'Tout libérer'],
              ['PARTIAL', 'Retenir une partie'],
              ['CAPTURE', 'Tout retenir'],
            ] as const
          ).map(([v, label]) => (
            <Pressable
              key={v}
              onPress={() => setDepositAction(v)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 2,
                borderColor: depositAction === v ? C.loc : C.border,
                backgroundColor: depositAction === v ? C.lavender : C.white,
                borderRadius: 14,
                padding: 16,
              }}
            >
              <Ionicons
                name={depositAction === v ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color={depositAction === v ? C.loc : C.muted}
              />
              <Text style={{ fontWeight: '700', color: C.ink }}>{label}</Text>
            </Pressable>
          ))}
          {depositAction === 'PARTIAL' && (
            <TextInput
              value={depositCaptured}
              onChangeText={setDepositCaptured}
              keyboardType="decimal-pad"
              placeholder="Montant retenu (€)"
              placeholderTextColor={C.muted}
              style={{
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: R.sm,
                padding: 12,
              }}
            />
          )}
          <BigButton
            label={busy ? '…' : 'Clôturer & facturer'}
            tone="red"
            disabled={busy}
            onPress={validateReturn}
          />
        </>
      )}

      {/* ---- FAIT ---- */}
      {step === 'done' && (
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 30 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: C.ok,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={34} color="#fff" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.ink }}>
            {isReturn ? 'Retour clôturé' : 'Matériel remis — location active'}
          </Text>
          {result ? <Text style={{ color: C.muted, textAlign: 'center' }}>{result}</Text> : null}
          <BigButton label="Suivant" tone="navy" onPress={() => router.replace('/staff/counter' as any)} />
        </View>
      )}
    </StaffScreen>
  );
}
