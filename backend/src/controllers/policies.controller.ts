import { NextFunction, Request, Response } from 'express';
import * as policiesService from '../services/policies.service';
import { AppError } from '../utils/appError';
import { ok } from '../utils/response';

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await policiesService.listPolicies());
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, 'INVALID_ID', 'El id debe ser un entero positivo');
    }
    ok(res, await policiesService.getPolicyById(id));
  } catch (err) {
    next(err);
  }
}
