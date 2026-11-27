import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDivisibleBy,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ExpedienteDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(64)
  fusoHorario?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(1425)
  @IsDivisibleBy(15)
  aberturaMin?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(15)
  @Max(1440)
  @IsDivisibleBy(15)
  fechamentoMin?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  diasFuncionamento?: number[];
}
