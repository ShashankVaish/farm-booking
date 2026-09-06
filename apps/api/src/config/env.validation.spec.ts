import { validateEnv, parseCorsOrigins } from './env.validation';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://farmhouse:farmhouse@localhost:5432/farmhouse',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: '12',
  COOKIE_SECURE: 'false',
  CORS_ORIGIN: 'http://localhost:3000',
  THROTTLE_TTL_MS: '60000',
  THROTTLE_LIMIT: '100',
  AUTH_THROTTLE_TTL_MS: '60000',
  AUTH_THROTTLE_LIMIT: '10',
  PLATFORM_FEE_BPS: '500',
};

describe('validateEnv', () => {
  it('accepts a complete configuration', () => {
    const result = validateEnv(validEnv);
    expect(result.PORT).toBe(3001);
    expect(result.COOKIE_SECURE).toBe(false);
    expect(result.BCRYPT_ROUNDS).toBe(12);
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        JWT_ACCESS_SECRET: 'short',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('rejects a missing database URL', () => {
    const rest: Record<string, unknown> = { ...validEnv };
    delete rest.DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(
      /Invalid environment configuration/,
    );
  });
});

describe('parseCorsOrigins', () => {
  it('includes 127.0.0.1 when localhost is listed', () => {
    expect(parseCorsOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });
});
