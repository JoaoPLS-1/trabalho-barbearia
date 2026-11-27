import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizarNome } from '../../common/normalizacao.js';

export class CreateServicoDto {
  @Transform(({ value }) => normalizarNome(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @IsString()
  @Matches(/^(?!0\.00$)(?:0|[1-9]\d{0,7})\.\d{2}$/, {
    message:
      'preco deve ser uma string positiva com duas casas decimais, por exemplo "45.00".',
  })
  preco: string;

  @IsInt()
  @Min(5)
  @Max(600)
  duracaoMin: number;
}
