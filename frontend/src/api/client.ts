import { Claim, ClaimStats, NewClaimInput, Policy } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? 'Error inesperado');
  }
  return body.data as T;
}

export const api = {
  getClaims: () => request<Claim[]>('/api/claims'),
  getStats: () => request<ClaimStats>('/api/claims/stats'),
  getPolicies: () => request<Policy[]>('/api/policies'),
  createClaim: (input: NewClaimInput) =>
    request<Claim>('/api/claims', { method: 'POST', body: JSON.stringify(input) }),
  approveClaim: (id: number) => request<Claim>(`/api/claims/${id}/approve`, { method: 'PATCH', body: '{}' }),
  rejectClaim: (id: number) => request<Claim>(`/api/claims/${id}/reject`, { method: 'PATCH', body: '{}' }),
};
