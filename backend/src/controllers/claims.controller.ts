import { NextFunction, Request, Response } from 'express';
import * as claimsService from '../services/claims.service';
import { AppError } from '../utils/appError';
import { ok } from '../utils/response';
import { CLAIM_STATUSES, ClaimStatus } from '../types';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'INVALID_ID', 'El id debe ser un entero positivo');
  }
  return id;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
function actor(req: Request): string {
  return req.header('x-user') ?? 'system';
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string | undefined;
    if (status !== undefined && !CLAIM_STATUSES.includes(status as ClaimStatus)) {
      throw new AppError(400, 'INVALID_STATUS', `Estado inválido. Valores permitidos: ${CLAIM_STATUSES.join(', ')}`);
    }
    ok(res, await claimsService.listClaims(status as ClaimStatus | undefined));
  } catch (err) {
    next(err);
  }
}

export async function stats(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await claimsService.getStats());
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await claimsService.getClaimById(parseId(req.params.id)));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { policy_id, description, incident_date, claimed_amount } = req.body ?? {};
    const policyId = Number(policy_id);
    const amount = Number(claimed_amount);
    if (!Number.isInteger(policyId) || policyId <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'policy_id es obligatorio y debe ser un entero positivo');
    }
    if (typeof description !== 'string' || description.trim() === '') {
      throw new AppError(400, 'VALIDATION_ERROR', 'description es obligatoria');
    }
    if (typeof incident_date !== 'string' || !isRealDate(incident_date)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'incident_date debe ser una fecha válida con formato YYYY-MM-DD (sin hora)');
    }
    if (claimed_amount === undefined || claimed_amount === '' || !Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'claimed_amount debe ser un número mayor que 0');
    }
    const claim = await claimsService.createClaim(
      { policy_id: policyId, description: description.trim(), incident_date, claimed_amount: amount },
      actor(req),
    );
    ok(res, claim, 201);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await claimsService.approveClaim(parseId(req.params.id), actor(req), req.body?.reason));
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await claimsService.rejectClaim(parseId(req.params.id), actor(req), req.body?.reason));
  } catch (err) {
    next(err);
  }
}

export async function legacyProcess(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const { policy_id, mode, amount } = req.body ?? {};
    const result = await claimsService.processClaimLegacy(id, Number(policy_id), String(mode ?? 'FAST'), Number(amount ?? 0));
    ok(res, { result });
  } catch (err) {
    next(err);
  }
}
