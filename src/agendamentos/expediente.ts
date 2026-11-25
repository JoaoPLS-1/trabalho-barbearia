import { BadRequestException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';

export interface Expediente {
  fusoHorario: string;
  aberturaMin: number;
  fechamentoMin: number;
  diasFuncionamento: unknown;
}
export interface Intervalo {
  inicio: Date;
  fim: Date;
}

export function validarExpediente(config: Expediente): void {
  const { aberturaMin, fechamentoMin, diasFuncionamento, fusoHorario } = config;
  if (
    !Number.isInteger(aberturaMin) ||
    !Number.isInteger(fechamentoMin) ||
    aberturaMin < 0 ||
    fechamentoMin > 1440 ||
    fechamentoMin <= aberturaMin ||
    aberturaMin % 15 !== 0 ||
    fechamentoMin % 15 !== 0
  ) {
    throw new BadRequestException(
      'O expediente deve começar e terminar em múltiplos de 15 minutos, dentro do mesmo dia.',
    );
  }
  if (
    !Array.isArray(diasFuncionamento) ||
    !diasFuncionamento.length ||
    new Set(diasFuncionamento).size !== diasFuncionamento.length ||
    diasFuncionamento.some(
      (dia) => !Number.isInteger(dia) || dia < 1 || dia > 7,
    )
  ) {
    throw new BadRequestException(
      'Informe dias de funcionamento únicos de 1 (segunda) a 7 (domingo).',
    );
  }
  try {
    if (/^[+-]/.test(fusoHorario)) throw new Error();
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(fusoHorario);
  } catch {
    throw new BadRequestException('Informe um fuso horário IANA válido.');
  }
}

export function dataCivil(data: string): Temporal.PlainDate {
  try {
    if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(data)) throw new Error();
    return Temporal.PlainDate.from(data, { overflow: 'reject' });
  } catch {
    throw new BadRequestException(
      'Informe uma data válida no formato AAAA-MM-DD.',
    );
  }
}

export function instante(inicio: string): Date {
  try {
    if (
      typeof inicio !== 'string' ||
      !/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(inicio)
    )
      throw new Error();
    const result = new Date(Temporal.Instant.from(inicio).epochMilliseconds);
    if (result.getUTCFullYear() < 1000 || result.getUTCFullYear() > 9999)
      throw new Error();
    return result;
  } catch {
    throw new BadRequestException(
      'inicio deve ser uma data e hora ISO válida com Z ou offset, incluindo segundos.',
    );
  }
}

export function diaNoFuso(value: Date, fuso: string): string {
  return Temporal.Instant.fromEpochMilliseconds(value.getTime())
    .toZonedDateTimeISO(fuso)
    .toPlainDate()
    .toString();
}

export function intervaloDia(data: string, fuso: string): Intervalo {
  const day = dataCivil(data);
  const result = {
    inicio: new Date(day.toZonedDateTime(fuso).epochMilliseconds),
    fim: new Date(day.add({ days: 1 }).toZonedDateTime(fuso).epochMilliseconds),
  };
  if (
    [result.inicio, result.fim].some(
      (item) => item.getUTCFullYear() < 1000 || item.getUTCFullYear() > 9999,
    )
  ) {
    throw new BadRequestException(
      'Data fora do intervalo suportado neste fuso.',
    );
  }
  return result;
}

function horarioLocal(
  day: Temporal.PlainDate,
  minutos: number,
  fuso: string,
): Date {
  if (minutos === 1440) {
    day = day.add({ days: 1 });
    minutos = 0;
  }
  const time = Temporal.PlainTime.from({
    hour: Math.floor(minutos / 60),
    minute: minutos % 60,
  });
  return new Date(
    day
      .toPlainDateTime(time)
      .toZonedDateTime(fuso, { disambiguation: 'reject' }).epochMilliseconds,
  );
}

export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && a.fim > b.inicio;
}

export function horariosDisponiveis(
  config: Expediente,
  data: string,
  duracaoMin: number,
  agora: Date,
  ocupados: Intervalo[] = [],
): Intervalo[] {
  validarExpediente(config);
  intervaloDia(data, config.fusoHorario);
  const day = dataCivil(data);
  if (!Number.isInteger(duracaoMin) || duracaoMin <= 0)
    throw new BadRequestException('Duração inválida.');
  if (!(config.diasFuncionamento as number[]).includes(day.dayOfWeek))
    return [];
  const horarios: Intervalo[] = [];
  let limite: Date;
  try {
    limite = horarioLocal(day, config.fechamentoMin, config.fusoHorario);
  } catch {
    return [];
  }
  for (
    let minuto = config.aberturaMin;
    minuto < config.fechamentoMin;
    minuto += 15
  ) {
    let inicio: Date;
    try {
      inicio = horarioLocal(day, minuto, config.fusoHorario);
    } catch {
      continue;
    } // Horas inexistentes ou ambíguas não são oferecidas.
    const fim = new Date(inicio.getTime() + duracaoMin * 60000);
    const intervalo = { inicio, fim };
    if (
      inicio > agora &&
      fim <= limite &&
      !ocupados.some((item) => sobrepoe(intervalo, item))
    ) {
      horarios.push(intervalo);
    }
  }
  return horarios;
}
