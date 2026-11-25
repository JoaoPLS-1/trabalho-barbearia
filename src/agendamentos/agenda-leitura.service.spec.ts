import { AgendaLeituraService } from './agenda-leitura.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AgendaQueryDto } from './dto/agenda-query.dto.js';
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
});
