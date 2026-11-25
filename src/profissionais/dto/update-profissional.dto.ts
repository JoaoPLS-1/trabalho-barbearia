import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreateProfissionaisDto } from './create-profissional.dto.js';

export class UpdateProfissionaisDto extends PartialType(
  CreateProfissionaisDto,
  { skipNullProperties: false },
) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  ativo?: boolean;
}
