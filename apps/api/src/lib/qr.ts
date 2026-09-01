import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const gen = customAlphabet(alphabet, 10);

export function newQrToken(prefix = 'R'): string {
  return `${prefix}-${gen()}`;
}

/** Data URL PNG du QR code (affichable partout : web, mobile, PDF). */
export function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { width: 480, margin: 1, errorCorrectionLevel: 'M' });
}
