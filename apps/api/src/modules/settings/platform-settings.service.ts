import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Settings an admin may change at runtime, with the bounds each must stay in.
 * Anything not listed here stays environment-only and read-only in the panel.
 */
export const EDITABLE_SETTINGS = {
  PLATFORM_FEE_BPS: {
    label: 'Platform fee',
    min: 0,
    // 30% — a deliberate ceiling so a mistyped value cannot wipe out host payouts.
    max: 3000,
    fallback: 500,
  },
  BOOKING_EXPIRE_MINUTES: {
    label: 'Booking hold',
    min: 5,
    max: 1440,
    fallback: 30,
  },
} as const;

export type EditableSettingKey = keyof typeof EDITABLE_SETTINGS;

@Injectable()
export class PlatformSettingsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformSettingsService.name);
  /**
   * Loaded once at boot and refreshed on write. Callers such as pricing read
   * these on every quote, so they must stay synchronous — a database round
   * trip per price calculation would be a poor trade for a value that changes
   * a few times a year.
   */
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const rows = await this.prisma.platformSetting.findMany();
      this.cache.clear();
      for (const row of rows) {
        this.cache.set(row.key, row.value);
      }
      this.logger.log(`Loaded ${rows.length} platform setting override(s).`);
    } catch (error) {
      // A missing table must not stop the API from booting; env values still apply.
      this.logger.warn(
        `Could not load platform settings, falling back to environment: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  /** Stored override, else the environment value, else the built-in default. */
  getNumber(key: EditableSettingKey): number {
    const stored = this.cache.get(key);
    if (stored !== undefined) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return this.config.get<number>(key, EDITABLE_SETTINGS[key].fallback);
  }

  async update(
    key: EditableSettingKey,
    value: number,
    actorId: string,
  ): Promise<number> {
    const rule = EDITABLE_SETTINGS[key];
    if (!Number.isInteger(value) || value < rule.min || value > rule.max) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: `${rule.label} must be a whole number between ${rule.min} and ${rule.max}.`,
      });
    }

    const previous = this.getNumber(key);
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: String(value), updatedById: actorId },
      create: { key, value: String(value), updatedById: actorId },
    });
    this.cache.set(key, String(value));

    await this.audit.record({
      actorId,
      action: 'PLATFORM_SETTING_UPDATED',
      entityType: 'PlatformSetting',
      entityId: key,
      metadata: { from: previous, to: value },
    });

    this.logger.log(`${key} changed from ${previous} to ${value}.`);
    return value;
  }
}
