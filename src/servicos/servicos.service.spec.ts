import { Prisma } from '../generated/prisma/client.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServicosService } from './servicos.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmpresasService } from '../empresas/empresas.service.js';
import { prismaDouble } from '../../test/helpers/prisma-double.js';

describe('Remoção de serviços', () => {
  function setup() {
    const prisma = prismaDouble();
    const empresas = { validarEmpresaAtiva: vi.fn(async () => ({ id: 1 })) };
    const service = new ServicosService(
      prisma as unknown as PrismaService,
      empresas as unknown as EmpresasService,
    );
    return { prisma, empresas, service };
  }

  it('não consulta vínculos nem remove um serviço de outra empresa', async () => {
    const { prisma, service } = setup();
    prisma.servico.findUnique.mockResolvedValue(null);
    await expect(service.remove(1, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.agendamentoServico.count).not.toHaveBeenCalled();
    expect(prisma.servico.delete).not.toHaveBeenCalled();
  });

  it('preserva serviço com histórico, contando vínculos pela relação correta', async () => {
    const { prisma, service } = setup();
    prisma.servico.findUnique.mockResolvedValue({
      id: 9,
      empresaId: 1,
      nome: 'Corte',
      ativo: true,
      duracaoMin: 30,
      preco: new Prisma.Decimal('40.00'),
    });
    prisma.agendamentoServico.count.mockResolvedValue(1);
    await expect(service.remove(1, 9)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.agendamentoServico.count).toHaveBeenCalledWith({
      where: { servicoId: 9, servico: { empresaId: 1 } },
    });
    expect(prisma.servico.delete).not.toHaveBeenCalled();
  });

  it('remove serviço sem uso, restrito à empresa', async () => {
    const { prisma, empresas, service } = setup();
    prisma.servico.findUnique.mockResolvedValue({
      id: 9,
      empresaId: 1,
      nome: 'Corte',
      ativo: true,
      duracaoMin: 30,
      preco: new Prisma.Decimal('40.00'),
    });
    prisma.servico.delete.mockResolvedValue({
      id: 9,
      empresaId: 1,
      nome: 'Corte',
      ativo: true,
      duracaoMin: 30,
      preco: new Prisma.Decimal('40.00'),
    });
    await expect(service.remove(1, 9)).resolves.toMatchObject({
      id: 9,
      preco: '40.00',
    });
    expect(empresas.validarEmpresaAtiva).toHaveBeenCalledWith(1);
    expect(prisma.servico.delete).toHaveBeenCalledWith({
      where: { empresaId: 1, id: 9 },
    });
  });

  it('interrompe a operação se a empresa estiver inativa', async () => {
    const { prisma, empresas, service } = setup();
    empresas.validarEmpresaAtiva.mockRejectedValue(
      new Error('Empresa inativa'),
    );
    await expect(service.remove(1, 9)).rejects.toThrow('Empresa inativa');
    expect(prisma.servico.findUnique).not.toHaveBeenCalled();
    expect(prisma.servico.delete).not.toHaveBeenCalled();
  });
});
