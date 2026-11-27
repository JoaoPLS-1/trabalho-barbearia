import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const EmpresaId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const value = ctx.switchToHttp().getRequest<Request>().headers[
      'x-empresa-id'
    ];
    const id =
      typeof value === 'string' && /^[1-9]\d*$/.test(value)
        ? Number(value)
        : NaN;

    if (!Number.isSafeInteger(id)) {
      throw new BadRequestException(
        'Informe uma empresa válida no header x-empresa-id.',
      );
    }
    return id;
  },
);
