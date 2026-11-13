import { db } from '../config/db';
import { AppError } from '../utils/appError';
import { maskEmail, maskTail } from '../utils/response';
import { Policy } from '../types';

export async function listPolicies() {
  const { rows } = await db.query<Policy>('SELECT * FROM policies ORDER BY id');
  return rows.map((p) => ({
    ...p,
    policy_number: maskTail(p.policy_number),
    national_id: maskTail(p.national_id),
    phone: maskTail(p.phone),
    email: maskEmail(p.email),
  }));
}

export async function getPolicyById(id: number) {
  const { rows } = await db.query<Policy>('SELECT * FROM policies WHERE id = $1', [id]);
  if (rows.length === 0) {
    throw new AppError(404, 'POLICY_NOT_FOUND', 'Póliza no encontrada');
  }
  return rows[0];
}
