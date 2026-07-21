import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponseBody {
  success: false;
  message: string;
  statusCode: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const statusCode = this.resolveStatusCode(exception);
    const message = this.resolveMessage(exception);

    // Anything that isn't a deliberate HttpException (a bad SQL expression
    // throwing QueryFailedError, a null-reference bug, etc.) was being
    // reported to the client as a sanitized "Internal server error" but
    // never logged anywhere — invisible server-side, impossible to debug
    // from the terminal. Log the real exception whenever we're about to
    // report it as a generic 500; the client-facing response is unchanged.
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
    }

    const body: ErrorResponseBody = {
      success: false,
      message,
      statusCode,
    };

    response.status(statusCode).json(body);
  }

  private resolveStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const { message } = response as { message: string | string[] };
        return Array.isArray(message) ? message.join(', ') : message;
      }
      return exception.message;
    }
    return 'Internal server error';
  }
}
