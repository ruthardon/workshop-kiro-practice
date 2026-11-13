export type ClaimStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CLOSED';
export type PolicyStatus = 'ACTIVE' | 'EXPIRED';

export const CLAIM_STATUSES: ClaimStatus[] = ['OPEN', 'APPROVED', 'REJECTED', 'CLOSED'];

export interface Policy {
  id: number;
  policy_number: string;
  holder_name: string;
  national_id: string;
  phone: string;
  email: string;
  status: PolicyStatus;
  start_date: string;
  end_date: string;
  deductible: string;
  coverage_limit: string;
}

export interface CreateClaimInput {
  policy_id: number;
  description: string;
  incident_date: string;
  claimed_amount: number | string;
}
