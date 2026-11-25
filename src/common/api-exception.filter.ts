import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

const HTTP_CODES: Record<number, string> = {
  400: 'VALIDACAO',
  404: 'NAO_ENCONTRADO',
  409: 'CONFLITO',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'ERRO_INTERNO';
    let message = 'Não foi possível concluir a operação. Tente novamente.';
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      if (statusCode < 500) {
        code = HTTP_CODES[statusCode] ?? 'REQUISICAO_RECUSADA';
        const body = exception.getResponse();
        if (typeof body === 'string') {
          message = body;
        } else {
          const details = body as {
            code?: string;
            message?: string | string[];
            fieldErrors?: Record<string, string[]>;
          };
          code = details.code ?? code;
          message = Array.isArray(details.message)
            ? details.message.join('; ')
            : (details.message ?? exception.message);
          fieldErrors = details.fieldErrors;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        code = 'REGISTRO_DUPLICADO';
        message = 'Já existe um registro com esses dados nesta empresa.';
      } else if (exception.code === 'P2003') {
        statusCode = HttpStatus.CONFLICT;
        code = 'REGISTRO_VINCULADO';
        message = 'O registro possui vínculos e não pode ser removido.';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        code = 'NAO_ENCONTRADO';
        message = 'Registro não encontrado nesta empresa.';
      }
    }

    if (statusCode >= 500) {
      this.logger.error(
        'Falha inesperada ao atender requisição.',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({
        statusCode,
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
      });
  }
}
