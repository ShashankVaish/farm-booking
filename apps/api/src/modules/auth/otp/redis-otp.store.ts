import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { OtpPurpose } from '../dto/otp.dto';
import {
  challengeKey,
  cooldownKey,
  sendsKey,
  verifiedKey,
  type OtpChallengeRecord,
  type OtpStore,
} from './otp-store';

@Injectable()
export class RedisOtpStore implements OtpStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisOtpStore.name);

  constructor(private readonly redis: Redis) {}

  async putChallenge(
    phone: string,
    purpose: OtpPurpose,
    record: OtpChallengeRecord,
    ttlSeconds: number,
  ): Promise<void> {
    const key = challengeKey(phone, purpose);
    await this.redis
      .multi()
      .hset(key, {
        codeHash: record.codeHash,
        attemptCount: String(record.attemptCount),
        expiresAt: String(record.expiresAt),
      })
      // Redis owns expiry: once the TTL lapses the code is gone with no sweep
      // job and no chance of a stale row being verified.
      .expire(key, Math.max(1, Math.ceil(ttlSeconds)))
      .exec();
  }

  async getChallenge(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<OtpChallengeRecord | null> {
    const raw = await this.redis.hgetall(challengeKey(phone, purpose));
    if (!raw || !raw.codeHash) {
      return null;
    }
    return {
      codeHash: raw.codeHash,
      attemptCount: Number(raw.attemptCount ?? 0),
      expiresAt: Number(raw.expiresAt ?? 0),
    };
  }

  async incrementAttempts(phone: string, purpose: OtpPurpose): Promise<number> {
    // HINCRBY on the existing hash keeps the key's TTL intact, so a wrong guess
    // never extends the life of a code.
    return this.redis.hincrby(challengeKey(phone, purpose), 'attemptCount', 1);
  }

  async consumeChallenge(phone: string, purpose: OtpPurpose): Promise<boolean> {
    // DEL reports how many keys it removed, so exactly one concurrent caller
    // can win the race for a single-use code.
    const removed = await this.redis.del(challengeKey(phone, purpose));
    return removed === 1;
  }

  async isCoolingDown(phone: string, purpose: OtpPurpose): Promise<boolean> {
    return (await this.redis.exists(cooldownKey(phone, purpose))) === 1;
  }

  async startCooldown(
    phone: string,
    purpose: OtpPurpose,
    seconds: number,
  ): Promise<void> {
    await this.redis.set(
      cooldownKey(phone, purpose),
      '1',
      'EX',
      Math.max(1, Math.ceil(seconds)),
    );
  }

  async recordSend(
    phone: string,
    purpose: OtpPurpose,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<number> {
    const key = sendsKey(phone, purpose);
    const cutoff = now - windowSeconds * 1000;
    // A sorted set of send timestamps gives a true sliding window; a plain
    // counter with EXPIRE would reset on a boundary and let a caller send
    // twice the limit either side of it.
    const results = await this.redis
      .multi()
      .zremrangebyscore(key, 0, cutoff)
      .zadd(key, now, `${now}-${Math.random().toString(36).slice(2, 10)}`)
      .zcard(key)
      .expire(key, Math.ceil(windowSeconds))
      .exec();

    const cardinality = results?.[2]?.[1];
    return typeof cardinality === 'number' ? cardinality : 0;
  }

  async countSends(
    phone: string,
    purpose: OtpPurpose,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<number> {
    const key = sendsKey(phone, purpose);
    await this.redis.zremrangebyscore(key, 0, now - windowSeconds * 1000);
    return this.redis.zcard(key);
  }

  async markVerified(
    identifier: string,
    purpose: OtpPurpose,
    ttlSeconds: number,
  ): Promise<void> {
    // Redis owns the expiry here too, so a verification cannot outlive its
    // window even if nothing ever comes back to spend it.
    await this.redis.set(
      verifiedKey(identifier, purpose),
      '1',
      'EX',
      Math.max(1, Math.ceil(ttlSeconds)),
    );
  }

  async consumeVerified(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    // DEL reports how many keys it removed, so two concurrent signups on one
    // verified email cannot both succeed.
    const removed = await this.redis.del(verifiedKey(identifier, purpose));
    return removed === 1;
  }

  async isVerified(identifier: string, purpose: OtpPurpose): Promise<boolean> {
    const found = await this.redis.exists(verifiedKey(identifier, purpose));
    return found === 1;
  }

  async clear(phone: string, purpose: OtpPurpose): Promise<void> {
    await this.redis.del(
      challengeKey(phone, purpose),
      cooldownKey(phone, purpose),
      sendsKey(phone, purpose),
      verifiedKey(phone, purpose),
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.logger.warn('Redis connection did not close cleanly.');
    }
  }
}
