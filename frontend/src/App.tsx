import { useCallback, useMemo, useState } from 'react';
import ClaimsTable from './components/ClaimsTable';
import Filters, { StatusFilter } from './components/Filters';
import KpiCards from './components/KpiCards';
import NewClaimModal from './components/NewClaimModal';
import { useClaims } from './hooks/useClaims';

export default function App() {
  const { claims, stats, loading, error, approve, reject, create } = useClaims();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return claims.filter(
      (c) =>
        (status === 'ALL' || c.status === status) &&
        (term === '' || c.holder_name.toLowerCase().includes(term) || c.description.toLowerCase().includes(term)),
    );
  }, [claims, status, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ClaimShield</h1>
          <p className="text-sm text-slate-500">Gestión de siniestros y reclamaciones</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Reportar siniestro
        </button>
      </header>

      <KpiCards stats={stats} />

      {error && (
        <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      )}

      <Filters status={status} search={search} onStatus={setStatus} onSearch={setSearch} />

      {loading ? (
        <p className="text-slate-500">Cargando…</p>
      ) : (
        <ClaimsTable claims={visible} onApprove={approve} onReject={reject} />
      )}

      {modalOpen && <NewClaimModal onClose={closeModal} onSubmit={create} />}
    </div>
  );
}
