import { PickType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto.js';

export class PendentesQueryDto extends PickType(ListQueryDto, [
  'page',
  'pageSize',
] as const) {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  data?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  profissionalId?: number;
}

export class AgendaQueryDto extends PendentesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  clienteId?: number;

  @IsOptional()
  @IsIn(['AGENDADO', 'CONCLUIDO', 'CANCELADO', 'FALTOU'])
  status?: 'AGENDADO' | 'CONCLUIDO' | 'CANCELADO' | 'FALTOU';
}

export class DisponibilidadeQueryDto {
  @IsDateString({ strict: true })
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  data: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  profissionalId: number;

  @Transform(({ value }) =>
    typeof value === 'string' && /^[1-9]\d*(,[1-9]\d*)*$/.test(value)
      ? value.split(',').map(Number)
      : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  servicoIds: number[];
}
