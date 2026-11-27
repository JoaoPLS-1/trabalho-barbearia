import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreateServicoDto } from './create-servico.dto.js';

export class UpdateServicoDto extends PartialType(CreateServicoDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  ativo?: boolean;
}
