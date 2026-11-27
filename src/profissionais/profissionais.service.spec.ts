import { ConflictException } from '@nestjs/common';
import { ProfissionaisService } from './profissionais.service.js';
import { CatalogQueryDto } from '../common/list-query.dto.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmpresasService } from '../empresas/empresas.service.js';
import { prismaDouble } from '../../test/helpers/prisma-double.js';

describe('Histórico dos profissionais', () => {
  function setup() {
    const prisma = prismaDouble();
    const service = new ProfissionaisService(
      prisma as unknown as PrismaService,
      { validarEmpresaAtiva: vi.fn() } as unknown as EmpresasService,
    );
    return { prisma, service };
  }

  it('desativa sem apagar ou cancelar reservas', async () => {
    const { prisma, service } = setup();
    await expect(service.update(1, 7, { ativo: false })).resolves.toMatchObject(
      { ativo: false },
    );
    expect(prisma.profissional.delete).not.toHaveBeenCalled();
    expect(prisma.agendamento.count).not.toHaveBeenCalled();
  });

  it('permite consultar somente inativos', async () => {
    const { prisma, service } = setup();
    await service.findAll(
      1,
      Object.assign(new CatalogQueryDto(), { ativo: false }),
    );
    expect(prisma.profissional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 1, ativo: false },
      }),
    );
  });

  it('impede exclusão de profissional com histórico', async () => {
    const { prisma, service } = setup();
    prisma.agendamento.count.mockResolvedValue(1);
    await expect(service.remove(1, 7)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.profissional.delete).not.toHaveBeenCalled();
  });

  it('não desativa um profissional de outra empresa', async () => {
    const { prisma, service } = setup();
    await expect(service.update(2, 7, { ativo: false })).rejects.toThrow(
      'não encontrado',
    );
    expect(prisma.profissional.update).not.toHaveBeenCalled();
  });
});
