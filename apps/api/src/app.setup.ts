import type { INestApplication } from '@nestjs/common';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import express from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { parseCorsOrigins } from './config/env.validation';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  /*
    Behind Nginx (or any reverse proxy) every request arrives from the proxy, so
    without this `request.ip` is the proxy's address for everybody. Two things
    break as a result: rate limiting collapses into a single shared bucket — one
    person hammering /auth/login would lock out every other user — and the IP
    recorded in the audit trail is meaningless.

    `1` means trust exactly one hop. Trusting all hops would let a caller forge
    X-Forwarded-For and pick their own rate-limit bucket.
  */
  const proxyHops = Number(config.get<string>('TRUST_PROXY_HOPS') ?? 0);
  if (Number.isFinite(proxyHops) && proxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads'), {
      setHeaders(res, filePath) {
        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
        const types: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
        };
        const type = types[ext];
        if (!type) {
          res.statusCode = 404;
          return;
        }
        res.setHeader('Content-Type', type);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );

  app.enableCors({
    origin: parseCorsOrigins(
      config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    ),
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'uploads/(.*)', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
}
