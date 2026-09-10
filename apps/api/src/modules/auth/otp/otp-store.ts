import type { OtpPurpose } from '../dto/otp.dto';

/** A live OTP challenge as held by the store. */
export type OtpChallengeRecord = {
  codeHash: string;
  attemptCount: number;
  /** Epoch milliseconds. */
  expiresAt: number;
};

/**
 * Storage for one-time codes.
 *
 * OTP state is short-lived, write-heavy and worthless once used, which is the
 * shape Redis is built for: every key carries its own TTL, so expiry is the
 * datastore's job rather than a cleanup query. The interface exists so the
 * service can be exercised without a running Redis.
 */
export interface OtpStore {
  /**
   * Stores a challenge, replacing any existing one for the same phone and
   * purpose. Only one code is ever live at a time, so a freshly requested code
   * silently invalidates its predecessor.
   */
  putChallenge(
    phone: string,
    purpose: OtpPurpose,
    record: OtpChallengeRecord,
    ttlSeconds: number,
  ): Promise<void>;

  getChallenge(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<OtpChallengeRecord | null>;

  /** Returns the attempt count after incrementing. */
  incrementAttempts(phone: string, purpose: OtpPurpose): Promise<number>;

  /**
   * Deletes the challenge, returning true only for the caller that actually
   * removed it. Two concurrent verifications of the same correct code must not
   * both succeed, so the winner is decided by who performs the delete.
   */
  consumeChallenge(phone: string, purpose: OtpPurpose): Promise<boolean>;

  /** True while the resend cooldown for this phone and purpose is active. */
  isCoolingDown(phone: string, purpose: OtpPurpose): Promise<boolean>;

  startCooldown(
    phone: string,
    purpose: OtpPurpose,
    seconds: number,
  ): Promise<void>;

  /**
   * Records a send and returns how many have happened in the trailing window.
   * The window slides, so five sends at 12:59 do not reset at 13:00.
   */
  recordSend(
    phone: string,
    purpose: OtpPurpose,
    windowSeconds: number,
    now?: number,
  ): Promise<number>;

  countSends(
    phone: string,
    purpose: OtpPurpose,
    windowSeconds: number,
    now?: number,
  ): Promise<number>;

  /**
   * Records that an identifier passed its check, for a window longer than the
   * code itself.
   *
   * Signup needs this: the email OTP is verified on one request and the account
   * is created on a later one, so something has to remember in between. It is a
   * short-lived server-side marker rather than a token handed to the client,
   * which means a caller cannot mint their own.
   */
  markVerified(
    identifier: string,
    purpose: OtpPurpose,
    ttlSeconds: number,
  ): Promise<void>;

  /**
   * Consumes the marker, returning true only for the caller that removed it.
   * One verification buys exactly one account, so a replayed signup fails.
   */
  consumeVerified(identifier: string, purpose: OtpPurpose): Promise<boolean>;

  /** Whether a marker is live, without spending it. */
  isVerified(identifier: string, purpose: OtpPurpose): Promise<boolean>;

  /** Test and maintenance helper; clears everything for one phone. */
  clear(phone: string, purpose: OtpPurpose): Promise<void>;
}

export const OTP_STORE = Symbol('OTP_STORE');

/** Namespaced so OTP keys can be spotted and flushed independently. */
export function challengeKey(phone: string, purpose: OtpPurpose): string {
  return `otp:challenge:${purpose}:${phone}`;
}

export function cooldownKey(phone: string, purpose: OtpPurpose): string {
  return `otp:cooldown:${purpose}:${phone}`;
}

export function sendsKey(phone: string, purpose: OtpPurpose): string {
  return `otp:sends:${purpose}:${phone}`;
}

export function verifiedKey(identifier: string, purpose: OtpPurpose): string {
  return `otp:verified:${purpose}:${identifier}`;
}
