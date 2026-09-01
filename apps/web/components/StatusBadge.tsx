const MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Brouillon', cls: 'badge-warn' },
  CONFIRMED: { label: 'Confirmée', cls: 'badge-ok' },
  PREPARING: { label: 'En préparation', cls: 'badge-warn' },
  READY: { label: 'Prête', cls: 'badge-ok' },
  OUT: { label: 'En location', cls: 'badge' },
  RETURN_PENDING: { label: 'Retour attendu', cls: 'badge-warn' },
  RETURNED: { label: 'Rendue', cls: 'badge' },
  CLOSED: { label: 'Clôturée', cls: 'badge-ok' },
  CANCELLED: { label: 'Annulée', cls: 'badge-err' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: 'badge' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
