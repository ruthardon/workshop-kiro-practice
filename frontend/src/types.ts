export type ClaimStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export interface Claim {
  id: number;
  policy_id: number;
  policy_number: string;
  holder_name: string;
  description: string;
  incident_date: string;
  claimed_amount: string;
  indemnity_amount: string;
  status: ClaimStatus;
  closed_at: string | null;
  reopen_count: number;
  created_at: string;
}

export interface Policy {
  id: number;
  policy_number: string;
  holder_name: string;
  status: 'ACTIVE' | 'EXPIRED';
  deductible: string;
}

export interface ClaimStats {
  total: number;
  open: number;
  reserved_amount: string;
}

export interface NewClaimInput {
  policy_id: number;
  description: string;
  incident_date: string;
  claimed_amount: number;
}
