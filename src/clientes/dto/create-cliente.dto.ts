import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  normalizarNome,
  normalizarTelefone,
} from '../../common/normalizacao.js';

export class CreateClienteDto {
  @Transform(({ value }) => normalizarNome(value))
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do cliente.' })
  @MaxLength(120)
  nome: string;

  @Transform(({ value }) => normalizarTelefone(value))
  @IsString()
  @Matches(/^\d{10,11}$/, {
    message: 'Informe telefone com DDD e 10 ou 11 dígitos.',
  })
  telefone: string;
}
