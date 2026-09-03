import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ErrorCodes } from '../constants/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        {
          err: exception,
          path: request.url,
          method: request.method,
        },
        'Unhandled exception',
      );
    } else {
      this.logger.warn({
        path: request.url,
        method: request.method,
        code,
        message,
      });
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined && process.env.NODE_ENV !== 'production'
          ? { details }
          : {}),
      },
    });
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : this.extractMessage(payload) || exception.message;

      return {
        status,
        code: this.codeForStatus(status, payload),
        message,
        details:
          typeof payload === 'object' && payload !== null
            ? this.extractDetails(payload)
            : undefined,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCodes.CONFLICT,
          message: 'A record with this value already exists.',
        };
      }

      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCodes.NOT_FOUND,
          message: 'The requested record was not found.',
        };
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCodes.INTERNAL_ERROR,
      message: isProduction
        ? 'An unexpected error occurred.'
        : exception instanceof Error
          ? exception.message
          : 'An unexpected error occurred.',
    };
  }

  private codeForStatus(status: number, payload: unknown): string {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'errorCode' in payload &&
      typeof payload.errorCode === 'string'
    ) {
      return payload.errorCode;
    }

    switch (status) {
      case 400:
        return ErrorCodes.VALIDATION_ERROR;
      case 401:
        return ErrorCodes.UNAUTHORIZED;
      case 403:
        return ErrorCodes.FORBIDDEN;
      case 404:
        return ErrorCodes.NOT_FOUND;
      case 409:
        return ErrorCodes.CONFLICT;
      case 429:
        return ErrorCodes.RATE_LIMITED;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }

  private extractMessage(payload: unknown): string {
    if (typeof payload !== 'object' || payload === null) {
      return '';
    }

    if ('message' in payload) {
      const message = payload.message;
      if (Array.isArray(message)) {
        return message.join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }

    return '';
  }

  private extractDetails(payload: object): unknown {
    if ('message' in payload && Array.isArray(payload.message)) {
      return payload.message;
    }
    return undefined;
  }
}
