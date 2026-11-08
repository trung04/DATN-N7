import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';

interface HttpExceptionBody {
  error?: string;
  message?: string | string[];
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = this.toProblemDetails(exception);
    const traceHeader = request.headers['x-request-id'];
    const traceId = Array.isArray(traceHeader) ? traceHeader[0] : traceHeader;

    response
      .status(problem.status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: problem.title,
        status: problem.status,
        detail: problem.detail,
        instance: request.originalUrl,
        code: problem.code,
        ...(traceId ? { traceId } : {}),
        ...(problem.errors ? { errors: problem.errors } : {}),
      });
  }

  private toProblemDetails(exception: unknown): {
    status: number;
    title: string;
    detail: string;
    code: string;
    errors?: Array<{ message: string }>;
  } {
    if (exception instanceof DomainException) {
      const statusByCategory: Record<DomainException['category'], number> = {
        validation: HttpStatus.BAD_REQUEST,
        unauthorized: HttpStatus.UNAUTHORIZED,
        not_found: HttpStatus.NOT_FOUND,
        conflict: HttpStatus.CONFLICT,
      };
      const status = statusByCategory[exception.category];
      return {
        status,
        title: this.statusTitle(status),
        detail: exception.message,
        code: exception.code,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const normalizedBody: HttpExceptionBody =
        typeof body === 'string' ? { message: body } : body;
      const messages = Array.isArray(normalizedBody.message)
        ? normalizedBody.message
        : undefined;

      return {
        status,
        title: this.statusTitle(status),
        detail: messages
          ? 'Request validation failed.'
          : typeof normalizedBody.message === 'string'
            ? normalizedBody.message
            : exception.message,
        code: messages ? 'VALIDATION_FAILED' : `HTTP_${status}`,
        ...(messages
          ? { errors: messages.map((message) => ({ message })) }
          : {}),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'Internal Server Error',
      detail: 'An unexpected error occurred.',
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  private statusTitle(status: number): string {
    const name = HttpStatus[status];
    if (typeof name !== 'string') return 'Error';
    return name
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
