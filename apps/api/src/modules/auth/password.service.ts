import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private dummyHash?: string;

  constructor(private readonly config: ConfigService) {}

  hash(plain: string): Promise<string> {
    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    return bcrypt.hash(plain, rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async compareOrDummy(plain: string, hash: string | null | undefined): Promise<boolean> {
    if (hash) {
      return this.compare(plain, hash);
    }
    await this.compare(plain, await this.dummy());
    return false;
  }

  private async dummy(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await this.hash('timing-dummy-password');
    }
    return this.dummyHash;
  }
}
