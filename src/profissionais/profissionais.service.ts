import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProfissionaisDto } from './dto/create-profissional.dto.js';
import { UpdateProfissionaisDto } from './dto/update-profissional.dto.js';
import { CatalogQueryDto } from '../common/list-query.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';

@Injectable()
export class ProfissionaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresas: EmpresasService,
  ) {}

  async create(empresaId: number, dto: CreateProfissionaisDto) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    return this.prisma.profissional.create({ data: { ...dto, empresaId } });
  }

  async findAll(empresaId: number, query = new CatalogQueryDto()) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    const { page, pageSize, busca, ativo } = query;
    const where: Prisma.ProfissionalWhereInput = {
      empresaId,
      ...(ativo !== undefined ? { ativo } : {}),
      ...(busca ? { nome: { contains: busca } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.profissional.findMany({
        where,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.profissional.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(empresaId: number, id: number) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    const profissional = await this.prisma.profissional.findUnique({
      where: { empresaId, id },
    });
    if (!profissional)
      throw new NotFoundException('Profissional não encontrado nesta empresa.');
    return profissional;
  }

  async update(empresaId: number, id: number, dto: UpdateProfissionaisDto) {
    await this.findOne(empresaId, id);
    // Desativação mantém todas as reservas existentes para resolução pela recepção.
    return this.prisma.profissional.update({
      where: { id, empresaId },
      data: dto,
    });
  }

  async remove(empresaId: number, id: number) {
    await this.findOne(empresaId, id);
    const total = await this.prisma.agendamento.count({
      where: { profissionalId: id, empresaId },
    });
    if (total > 0) {
      throw new ConflictException(
        'O profissional possui agendamentos. Desative-o com PATCH { ativo: false }.',
      );
    }
    return this.prisma.profissional.delete({ where: { empresaId, id } });
  }
}
