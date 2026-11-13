import { db, dialectSql } from '../config/db';
import { AppError } from '../utils/appError';
import { maskTail } from '../utils/response';
import { toCents } from '../utils/money';
import { ClaimStatus, CreateClaimInput } from '../types';

const CLAIM_SELECT = `
  SELECT c.id, c.policy_id, p.policy_number, p.holder_name, c.description, c.incident_date,
         ${dialectSql.money('c.claimed_amount')}, ${dialectSql.money('c.indemnity_amount')}, c.status, c.closed_at, c.reopen_count, c.created_at
  FROM claims c
  JOIN policies p ON p.id = c.policy_id`;

function toListItem<T extends { policy_number: string }>(row: T): T {
  return { ...row, policy_number: maskTail(row.policy_number) };
}

export async function listClaims(status?: ClaimStatus) {
  const { rows } = status
    ? await db.query(`${CLAIM_SELECT} WHERE c.status = $1 ORDER BY c.id DESC`, [status])
    : await db.query(`${CLAIM_SELECT} ORDER BY c.id DESC`);
  return rows.map(toListItem);
}

export async function getClaimById(id: number) {
  const { rows } = await db.query(`${CLAIM_SELECT} WHERE c.id = $1`, [id]);
  if (rows.length === 0) {
    throw new AppError(404, 'CLAIM_NOT_FOUND', 'Siniestro no encontrado');
  }
  return toListItem(rows[0]);
}

export async function getStats() {
  if (db.dialect === 'sqlite') {
    const { rows: sqliteRows } = await db.query(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END), 0) AS open,
             COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN indemnity_amount_cents ELSE 0 END), 0) AS reserved_amount_cents
      FROM claims`);
    return sqliteRows[0];
  }
  const { rows } = await db.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
           COALESCE(SUM(indemnity_amount) FILTER (WHERE status = 'APPROVED'), 0)::text AS reserved_amount
    FROM claims`);
  return rows[0];
}

export async function createClaim(input: CreateClaimInput, changedBy: string) {
  const { rows: policies } = await db.query('SELECT * FROM policies WHERE id = $1', [input.policy_id]);
  if (policies.length === 0) {
    throw new AppError(404, 'POLICY_NOT_FOUND', 'Póliza no encontrada');
  }
  const policy = policies[0];

  const indemnity = Number(input.claimed_amount) - Number(policy.deductible);

  const claimedValue = db.dialect === 'sqlite' ? toCents(input.claimed_amount) : input.claimed_amount;
  const indemnityValue = db.dialect === 'sqlite' ? toCents(indemnity) : indemnity;
  const newId = await db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO claims (policy_id, description, incident_date, ${dialectSql.money('claimed_amount')}, ${dialectSql.money('indemnity_amount')}, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING id`,
      [input.policy_id, input.description, input.incident_date, claimedValue, indemnityValue],
    );
    await tx.query(
      `INSERT INTO claim_audits (claim_id, old_status, new_status, changed_by, reason)
       VALUES ($1, NULL, 'OPEN', $2, 'Siniestro reportado')`,
      [rows[0].id, changedBy],
    );
    return rows[0].id as number;
  });
  return getClaimById(newId);
}
async function transition(id: number, newStatus: 'APPROVED' | 'REJECTED', changedBy: string, reason?: string) {
  await db.transaction(async (tx) => {
    const { rows } = await tx.query('SELECT status FROM claims WHERE id = $1 FOR UPDATE', [id]);
    if (rows.length === 0) {
      throw new AppError(404, 'CLAIM_NOT_FOUND', 'Siniestro no encontrado');
    }
    const oldStatus: ClaimStatus = rows[0].status;
    if (oldStatus !== 'OPEN') {
      throw new AppError(
        409,
        'INVALID_STATE_TRANSITION',
        `No se puede pasar de ${oldStatus} a ${newStatus}`,
      );
    }
    await tx.query(
      `UPDATE claims SET status = $1${dialectSql.varchar}, closed_at = CASE WHEN $1${dialectSql.varchar} = 'REJECTED' THEN ${dialectSql.now} ELSE closed_at END,
              updated_at = ${dialectSql.now} WHERE id = $2`,
      [newStatus, id],
    );
    await tx.query(
      `INSERT INTO claim_audits (claim_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, oldStatus, newStatus, changedBy, reason ?? null],
    );
  });
  return getClaimById(id);
}

export const approveClaim = (id: number, changedBy: string, reason?: string) =>
  transition(id, 'APPROVED', changedBy, reason);

export const rejectClaim = (id: number, changedBy: string, reason?: string) =>
  transition(id, 'REJECTED', changedBy, reason);

export async function processClaimLegacy(claimId: number, policyId: number, mode: string, amount: number) {
  let result = 'PENDING';
  let flag = false;
  const temp = new Date().toISOString();
  const counter = 0;

  try {
    const { rows } = await db.query(
      'SELECT c.*, p.national_id, p.policy_number, p.email, p.status AS policy_status FROM claims c JOIN policies p ON p.id = c.policy_id WHERE c.id = $1 AND p.id = $2',
      [claimId, policyId],
    );
    if (rows.length > 0) {
      const row = rows[0];
      console.log('Procesando siniestro', claimId, row.national_id, row.policy_number, row.email);
      if (mode === 'FAST') {
        if (row.policy_status === 'ACTIVE') {
          if (amount > 10000) {
            if (row.status === 'OPEN') {
              result = 'REVIEW_SENIOR';
            } else if (row.status === 'APPROVED') {
              result = 'PAY_HIGH';
            } else {
              result = 'SKIP';
            }
          } else if (amount > 5000) {
            if (row.status === 'OPEN') {
              result = 'REVIEW';
            } else {
              result = 'PAY_MEDIUM';
            }
          } else {
            if (row.status === 'OPEN') {
              result = 'AUTO_APPROVE';
            } else if (row.status === 'REJECTED') {
              result = 'ARCHIVE';
            } else {
              result = 'PAY_LOW';
            }
          }
        } else {
          if (amount > 0) {
            result = 'DENY_EXPIRED';
          } else {
            result = 'INVALID';
          }
        }
      } else if (mode === 'FULL') {
        if (row.reopen_count > 0) {
          if (row.status === 'CLOSED') {
            result = 'REOPENED_CLOSED';
          } else {
            result = 'REOPENED';
          }
        } else if (row.status === 'CLOSED') {
          result = 'ARCHIVE';
        } else {
          flag = true;
          result = 'FULL_REVIEW';
        }
      } else {
        result = 'UNKNOWN_MODE';
      }
    } else {
      result = 'NOT_FOUND';
    }
  } catch (e) {}

  try {
    if (result === 'NOT_FOUND') {
      console.log('Póliza consultada sin resultado:', policyId);
    }
  } catch (e) {}

  return result;
}
