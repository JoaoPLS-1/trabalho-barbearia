import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto.js';
import { UpdateClienteDto } from './dto/update-cliente.dto.js';
import { ListQueryDto } from '../common/list-query.dto.js';
import { normalizarTelefone } from '../common/normalizacao.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresas: EmpresasService,
  ) {}

  async create(empresaId: number, dto: CreateClienteDto) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    await this.validaTelefoneDisponivel(empresaId, dto.telefone);
    return this.gravar(() =>
      this.prisma.cliente.create({ data: { ...dto, empresaId } }),
    );
  }

  async findAll(empresaId: number, query = new ListQueryDto()) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    const { page, pageSize, busca } = query;
    const telefone = normalizarTelefone(busca);
    const where: Prisma.ClienteWhereInput = {
      empresaId,
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca } },
              ...(typeof telefone === 'string' && /^\d+$/.test(telefone)
                ? [{ telefone: { contains: telefone } }]
                : []),
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.cliente.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne({ id, empresaId }: { id: number; empresaId: number }) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    return this.validaCliente(empresaId, id);
  }

  async update({
    id,
    clienteData,
    empresaId,
  }: {
    id: number;
    clienteData: UpdateClienteDto;
    empresaId: number;
  }) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    await this.validaCliente(empresaId, id);
    if (clienteData.telefone !== undefined) {
      await this.validaTelefoneDisponivel(empresaId, clienteData.telefone, id);
    }
    return this.gravar(() =>
      this.prisma.cliente.update({
        data: clienteData,
        where: { id, empresaId },
      }),
    );
  }

  async remove({ id, empresaId }: { id: number; empresaId: number }) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    await this.validaCliente(empresaId, id);
    const atendimentos = await this.prisma.agendamento.count({
      where: { clienteId: id, empresaId },
    });
    if (atendimentos > 0) {
      throw new ConflictException(
        'O cliente possui histórico ou reservas e não pode ser excluído.',
      );
    }
    return this.prisma.cliente.delete({ where: { empresaId, id } });
  }

  private async validaCliente(empresaId: number, id: number) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId },
    });
    if (!cliente)
      throw new NotFoundException('Cliente não encontrado nesta empresa.');
    return cliente;
  }

  private telefoneDuplicado() {
    return new ConflictException({
      code: 'TELEFONE_DUPLICADO',
      message: 'Telefone já cadastrado nesta empresa.',
      fieldErrors: {
        telefone: ['Use o cadastro existente ou informe outro telefone.'],
      },
    });
  }

  private async validaTelefoneDisponivel(
    empresaId: number,
    telefone: string,
    ignorarId?: number,
  ) {
    const existe = await this.prisma.cliente.findUnique({
      where: { empresaId_telefone: { empresaId, telefone } },
    });
    if (existe && existe.id !== ignorarId) throw this.telefoneDuplicado();
  }

  private async gravar<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao();
    } catch (error) {
      // A unicidade do banco também protege cadastros simultâneos.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.telefoneDuplicado();
      }
      throw error;
    }
  }
}
