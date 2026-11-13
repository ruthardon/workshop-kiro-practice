import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      data: null,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  console.error('Error no controlado:', err instanceof Error ? err.message : 'desconocido');
  res.status(500).json({
    success: false,
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  });
}
