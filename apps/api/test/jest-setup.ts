import 'reflect-metadata';

jest.mock(
  '@nestjs/config',
  () => ({
    ConfigService: class ConfigService {
      get<T>(key: string, defaultValue?: T): T | undefined {
        const value = process.env[key];
        if (value === undefined) {
          return defaultValue;
        }
        return value as T;
      }

      getOrThrow(key: string): string {
        const value = process.env[key];
        if (!value) {
          throw new Error(`Missing env: ${key}`);
        }
        return value;
      }
    },
    ConfigModule: {
      forRoot: jest.fn(),
      forRootAsync: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock(
  '@nestjs/jwt',
  () => ({
    JwtModule: {
      register: jest.fn(),
      registerAsync: jest.fn(),
    },
    JwtService: class JwtService {},
  }),
  { virtual: true },
);
