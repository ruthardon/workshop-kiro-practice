import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { db } from '../src/config/db';

beforeAll(async () => {
  await db.init();
});

afterAll(async () => {
  await db.close();
});

describe('GET /api/health', () => {
  it('responde ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' }, error: null });
  });
});

describe('GET /api/claims', () => {
  it('lista los siniestros semilla desde SQLite', async () => {
    const res = await request(app).get('/api/claims');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(8);
  });
});
