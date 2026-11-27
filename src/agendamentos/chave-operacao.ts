import { BadRequestException } from '@nestjs/common';

export function chaveOperacao(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new BadRequestException(
      'Informe Idempotency-Key com um UUID v4 válido.',
    );
  }
  return value.toLowerCase();
}
