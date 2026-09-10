import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);

  /*
    Close Prisma and Redis on SIGTERM rather than being killed mid-connection.
    Docker sends SIGTERM on every `restart`, `stop` and redeploy, so without
    this each one leaks a Postgres session and drops in-flight requests.
  */
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);

  // Bound explicitly to all interfaces: inside a container the default host can
  // resolve to loopback, which makes the port unreachable from outside it.
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
