import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateAgendamentoDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  clienteId: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  profissionalId: number;

  @IsDateString({ strict: true })
  @Matches(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'inicio deve incluir segundos e Z ou offset.',
  })
  inicio: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  servicoIds: number[];
}
