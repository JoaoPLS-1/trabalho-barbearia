import {
  BadRequestException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ApiExceptionFilter } from './api-exception.filter.js';

function validationFields(
  errors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) fields[path] = Object.values(error.constraints);
    Object.assign(fields, validationFields(error.children ?? [], path));
  }
  return fields;
}

export function corsOrigins(value?: string): string[] {
  const origins = (value ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim());

  if (
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
        );
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      'CORS_ORIGINS deve conter origens HTTP válidas, sem caminho.',
    );
  }
  return [...new Set(origins)];
}

export function configureApp(
  app: INestApplication,
  origins = corsOrigins(process.env.CORS_ORIGINS),
): void {
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-empresa-id', 'Idempotency-Key'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDACAO',
          message: 'Confira os campos informados.',
          fieldErrors: validationFields(errors),
        }),
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}
