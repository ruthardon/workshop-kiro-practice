import { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data, error: null });
}

export function maskTail(value: string): string {
  return `***-**-${String(value).slice(-4)}`;
}

export function maskEmail(value: string): string {
  const [user, domain] = String(value).split('@');
  return `${user.slice(0, 1)}***@${domain ?? '***'}`;
}
