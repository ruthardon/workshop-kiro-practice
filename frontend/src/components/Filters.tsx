import { ClaimStatus } from '../types';

export type StatusFilter = ClaimStatus | 'ALL';

interface Props {
  status: StatusFilter;
  search: string;
  onStatus: (value: StatusFilter) => void;
  onSearch: (value: string) => void;
}

export default function Filters({ status, search, onStatus, onSearch }: Readonly<Props>) {
  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <label htmlFor="filter-status" className="block text-xs font-medium text-slate-600">
          Estado
        </label>
        <select
          id="filter-status"
          value={status}
          onChange={(e) => onStatus(e.target.value as StatusFilter)}
          className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">Todos</option>
          <option value="OPEN">Abierto</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
          <option value="CLOSED">Cerrado</option>
        </select>
      </div>
      <div>
        <label htmlFor="filter-search" className="block text-xs font-medium text-slate-600">
          Buscar
        </label>
        <input
          id="filter-search"
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Asegurado o descripción"
          className="mt-1 w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
