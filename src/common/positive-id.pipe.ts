import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

@Injectable()
export class PositiveIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(id)) {
      throw new BadRequestException(
        'O identificador deve ser um inteiro positivo.',
      );
    }
    return id;
  }
}
