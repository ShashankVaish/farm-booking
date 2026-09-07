import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = 'Too many attempts. Wait a minute and try again.';

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const env = process.env.NODE_ENV;
    if (env === 'development' || env === 'test') {
      return true;
    }
    return super.shouldSkip(context);
  }
}
