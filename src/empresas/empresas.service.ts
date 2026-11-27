import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateEmpresaDto } from './dto/create-empresa.dto.js';
import { UpdateEmpresaDto } from './dto/update-empresa.dto.js';
import { EmpresaQueryDto } from './dto/empresa-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { withEmpresaLock } from '../common/empresa-transaction.js';
import { validarExpediente } from '../agendamentos/expediente.js';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmpresaDto) {
    validarExpediente({
      fusoHorario: dto.fusoHorario ?? 'America/Sao_Paulo',
      aberturaMin: dto.aberturaMin ?? 540,
      fechamentoMin: dto.fechamentoMin ?? 1140,
      diasFuncionamento: dto.diasFuncionamento ?? [1, 2, 3, 4, 5, 6],
    });
    const existe = await this.prisma.empresa.findUnique({
      where: { cnpj: dto.cnpj },
    });
    if (existe) throw new ConflictException('Já existe empresa com este CNPJ.');
    return this.prisma.empresa.create({ data: dto });
  }

  findAll(query: EmpresaQueryDto = {}) {
    return this.prisma.empresa.findMany({
      where: query.ativa !== undefined ? { ativa: query.ativa } : {},
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: number) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');
    return empresa;
  }

  async update(id: number, dto: UpdateEmpresaDto) {
    return withEmpresaLock(
      this.prisma,
      id,
      async (tx, empresa) => {
        validarExpediente({
          fusoHorario: dto.fusoHorario ?? empresa.fusoHorario,
          aberturaMin: dto.aberturaMin ?? empresa.aberturaMin,
          fechamentoMin: dto.fechamentoMin ?? empresa.fechamentoMin,
          diasFuncionamento: dto.diasFuncionamento ?? empresa.diasFuncionamento,
        });
        // Reservas existentes mantêm seus instantes e dados contratados.
        return tx.empresa.update({ where: { id }, data: dto });
      },
      false,
    );
  }

  async validarEmpresaAtiva(id: number) {
    const empresa = await this.findOne(id);
    if (!empresa.ativa) {
      throw new BadRequestException({
        code: 'EMPRESA_INATIVA',
        message: 'Empresa inativa. Escolha outra empresa.',
      });
    }
    return empresa;
  }
}
