import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizarNome } from '../../common/normalizacao.js';

export class CreateProfissionaisDto {
  @Transform(({ value }) => normalizarNome(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;
}
