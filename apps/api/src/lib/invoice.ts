import { mkdirSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { buildInvoiceNumber, formatDateBE, formatEUR } from '@bricoloc/shared';
import { prisma, nextCounter } from '../db.js';
import { getSettings } from './settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const INVOICE_DIR = path.resolve(here, '../../uploads/invoices');

export interface InvoiceLine {
  label: string;
  qty: number;
  unitHT: number;
  totalHT: number;
}

/** Genere la facture (PDF + enregistrement DB) pour une reservation. */
export async function generateInvoice(
  reservationId: string,
  kind: 'RESERVATION' | 'FINAL',
): Promise<{ id: string; number: string; pdfPath: string }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { items: true, user: true, deposit: true, return: true, payments: true },
  });
  if (!reservation) throw new Error('Reservation introuvable');
  const settings = await getSettings();
  const company = (settings.company ?? {}) as Record<string, string>;

  const seq = await nextCounter('invoice');
  const number = buildInvoiceNumber(seq);

  const totals = reservation.totals as Record<string, number>;
  const lines: InvoiceLine[] = reservation.items.map((it) => ({
    label: `${it.nameSnapshot}${it.billedDays ? ` (${it.billedDays} j)` : ''}`,
    qty: it.quantity,
    unitHT: it.unitPriceHT,
    totalHT: it.lineHT,
  }));
  if (totals.deliveryFeeHT) {
    lines.push({
      label: 'Livraison',
      qty: 1,
      unitHT: totals.deliveryFeeHT,
      totalHT: totals.deliveryFeeHT,
    });
  }
  if (kind === 'FINAL' && reservation.return) {
    const r = reservation.return;
    if (r.lateFeeHT)
      lines.push({ label: `Retard (${r.lateDays} j)`, qty: 1, unitHT: r.lateFeeHT, totalHT: r.lateFeeHT });
    if (r.cleaningFeeHT)
      lines.push({ label: 'Nettoyage', qty: 1, unitHT: r.cleaningFeeHT, totalHT: r.cleaningFeeHT });
    if (r.otherFeeHT)
      lines.push({
        label: r.otherFeeReason || 'Frais divers',
        qty: 1,
        unitHT: r.otherFeeHT,
        totalHT: r.otherFeeHT,
      });
  }

  const damages = await prisma.damage.findMany({ where: { reservationId } });
  for (const d of damages) {
    if (d.feeHT)
      lines.push({ label: `Dommage : ${d.description}`, qty: 1, unitHT: d.feeHT, totalHT: d.feeHT });
  }

  const subtotalHT = lines.reduce((a, l) => a + l.totalHT, 0) - (totals.discountHT ?? 0);
  const vatRate = totals.vatRate ?? 0.21;
  const vat = Math.round(subtotalHT * vatRate * 100) / 100;
  const totalTVAC = Math.round((subtotalHT + vat) * 100) / 100;

  mkdirSync(INVOICE_DIR, { recursive: true });
  const pdfPath = path.join(INVOICE_DIR, `${number}.pdf`);
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.fillColor('#E52421').fontSize(22).text('BRICO', { continued: true });
    doc.fillColor('#0B1D3A').text('LOC');
    doc.moveDown(0.2);
    doc.fillColor('#33363A').fontSize(9).text(company.legalName ?? 'BRICOLOC (demo)');
    doc.text(company.address ?? 'Adresse (demo)');
    doc.text(`TVA : ${company.vatNumber ?? 'BE (demo)'}`);
    doc.text(`IBAN : ${company.iban ?? '(demo)'}`);

    doc.moveDown();
    doc
      .fillColor('#0B1D3A')
      .fontSize(16)
      .text(`${kind === 'FINAL' ? 'Facture finale' : 'Facture'} ${number}`);
    doc
      .fillColor('#33363A')
      .fontSize(10)
      .text(`Date : ${formatDateBE(new Date())}`)
      .text(`Réservation : ${reservation.number}`)
      .text(
        `Période : ${formatDateBE(reservation.periodStart)} → ${formatDateBE(reservation.periodEnd)}`,
      );

    doc.moveDown();
    const client = reservation.user
      ? `${reservation.user.firstName} ${reservation.user.lastName}`
      : ((reservation.contact as Record<string, string>)?.firstName ?? 'Client') +
        ' ' +
        ((reservation.contact as Record<string, string>)?.lastName ?? '');
    doc.fontSize(10).fillColor('#0B1D3A').text('Client :', { continued: true });
    doc.fillColor('#33363A').text(` ${client}`);

    doc.moveDown();
    const top = doc.y;
    doc.fontSize(9).fillColor('#0B1D3A');
    doc.text('Désignation', 50, top);
    doc.text('Qté', 320, top);
    doc.text('P.U. HT', 370, top);
    doc.text('Total HT', 460, top);
    doc.moveTo(50, top + 14).lineTo(545, top + 14).strokeColor('#A7A9AC').stroke();
    let y = top + 20;
    doc.fillColor('#33363A');
    for (const l of lines) {
      doc.text(l.label, 50, y, { width: 260 });
      doc.text(String(l.qty), 320, y);
      doc.text(formatEUR(l.unitHT), 370, y);
      doc.text(formatEUR(l.totalHT), 460, y);
      y += 18;
    }
    y += 6;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#A7A9AC').stroke();
    y += 10;
    if (totals.discountHT) {
      doc.text('Remise', 370, y);
      doc.text(`- ${formatEUR(totals.discountHT)}`, 460, y);
      y += 16;
    }
    doc.fillColor('#0B1D3A');
    doc.text('Total HTVA', 370, y);
    doc.text(formatEUR(subtotalHT), 460, y);
    y += 16;
    doc.text(`TVA ${Math.round(vatRate * 100)} %`, 370, y);
    doc.text(formatEUR(vat), 460, y);
    y += 16;
    doc.fontSize(11).text('Total TVAC', 370, y);
    doc.text(formatEUR(totalTVAC), 460, y);
    y += 24;
    doc.fontSize(9).fillColor('#33363A');
    doc.text(
      `Caution : ${formatEUR(reservation.deposit?.amount ?? 0)} (${
        reservation.deposit?.status ?? 'N/A'
      }) — non soumise à TVA, restituée après contrôle du matériel.`,
      50,
      y,
      { width: 495 },
    );
    y += 28;
    doc
      .fillColor('#A7A9AC')
      .fontSize(8)
      .text(
        'Document de démonstration — montants et coordonnées fictifs, paramétrables dans l’administration BRICOLOC.',
        50,
        y,
        { width: 495 },
      );

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  const invoice = await prisma.invoice.create({
    data: {
      number,
      reservationId,
      kind,
      totals: { subtotalHT, vat, totalTVAC, vatRate } as never,
      lines: lines as never,
      pdfPath,
    },
  });
  return { id: invoice.id, number, pdfPath };
}
