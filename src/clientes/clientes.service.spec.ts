import { ConflictException } from '@nestjs/common';
import { ClientesService } from './clientes.service.js';
import { ListQueryDto } from '../common/list-query.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmpresasService } from '../empresas/empresas.service.js';
import { prismaDouble } from '../../test/helpers/prisma-double.js';

describe('Clientes por empresa', () => {
  function setup() {
    const prisma = prismaDouble();
    const empresas = { validarEmpresaAtiva: vi.fn() };
    const service = new ClientesService(
      prisma as unknown as PrismaService,
      empresas as unknown as EmpresasService,
    );
    return { prisma, service };
  }

  it('busca por nome e telefone parcial sem perder o contexto e paginação', async () => {
    const { prisma, service } = setup();
    const query = Object.assign(new ListQueryDto(), {
      busca: '(11) 9999',
      page: 2,
      pageSize: 5,
    });
    await service.findAll(1, query);
    expect(prisma.cliente.findMany).toHaveBeenCalledWith({
      where: {
        empresaId: 1,
        OR: [
          { nome: { contains: '(11) 9999' } },
          { telefone: { contains: '119999' } },
        ],
      },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      skip: 5,
      take: 5,
    });
    expect(prisma.cliente.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ empresaId: 1 }),
    });
  });

  it('não transforma busca por nome em uma busca vazia de telefone', async () => {
    const { prisma, service } = setup();
    await service.findAll(
      1,
      Object.assign(new ListQueryDto(), { busca: 'Ana' }),
    );
    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 1, OR: [{ nome: { contains: 'Ana' } }] },
      }),
    );
  });

  it('rejeita telefone de outro cliente na edição', async () => {
    const { prisma, service } = setup();
    prisma.cliente.findUnique.mockResolvedValue({ id: 99 });
    await expect(
      service.update({
        id: 11,
        empresaId: 1,
        clienteData: { telefone: '11999990002' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('permite manter o próprio telefone', async () => {
    const { prisma, service } = setup();
    prisma.cliente.findUnique.mockResolvedValue({ id: 11 });
    await service.update({
      id: 11,
      empresaId: 1,
      clienteData: { telefone: '11999990001' },
    });
    expect(prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 11, empresaId: 1 },
      data: { telefone: '11999990001' },
    });
  });

  it('traduz colisão de cadastro simultâneo em conflito de telefone', async () => {
    const { prisma, service } = setup();
    prisma.cliente.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: '7.10.1',
      }),
    );
    await expect(
      service.create(1, { nome: 'Ana', telefone: '11999990001' }),
    ).rejects.toMatchObject({ response: { code: 'TELEFONE_DUPLICADO' } });
  });

  it('preserva cliente com qualquer histórico ou reserva', async () => {
    const { prisma, service } = setup();
    prisma.agendamento.count.mockResolvedValue(1);
    await expect(
      service.remove({ id: 11, empresaId: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.cliente.delete).not.toHaveBeenCalled();
  });

  it('não altera cliente de outra empresa', async () => {
    const { prisma, service } = setup();
    await expect(
      service.update({ id: 22, empresaId: 1, clienteData: { nome: 'Ana' } }),
    ).rejects.toThrow('não encontrado');
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });
});
