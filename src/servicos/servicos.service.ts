import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateServicoDto } from './dto/create-servico.dto.js';
import { UpdateServicoDto } from './dto/update-servico.dto.js';
import { withEmpresaLock } from '../common/empresa-transaction.js';
import { CatalogQueryDto } from '../common/list-query.dto.js';
import { Prisma, type Servico } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';

const resposta = (servico: Servico) => ({
  ...servico,
  preco: servico.preco.toFixed(2),
});

@Injectable()
export class ServicosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresas: EmpresasService,
  ) {}

  async create(empresaId: number, dto: CreateServicoDto) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    return resposta(
      await this.prisma.servico.create({ data: { ...dto, empresaId } }),
    );
  }

  async findAll(empresaId: number, query = new CatalogQueryDto()) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    const { page, pageSize, busca, ativo } = query;
    const where: Prisma.ServicoWhereInput = {
      empresaId,
      ...(ativo !== undefined ? { ativo } : {}),
      ...(busca ? { nome: { contains: busca } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.servico.findMany({
        where,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.servico.count({ where }),
    ]);
    return { items: items.map(resposta), total, page, pageSize };
  }

  async findOne(empresaId: number, id: number) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    const servico = await this.prisma.servico.findUnique({
      where: { empresaId, id },
    });
    if (!servico)
      throw new NotFoundException('Serviço não encontrado nesta empresa.');
    return resposta(servico);
  }

  async update(empresaId: number, id: number, dto: UpdateServicoDto) {
    await this.findOne(empresaId, id);
    return withEmpresaLock(this.prisma, empresaId, async (tx) =>
      resposta(
        await tx.servico.update({ where: { empresaId, id }, data: dto }),
      ),
    );
  }

  async remove(empresaId: number, id: number) {
    await this.findOne(empresaId, id);
    return withEmpresaLock(this.prisma, empresaId, async (tx) => {
      const usos = await tx.agendamentoServico.count({
        where: { servicoId: id, servico: { empresaId } },
      });
      if (usos > 0)
        throw new ConflictException(
          'Serviço já utilizado em agendamentos. Desative-o com PATCH { ativo: false }.',
        );
      return resposta(await tx.servico.delete({ where: { empresaId, id } }));
    });
  }
}
