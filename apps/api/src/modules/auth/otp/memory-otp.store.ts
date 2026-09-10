import { Injectable } from '@nestjs/common';
import type { OtpPurpose } from '../dto/otp.dto';
import {
  challengeKey,
  cooldownKey,
  sendsKey,
  type OtpChallengeRecord,
  type OtpStore,
} from './otp-store';

type Expiring<T> = { value: T; expiresAt: number };

/**
 * Process-local OTP store with the same semantics as the Redis one.
 *
 * Used by the test suite, and as the fallback when REDIS_URL is unset so a
 * developer can run the API without Docker. It is deliberately NOT suitable
 * for more than one API instance: nothing is shared, so a code issued by one
 * process cannot be verified by another.
 */
@Injectable()
export class MemoryOtpStore implements OtpStore {
  private readonly challenges = new Map<string, Expiring<OtpChallengeRecord>>();
  private readonly cooldowns = new Map<string, number>();
  private readonly sends = new Map<string, number[]>();

  private live<T>(map: Map<string, Expiring<T>>, key: string, now: number): T | null {
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      map.delete(key);
      return null;
    }
    return entry.value;
  }

  putChallenge(
    phone: string,
    purpose: OtpPurpose,
    record: OtpChallengeRecord,
    ttlSeconds: number,
  ): Promise<void> {
    this.challenges.set(challengeKey(phone, purpose), {
      value: { ...record },
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  getChallenge(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<OtpChallengeRecord | null> {
    const found = this.live(this.challenges, challengeKey(phone, purpose), Date.now());
    return Promise.resolve(found ? { ...found } : null);
  }

  incrementAttempts(phone: string, purpose: OtpPurpose): Promise<number> {
    const key = challengeKey(phone, purpose);
    const entry = this.challenges.get(key);
    if (!entry) return Promise.resolve(0);
    entry.value.attemptCount += 1;
    return Promise.resolve(entry.value.attemptCount);
  }

  consumeChallenge(phone: string, purpose: OtpPurpose): Promise<boolean> {
    return Promise.resolve(this.challenges.delete(challengeKey(phone, purpose)));
  }

  isCoolingDown(phone: string, purpose: OtpPurpose): Promise<boolean> {
    const key = cooldownKey(phone, purpose);
    const until = this.cooldowns.get(key);
    if (until === undefined) return Promise.resolve(false);
    if (until <= Date.now()) {
      this.cooldowns.delete(key);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  startCooldown(
    phone: string,
    purpose: OtpPurpose,
    seconds: number,
  ): Promise<void> {
    this.cooldowns.set(cooldownKey(phone, purpose), Date.now() + seconds * 1000);
    return Promise.resolve();
  }

  recordSend(
    phone: string,
    purpose: OtpPurpose,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<number> {
    const key = sendsKey(phone, purpose);
    const cutoff = now - windowSeconds * 1000;
    const kept = (this.sends.get(key) ?? []).filter((at) => at > cutoff);
    kept.push(now);
    this.sends.set(key, kept);
    return Promise.resolve(kept.length);
  }

  countSends(
    phone: string,
    purpose: OtpPurpose,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<number> {
    const key = sendsKey(phone, purpose);
    const cutoff = now - windowSeconds * 1000;
    const kept = (this.sends.get(key) ?? []).filter((at) => at > cutoff);
    this.sends.set(key, kept);
    return Promise.resolve(kept.length);
  }

  clear(phone: string, purpose: OtpPurpose): Promise<void> {
    this.challenges.delete(challengeKey(phone, purpose));
    this.cooldowns.delete(cooldownKey(phone, purpose));
    this.sends.delete(sendsKey(phone, purpose));
    return Promise.resolve();
  }

  /** Drops everything; used between tests. */
  reset(): void {
    this.challenges.clear();
    this.cooldowns.clear();
    this.sends.clear();
  }
}
