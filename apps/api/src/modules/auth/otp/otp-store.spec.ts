import Redis from 'ioredis';
import { MemoryOtpStore } from './memory-otp.store';
import { RedisOtpStore } from './redis-otp.store';
import type { OtpStore } from './otp-store';

/**
 * One contract, run against both implementations.
 *
 * The in-memory store only earns its place if it behaves like Redis, so the
 * identical assertions run against a real server. If Redis is not up the Redis
 * block fails with instructions rather than quietly substituting the in-memory
 * store, which would make the suite look green while testing nothing.
 */
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

function contract(name: string, getStore: () => OtpStore) {
  describe(name, () => {
    const phone = `99900${Math.floor(Math.random() * 90000) + 10000}`;

    beforeEach(async () => {
      await getStore().clear(phone, 'LOGIN');
      await getStore().clear(phone, 'REGISTER');
    });

    it('stores and reads back a challenge', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'hash-a', attemptCount: 0, expiresAt: Date.now() + 60_000 },
        60,
      );
      const found = await store.getChallenge(phone, 'LOGIN');
      expect(found?.codeHash).toBe('hash-a');
      expect(found?.attemptCount).toBe(0);
    });

    it('returns null when nothing is stored', async () => {
      expect(await getStore().getChallenge(phone, 'LOGIN')).toBeNull();
    });

    it('keeps purposes isolated so a login code cannot verify a registration', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'login-hash', attemptCount: 0, expiresAt: Date.now() + 60_000 },
        60,
      );
      expect(await store.getChallenge(phone, 'REGISTER')).toBeNull();
      expect((await store.getChallenge(phone, 'LOGIN'))?.codeHash).toBe('login-hash');
    });

    it('replaces an earlier challenge so only the newest code is live', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'old', attemptCount: 3, expiresAt: Date.now() + 60_000 },
        60,
      );
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'new', attemptCount: 0, expiresAt: Date.now() + 60_000 },
        60,
      );
      const found = await store.getChallenge(phone, 'LOGIN');
      expect(found?.codeHash).toBe('new');
      expect(found?.attemptCount).toBe(0);
    });

    it('counts attempts upward', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'hash', attemptCount: 0, expiresAt: Date.now() + 60_000 },
        60,
      );
      expect(await store.incrementAttempts(phone, 'LOGIN')).toBe(1);
      expect(await store.incrementAttempts(phone, 'LOGIN')).toBe(2);
      expect((await store.getChallenge(phone, 'LOGIN'))?.attemptCount).toBe(2);
    });

    it('lets exactly one caller consume a challenge', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'hash', attemptCount: 0, expiresAt: Date.now() + 60_000 },
        60,
      );
      const [first, second] = await Promise.all([
        store.consumeChallenge(phone, 'LOGIN'),
        store.consumeChallenge(phone, 'LOGIN'),
      ]);
      expect([first, second].filter(Boolean)).toHaveLength(1);
      expect(await store.getChallenge(phone, 'LOGIN')).toBeNull();
    });

    it('expires a challenge once its TTL lapses', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'hash', attemptCount: 0, expiresAt: Date.now() + 1000 },
        1,
      );
      expect(await store.getChallenge(phone, 'LOGIN')).not.toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 1400));
      expect(await store.getChallenge(phone, 'LOGIN')).toBeNull();
    });

    it('does not extend a code TTL when a wrong guess is recorded', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'hash', attemptCount: 0, expiresAt: Date.now() + 1000 },
        1,
      );
      await store.incrementAttempts(phone, 'LOGIN');
      await new Promise((resolve) => setTimeout(resolve, 1400));
      expect(await store.getChallenge(phone, 'LOGIN')).toBeNull();
    });

    it('tracks a resend cooldown that clears itself', async () => {
      const store = getStore();
      expect(await store.isCoolingDown(phone, 'LOGIN')).toBe(false);
      await store.startCooldown(phone, 'LOGIN', 1);
      expect(await store.isCoolingDown(phone, 'LOGIN')).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 1400));
      expect(await store.isCoolingDown(phone, 'LOGIN')).toBe(false);
    });

    it('counts sends within a sliding window', async () => {
      const store = getStore();
      const now = Date.now();
      expect(await store.recordSend(phone, 'LOGIN', 3600, now)).toBe(1);
      expect(await store.recordSend(phone, 'LOGIN', 3600, now + 10)).toBe(2);
      expect(await store.countSends(phone, 'LOGIN', 3600, now + 20)).toBe(2);
    });

    it('drops sends that fall out of the window rather than resetting on a boundary', async () => {
      const store = getStore();
      const now = Date.now();
      await store.recordSend(phone, 'LOGIN', 60, now - 120_000);
      await store.recordSend(phone, 'LOGIN', 60, now - 90_000);
      // Both are older than the 60s window, so only the fresh one counts.
      expect(await store.recordSend(phone, 'LOGIN', 60, now)).toBe(1);
    });

    it('clears everything for a phone', async () => {
      const store = getStore();
      await store.putChallenge(
        phone,
        'LOGIN',
        { codeHash: 'hash', attemptCount: 0, expiresAt: Date.now() + 60_000 },
        60,
      );
      await store.startCooldown(phone, 'LOGIN', 60);
      await store.recordSend(phone, 'LOGIN', 3600);

      await store.clear(phone, 'LOGIN');

      expect(await store.getChallenge(phone, 'LOGIN')).toBeNull();
      expect(await store.isCoolingDown(phone, 'LOGIN')).toBe(false);
      expect(await store.countSends(phone, 'LOGIN', 3600)).toBe(0);
    });
  });
}

describe('MemoryOtpStore', () => {
  const store = new MemoryOtpStore();
  contract('contract', () => store);
});

describe('RedisOtpStore (live server)', () => {
  let client: Redis;
  let store: RedisOtpStore;

  beforeAll(async () => {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    try {
      await client.connect();
      await client.ping();
    } catch (error) {
      throw new Error(
        `Redis is not reachable at ${REDIS_URL}. Start it with "docker compose up -d redis" ` +
          `(inside WSL if Docker runs there). Original error: ${
            error instanceof Error ? error.message : String(error)
          }`,
      );
    }
    store = new RedisOtpStore(client);
  });

  afterAll(async () => {
    await client?.quit().catch(() => undefined);
  });

  it('answers PING', async () => {
    expect(await client.ping()).toBe('PONG');
  });

  it('sets a real TTL on the challenge key, so Redis owns expiry', async () => {
    const phone = '9990000777';
    await store.clear(phone, 'LOGIN');
    await store.putChallenge(
      phone,
      'LOGIN',
      { codeHash: 'hash', attemptCount: 0, expiresAt: Date.now() + 300_000 },
      300,
    );
    const ttl = await client.ttl(`otp:challenge:LOGIN:${phone}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
    await store.clear(phone, 'LOGIN');
  });

  contract('contract', () => store);
});
