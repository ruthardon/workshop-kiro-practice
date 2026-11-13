import { Claim } from '../types';
import { money } from './KpiCards';
import StatusBadge from './StatusBadge';

interface Props {
  claims: Claim[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

export default function ClaimsTable({ claims, onApprove, onReject }: Readonly<Props>) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <caption className="sr-only">Listado de siniestros</caption>
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">#</th>
            <th scope="col" className="px-4 py-3">Póliza</th>
            <th scope="col" className="px-4 py-3">Asegurado</th>
            <th scope="col" className="px-4 py-3">Descripción</th>
            <th scope="col" className="px-4 py-3">Fecha</th>
            <th scope="col" className="px-4 py-3 text-right">Reclamado</th>
            <th scope="col" className="px-4 py-3 text-right">Indemnización</th>
            <th scope="col" className="px-4 py-3">Estado</th>
            <th scope="col" className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {claims.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                No hay siniestros para mostrar
              </td>
            </tr>
          )}
          {claims.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3 font-medium">{c.id}</td>
              <td className="px-4 py-3 font-mono text-xs">{c.policy_number}</td>
              <td className="px-4 py-3">{c.holder_name}</td>
              <td className="max-w-xs px-4 py-3">{c.description}</td>
              <td className="whitespace-nowrap px-4 py-3">{c.incident_date.slice(0, 10)}</td>
              <td className="px-4 py-3 text-right">{money(c.claimed_amount)}</td>
              <td className="px-4 py-3 text-right">{money(c.indemnity_amount)}</td>
              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              <td className="whitespace-nowrap px-4 py-3">
                {c.status === 'OPEN' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(c.id)}
                      aria-label={`Aprobar siniestro ${c.id}`}
                      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(c.id)}
                      aria-label={`Rechazar siniestro ${c.id}`}
                      className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
