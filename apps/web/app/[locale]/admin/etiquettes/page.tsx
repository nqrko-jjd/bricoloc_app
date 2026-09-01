'use client';
import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/staff';
import { Barcode } from '@/components/admin/Barcode';
import type { ProductDetail } from '@/lib/types';

interface Label {
  unitId: string;
  assetTag: string;
  barcode: string;
  productName: string;
  qrDataUrl: string;
}

export default function AdminEtiquettes() {
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [productId, setProductId] = useState('');
  const [labels, setLabels] = useState<Label[]>([]);
  const [count, setCount] = useState(1);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    staffApi<{ products: ProductDetail[] }>('/api/admin/products?kind=MACHINE').then((r) =>
      setProducts(r.products),
    );
  }, []);

  async function loadLabels(pid: string) {
    setProductId(pid);
    if (!pid) return setLabels([]);
    const r = await staffApi<{ labels: Label[] }>('/api/admin/labels', {
      method: 'POST',
      body: { productId: pid },
    });
    setLabels(r.labels);
  }

  return (
    <div className="stack">
      <div className="no-print stack">
        <h1>Étiquettes QR &amp; code-barres</h1>
        <p className="muted small">
          Une étiquette par exemplaire : QR code (scan smartphone / Zebra) + code-barres Code 128
          de l’identifiant + nom de la machine. Imprimez sur planche d’étiquettes autocollantes.
        </p>

        <div className="card card-body row">
          <div className="field" style={{ flex: 1 }}>
            <label>Machine</label>
            <select value={productId} onChange={(e) => loadLabels(e.target.value)}>
              <option value="">— choisir —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Créer des exemplaires</label>
            <div className="row">
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ width: 70 }}
              />
              <button
                className="btn btn-outline btn-sm"
                disabled={!productId}
                onClick={async () => {
                  const r = await staffApi<{ units: unknown[] }>('/api/admin/units/bulk', {
                    method: 'POST',
                    body: { productId, count },
                  });
                  setMsg(`${r.units.length} exemplaire(s) créé(s).`);
                  await loadLabels(productId);
                }}
              >
                + Créer
              </button>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={labels.length === 0}
            onClick={() => window.print()}
          >
            🖨 Imprimer {labels.length} étiquette(s)
          </button>
        </div>
        {msg && <div className="alert alert-ok">{msg}</div>}
      </div>

      <div className="label-sheet">
        {labels.map((l) => (
          <div key={l.unitId} className="label">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qrDataUrl} alt="" className="label__qr" />
            <div className="label__body">
              <strong className="label__tag">{l.assetTag}</strong>
              <span className="label__name">{l.productName}</span>
              <Barcode value={l.barcode} height={30} unit={1.3} />
              <span className="label__brand">BRICOLOC</span>
            </div>
          </div>
        ))}
        {labels.length === 0 && (
          <p className="muted no-print">Sélectionnez une machine pour générer ses étiquettes.</p>
        )}
      </div>
    </div>
  );
}
