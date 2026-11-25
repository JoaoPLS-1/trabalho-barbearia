import { AgendaLeituraService } from './agenda-leitura.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AgendaQueryDto, PendentesQueryDto } from './dto/agenda-query.dto.js';
import {
  agendaDouble,
  reservaFixture,
} from '../../test/helpers/agenda-double.js';

describe('Painel e consultas da agenda', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-07T14:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  function setup() {
    const db = agendaDouble([
      reservaFixture({
        id: 1,
        inicio: new Date('2030-01-05T12:00Z'),
        fim: new Date('2030-01-05T12:30Z'),
      }),
      reservaFixture({
        id: 2,
        inicio: new Date('2030-01-07T13:00Z'),
        fim: new Date('2030-01-07T15:00Z'),
      }),
      reservaFixture({
        id: 3,
        inicio: new Date('2030-01-07T13:15Z'),
        fim: new Date('2030-01-07T13:45Z'),
      }),
      reservaFixture({ id: 4, status: 'CONCLUIDO' }),
      reservaFixture({ id: 5, empresaId: 2 }),
    ]);
    const prisma = db as unknown as PrismaService;
    return {
      db,
      service: new AgendaLeituraService(prisma, new EmpresasService(prisma)),
    };
  }

  it('inclui dias anteriores e prioriza atrasos antes de atendimentos em andamento', async () => {
    const { service } = setup();
    const result = await service.pendentes(
      1,
      Object.assign(new PendentesQueryDto(), { pageSize: 2 }),
    );
    expect(result.items.map((item) => item.id)).toEqual([1, 3]);
    expect(result.resumo).toEqual({ pendentes: 3, atrasados: 2, hoje: 2 });
    expect(result.total).toBe(3);
  });

  it('continua corretamente na página seguinte e além do final', async () => {
    const { service } = setup();
    const query = Object.assign(new PendentesQueryDto(), {
      pageSize: 2,
      page: 2,
    });
    expect(
      (await service.pendentes(1, query)).items.map((item) => item.id),
    ).toEqual([2]);
    expect((await service.pendentes(1, { ...query, page: 9 })).items).toEqual(
      [],
    );
  });

  it('filtra a lista por dia sem esconder atrasos globais nos indicadores', async () => {
    const { service } = setup();
    const result = await service.pendentes(
      1,
      Object.assign(new PendentesQueryDto(), { data: '2030-01-07' }),
    );
    expect(result.items.map((item) => item.id)).toEqual([3, 2]);
    expect(result.resumo.atrasados).toBe(2);
    expect(result.total).toBe(2);
  });

  it('aplica cliente, profissional e estado ao histórico com limites no fuso', async () => {
    const { db, service } = setup();
    await service.findAll(
      1,
      Object.assign(new AgendaQueryDto(), {
        data: '2030-01-07',
        clienteId: 11,
        profissionalId: 7,
        status: 'CONCLUIDO',
      }),
    );
    expect(db.agendamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 1,
          clienteId: 11,
          profissionalId: 7,
          status: 'CONCLUIDO',
          inicio: {
            gte: new Date('2030-01-07T03:00Z'),
            lt: new Date('2030-01-08T03:00Z'),
          },
        },
      }),
    );
  });

  it('retorna 404 para detalhes e confirmação de outra empresa', async () => {
    const { service } = setup();
    await expect(service.findOne(1, 5)).rejects.toThrow('não encontrado');
    await expect(
      service.operacao(99, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow('Empresa não encontrada');
  });
  it('calcula hoje no dia civil da empresa quando a data UTC já mudou', async () => {
    const { service } = setup();
    vi.setSystemTime(new Date('2030-01-08T02:00:00Z'));
    const result = await service.pendentes(1, new PendentesQueryDto());
    expect(result.resumo.hoje).toBe(2);
  });
});
