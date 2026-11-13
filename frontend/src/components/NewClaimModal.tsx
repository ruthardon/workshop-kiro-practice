import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { NewClaimInput, Policy } from '../types';

interface Props {
  onClose: () => void;
  onSubmit: (input: NewClaimInput) => Promise<void>;
}

export default function NewClaimModal({ onClose, onSubmit }: Readonly<Props>) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstField = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api.getPolicies().then(setPolicies).catch((err: Error) => setError(err.message));
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        policy_id: Number(policyId),
        description,
        incident_date: incidentDate,
        claimed_amount: Number(amount),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 id="modal-title" className="text-lg font-bold text-slate-900">Reportar siniestro</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="claim-policy" className="block text-sm font-medium text-slate-700">Póliza</label>
            <select id="claim-policy" ref={firstField} required value={policyId} onChange={(e) => setPolicyId(e.target.value)} className={inputClass}>
              <option value="">Selecciona una póliza</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.policy_number} · {p.holder_name} · {p.status === 'ACTIVE' ? 'Activa' : 'Expirada'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="claim-description" className="block text-sm font-medium text-slate-700">Descripción</label>
            <textarea id="claim-description" required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="claim-date" className="block text-sm font-medium text-slate-700">Fecha del incidente</label>
              <input id="claim-date" type="date" required value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="claim-amount" className="block text-sm font-medium text-slate-700">Monto reclamado</label>
              <input id="claim-amount" type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-700">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Reportar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
