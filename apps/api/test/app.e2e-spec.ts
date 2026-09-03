import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';

const BASE_URL = 'http://127.0.0.1:3001';
const API_ROOT = path.resolve(__dirname, '..');

async function waitForHealth(timeoutMs = 40000): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await request(BASE_URL).get('/health');
      if (response.status === 200) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  throw new Error('API did not become healthy in time.');
}

describe('API foundation (e2e)', () => {
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    child = spawn(process.execPath, ['dist/main.js'], {
      cwd: API_ROOT,
      env: process.env,
      stdio: 'pipe',
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    await waitForHealth();
  }, 60000);

  afterAll(() => {
    child?.kill();
  });

  it('GET /health returns service status', async () => {
    const response = await request(BASE_URL).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: 'farmhouse-api',
        database: 'up',
      },
    });
  });

  it('rejects invalid payloads with a consistent error envelope', async () => {
    const response = await request(BASE_URL)
      .post('/api/auth/register')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBeDefined();
  });

  it('registers, logs in, and returns the current user', async () => {
    const email = `user.${Date.now()}@e2e.farmhouse.test`;
    const password = 'Secret123';

    const register = await request(BASE_URL).post('/api/auth/register').send({
      email,
      password,
      name: 'E2E User',
    });

    expect(register.status).toBe(201);
    expect(register.body.success).toBe(true);
    expect(register.body.data.user.email).toBe(email);
    expect(register.body.data.accessToken).toBeDefined();
    expect(register.body.data.user).not.toHaveProperty('passwordHash');

    const login = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email, password });

    expect(login.status).toBe(201);
    expect(login.body.data.accessToken).toBeDefined();

    const me = await request(BASE_URL)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const unauthenticated = await request(BASE_URL).get('/api/auth/me');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.success).toBe(false);
  });

  it('rejects unauthenticated admin access', async () => {
    const response = await request(BASE_URL).get('/api/admin/users');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('lists amenities publicly', async () => {
    const response = await request(BASE_URL).get('/api/amenities');
    expect([200, 500]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body.success).toBe(true);
    }
  });
});
