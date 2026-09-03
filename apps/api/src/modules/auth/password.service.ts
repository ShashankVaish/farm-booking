import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  constructor(private readonly config: ConfigService) {}

  hash(plain: string): Promise<string> {
    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    return bcrypt.hash(plain, rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
