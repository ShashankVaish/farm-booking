import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { AdminModule } from './modules/admin/admin.module';
import { AmenitiesModule } from './modules/amenities/amenities.module';
import { AuthModule } from './modules/auth/auth.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MediaModule } from './modules/media/media.module';
import { OwnerModule } from './modules/owner/owner.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { SupportModule } from './modules/support/support.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'password',
              'passwordHash',
              'req.body.password',
              'req.body.code',
              'req.body.otp',
              'req.body.signature',
              'TWILIO_AUTH_TOKEN',
              'RAZORPAY_KEY_SECRET',
              'GOOGLE_MAPS_API_KEY',
            ],
            remove: true,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL_MS', 60000),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    LocationsModule,
    PricingModule,
    NotificationsModule,
    CouponsModule,
    AmenitiesModule,
    PropertiesModule,
    SearchModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    WishlistModule,
    OwnerModule,
    AdminModule,
    SupportModule,
    MediaModule,
  ],
  providers: [
    Logger,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
