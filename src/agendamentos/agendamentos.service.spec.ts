import { AgendamentosService } from './agendamentos.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  agendaDouble,
  AGORA,
  CHAVE,
  OUTRA_CHAVE,
  reservaFixture,
} from '../../test/helpers/agenda-double.js';

describe('Reserva e finalização transacionais', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const db = agendaDouble();
    const prisma = db as unknown as PrismaService;
    const service = new AgendamentosService(
      prisma,
      new EmpresasService(prisma),
    );
    const dto = {
      clienteId: 11,
      profissionalId: 7,
      servicoIds: [9],
      inicio: '2030-01-07T09:00:00-03:00',
    };
    return { db, service, dto };
  }

  it('grava snapshots e total exato dentro da transação após bloquear empresa e profissional', async () => {
    const { db, service, dto } = setup();
    const result = await service.create(1, dto, CHAVE);
    expect(result.item.total).toBe('40.00');
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
    expect(db.$queryRaw.mock.calls[0][0]).toEqual(
      expect.arrayContaining([expect.stringContaining('empresas')]),
    );
    expect(db.$queryRaw.mock.calls[1][0]).toEqual(
      expect.arrayContaining([expect.stringContaining('profissionais')]),
    );
    expect(db.agendamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 1,
          chaveOperacao: CHAVE,
          hashPedido: expect.stringMatching(/^[a-f0-9]{64}$/),
          servicos: {
            create: [
              expect.objectContaining({
                nomeContratado: 'Corte',
                duracaoContratadaMin: 30,
              }),
            ],
          },
        }),
      }),
    );
    expect(result.item).not.toHaveProperty('hashPedido');
  });

  it('recupera a mesma reserva inclusive após o início ou uma mudança de catálogo', async () => {
    const { db, service, dto } = setup();
    const first = await service.create(1, dto, CHAVE);
    vi.setSystemTime(new Date('2030-01-08T10:00Z'));
    db.servico.findMany.mockRejectedValue(
      new Error('Não deve consultar o catálogo no replay'),
    );
    const replay = await service.create(
      1,
      { ...dto, inicio: '2030-01-07T12:00:00Z' },
      CHAVE.toUpperCase(),
    );
    expect(replay.reutilizado).toBe(true);
    expect(replay.item.id).toBe(first.item.id);
    expect(db.agendamento.create).toHaveBeenCalledTimes(1);
  });

  it('rejeita a mesma chave com pedido diferente', async () => {
    const { service, dto } = setup();
    await service.create(1, dto, CHAVE);
    await expect(
      service.create(1, { ...dto, inicio: '2030-01-07T10:00:00-03:00' }, CHAVE),
    ).rejects.toMatchObject({ response: { code: 'OPERACAO_DIVERGENTE' } });
  });

  it('rejeita sobreposição na confirmação e aceita horário adjacente', async () => {
    const { service, dto } = setup();
    await service.create(1, dto, CHAVE);
    await expect(
      service.create(
        1,
        { ...dto, inicio: '2030-01-07T09:15:00-03:00' },
        OUTRA_CHAVE,
      ),
    ).rejects.toMatchObject({ response: { code: 'HORARIO_OCUPADO' } });
    await expect(
      service.create(
        1,
        { ...dto, inicio: '2030-01-07T09:30:00-03:00' },
        OUTRA_CHAVE,
      ),
    ).resolves.toMatchObject({ reutilizado: false });
  });

  it.each([
    '2030-01-07T08:00:00-03:00',
    '2030-01-07T09:07:00-03:00',
    '2030-01-07T18:45:00-03:00',
  ])('recusa horário fora da grade ou do expediente: %s', async (inicio) => {
    const { db, service, dto } = setup();
    await expect(
      service.create(1, { ...dto, inicio }, CHAVE),
    ).rejects.toThrow();
    expect(db.agendamento.create).not.toHaveBeenCalled();
  });

  it('não grava serviço inativo ou de outra empresa', async () => {
    const { db, service, dto } = setup();
    db.servico.findMany.mockResolvedValue([]);
    await expect(service.create(1, dto, CHAVE)).rejects.toThrow(
      'não encontrado ou inativo',
    );
    expect(db.agendamento.create).not.toHaveBeenCalled();
  });

  it('não grava cliente de outra empresa', async () => {
    const { db, service, dto } = setup();
    await expect(
      service.create(1, { ...dto, clienteId: 22 }, CHAVE),
    ).rejects.toThrow('Cliente não encontrado');
    expect(db.agendamento.create).not.toHaveBeenCalled();
  });

  it('não acessa o banco quando a chave é inválida', async () => {
    const { db, service, dto } = setup();
    await expect(service.create(1, dto, 'invalida')).rejects.toThrow(
      'Idempotency-Key',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('conclui somente depois do início e repete o mesmo estado sem nova alteração', async () => {
    const { db, service, dto } = setup();
    const { item } = await service.create(1, dto, CHAVE);
    await expect(
      service.atualizarStatus(1, item.id, { status: 'CONCLUIDO' }),
    ).rejects.toThrow('Aguarde');
    vi.setSystemTime(new Date('2030-01-07T12:01Z'));
    await service.atualizarStatus(1, item.id, { status: 'CONCLUIDO' });
    await service.atualizarStatus(1, item.id, { status: 'CONCLUIDO' });
    expect(db.agendamento.updateMany).toHaveBeenCalledTimes(1);
    await expect(
      service.atualizarStatus(1, item.id, { status: 'FALTOU' }),
    ).rejects.toThrow('já foi finalizado');
  });

  it('cancelamento futuro libera o horário', async () => {
    const { service, dto } = setup();
    const { item } = await service.create(1, dto, CHAVE);
    await service.atualizarStatus(1, item.id, { status: 'CANCELADO' });
    await expect(service.create(1, dto, OUTRA_CHAVE)).resolves.toMatchObject({
      reutilizado: false,
    });
  });

  it('não finaliza reserva de outra empresa', async () => {
    const { db, service } = setup();
    db.rows.push(reservaFixture({ empresaId: 2 }));
    await expect(
      service.atualizarStatus(1, 41, { status: 'CANCELADO' }),
    ).rejects.toThrow('não encontrado');
    expect(db.agendamento.updateMany).not.toHaveBeenCalled();
  });

  it('recusa falha na atualização condicional', async () => {
    const { db, service, dto } = setup();
    const { item } = await service.create(1, dto, CHAVE);
    db.agendamento.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.atualizarStatus(1, item.id, { status: 'CANCELADO' }),
    ).rejects.toThrow('foi alterado');
  });
});
