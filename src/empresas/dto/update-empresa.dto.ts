import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreateEmpresaDto } from './create-empresa.dto.js';

export class UpdateEmpresaDto extends PartialType(CreateEmpresaDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  ativa?: boolean;
}
