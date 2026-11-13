import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Claim, ClaimStats, NewClaimInput } from '../types';

export function useClaims() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<ClaimStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getClaims(), api.getStats()])
      .then(([list, kpis]) => {
        setClaims(list);
        setStats(kpis);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const replaceClaim = (updated: Claim) => {
    setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const approve = useCallback(async (id: number) => {
    setError(null);
    try {
      replaceClaim(await api.approveClaim(id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const reject = useCallback(async (id: number) => {
    setError(null);
    try {
      replaceClaim(await api.rejectClaim(id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const create = useCallback(async (input: NewClaimInput) => {
    await api.createClaim(input);
    const [list, kpis] = await Promise.all([api.getClaims(), api.getStats()]);
    setClaims(list);
    setStats(kpis);
  }, []);

  return { claims, stats, loading, error, approve, reject, create };
}
