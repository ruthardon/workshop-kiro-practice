import { ClaimStats } from '../types';

export const money = (value: string | number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD' }).format(Number(value));

function Card({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function KpiCards({ stats }: Readonly<{ stats: ClaimStats | null }>) {
  return (
    <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-3">
      <Card label="Total Siniestros" value={stats ? String(stats.total) : '—'} />
      <Card label="Monto Reservado" value={stats ? money(stats.reserved_amount) : '—'} />
      <Card label="Siniestros Abiertos" value={stats ? String(stats.open) : '—'} />
    </section>
  );
}
