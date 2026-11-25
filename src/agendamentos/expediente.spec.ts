import {
  diaNoFuso,
  horariosDisponiveis,
  instante,
  intervaloDia,
  sobrepoe,
  validarExpediente,
} from './expediente.js';

const config = {
  fusoHorario: 'America/Sao_Paulo',
  aberturaMin: 540,
  fechamentoMin: 1140,
  diasFuncionamento: [1, 2, 3, 4, 5, 6],
};
const agora = new Date('2030-01-07T10:00:00Z');

describe('Expediente no fuso da empresa', () => {
  it.each([
    ['9999-12-31', 'UTC'],
    ['1000-01-01', 'Asia/Tokyo'],
  ])(
    'recusa dia que ultrapassa os limites do MySQL no fuso: %s %s',
    (data, fuso) =>
      expect(() => intervaloDia(data, fuso)).toThrow('intervalo suportado'),
  );

  it('gera a grade de 15 minutos e exige que a duração caiba até o fechamento', () => {
    const result = horariosDisponiveis(config, '2030-01-07', 30, agora);
    expect(result).toHaveLength(39);
    expect(result[0].inicio.toISOString()).toBe('2030-01-07T12:00:00.000Z');
    expect(result.at(-1)?.fim.toISOString()).toBe('2030-01-07T22:00:00.000Z');
  });
  it('aceita atendimentos adjacentes, mas rejeita sobreposição parcial', () => {
    const ocupado = {
      inicio: new Date('2030-01-07T12:30Z'),
      fim: new Date('2030-01-07T13:00Z'),
    };
    const starts = horariosDisponiveis(config, '2030-01-07', 30, agora, [
      ocupado,
    ]).map((s) => s.inicio.toISOString());
    expect(starts).toContain('2030-01-07T12:00:00.000Z');
    expect(starts).not.toContain('2030-01-07T12:15:00.000Z');
    expect(starts).toContain('2030-01-07T13:00:00.000Z');
    expect(
      sobrepoe(ocupado, {
        inicio: ocupado.fim,
        fim: new Date('2030-01-07T13:30Z'),
      }),
    ).toBe(false);
  });
  it('não oferece o instante atual nem horários passados', () => {
    const result = horariosDisponiveis(
      config,
      '2030-01-07',
      30,
      new Date('2030-01-07T12:00Z'),
    );
    expect(result[0].inicio.toISOString()).toBe('2030-01-07T12:15:00.000Z');
  });
  it('não oferece domingo ou serviço maior que o expediente', () => {
    expect(horariosDisponiveis(config, '2030-01-06', 30, agora)).toEqual([]);
    expect(horariosDisponiveis(config, '2030-01-07', 601, agora)).toEqual([]);
  });
  it.each(['2030-02-30', '2030-13-01', '2030-1-01'])(
    'rejeita data civil inválida %s',
    (data) => {
      expect(() => intervaloDia(data, config.fusoHorario)).toThrow(
        'data válida',
      );
    },
  );
  it.each([
    '2030-02-30T12:00:00Z',
    '2030-01-07T12:00:00',
    '2030-01-07T12:00:00.000001Z',
  ])('rejeita instante inválido ou sem offset %s', (value) =>
    expect(() => instante(value)).toThrow(),
  );
  it('converte offset para o mesmo instante UTC', () => {
    expect(instante('2030-01-07T09:00:00-03:00').toISOString()).toBe(
      '2030-01-07T12:00:00.000Z',
    );
  });
  it('determina hoje no fuso e não no dia UTC', () => {
    expect(diaNoFuso(new Date('2030-01-08T02:00Z'), config.fusoHorario)).toBe(
      '2030-01-07',
    );
    expect(
      intervaloDia('2030-01-07', config.fusoHorario).inicio.toISOString(),
    ).toBe('2030-01-07T03:00:00.000Z');
  });
  it('considera dias com duração diferente de 24 horas', () => {
    const day = intervaloDia('2024-03-10', 'America/New_York');
    expect(day.fim.getTime() - day.inicio.getTime()).toBe(23 * 3600000);
  });
  it('não oferece horários ambíguos na mudança do horário de verão', () => {
    const result = horariosDisponiveis(
      {
        ...config,
        fusoHorario: 'America/New_York',
        aberturaMin: 60,
        fechamentoMin: 180,
        diasFuncionamento: [7],
      },
      '2024-11-03',
      15,
      new Date('2024-11-02T00:00Z'),
    );
    expect(result).toHaveLength(4);
    expect(result[0].inicio.toISOString()).toBe('2024-11-03T07:00:00.000Z');
  });
  it.each([
    { aberturaMin: 1140 },
    { fechamentoMin: 545 },
    { diasFuncionamento: [1, 1] },
    { diasFuncionamento: [] },
    { fusoHorario: 'Fuso/Inexistente' },
  ])('recusa expediente inconsistente %s', (change) => {
    expect(() => validarExpediente({ ...config, ...change })).toThrow();
  });
});
