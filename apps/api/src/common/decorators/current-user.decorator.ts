import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../../modules/auth/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);

export const CurrentUserOptional = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: RequestUser | null }>();
    return request.user ?? undefined;
  },
);
