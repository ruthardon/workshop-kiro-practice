import { ClaimStatus } from '../types';

const STYLES: Record<ClaimStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  CLOSED: 'bg-slate-200 text-slate-700',
};

const LABELS: Record<ClaimStatus, string> = {
  OPEN: 'Abierto',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CLOSED: 'Cerrado',
};

export default function StatusBadge({ status }: Readonly<{ status: ClaimStatus }>) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
