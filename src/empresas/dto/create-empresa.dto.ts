import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizarNome } from '../../common/normalizacao.js';
import { ExpedienteDto } from './expediente.dto.js';

export class CreateEmpresaDto extends ExpedienteDto {
  @Transform(({ value }) => normalizarNome(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/[./-]/g, '').toUpperCase()
      : value,
  )
  @Matches(/^[A-Z0-9]{12}\d{2}$/, {
    message: 'CNPJ deve ter 12 letras ou números seguidos de 2 dígitos.',
  })
  cnpj: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefone?: string;
}
