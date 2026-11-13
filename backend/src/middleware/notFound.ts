import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));
}
