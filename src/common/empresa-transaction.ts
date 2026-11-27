import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, type Empresa } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export function withEmpresaLock<T>(
  prisma: PrismaService,
  empresaId: number,
  work: (tx: Prisma.TransactionClient, empresa: Empresa) => Promise<T>,
  exigirAtiva = true,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // Ordem única: empresa, profissional, atendimento. SQL parametrizado.
      // A serialização por empresa atende ao volume da recepção e coordena também
      // mudanças no catálogo e no expediente com a confirmação da reserva.
      const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM empresas WHERE id = ${empresaId} FOR UPDATE
    `;
      if (!rows.length) throw new NotFoundException('Empresa não encontrada.');
      const empresa = await tx.empresa.findUnique({ where: { id: empresaId } });
      if (!empresa) throw new NotFoundException('Empresa não encontrada.');
      if (exigirAtiva && !empresa.ativa) {
        throw new BadRequestException({
          code: 'EMPRESA_INATIVA',
          message: 'Empresa inativa. Escolha outra empresa.',
        });
      }
      return work(tx, empresa);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 10000,
    },
  );
}
