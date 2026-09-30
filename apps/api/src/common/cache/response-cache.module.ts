import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PublicCacheInterceptor } from './public-cache.interceptor';
import { ResponseCacheService } from './response-cache.service';

/** Redis response cache for public reads; see ResponseCacheService. */
@Global()
@Module({
  providers: [
    ResponseCacheService,
    { provide: APP_INTERCEPTOR, useClass: PublicCacheInterceptor },
  ],
  exports: [ResponseCacheService],
})
export class ResponseCacheModule {}
