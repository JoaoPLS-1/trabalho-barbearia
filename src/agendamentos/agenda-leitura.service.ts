import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { chaveOperacao } from './chave-operacao.js';
import { DETALHES, respostaAgendamento } from './agendamento-resposta.js';
import { AgendaQueryDto } from './dto/agenda-query.dto.js';
import { intervaloDia } from './expediente.js';

@Injectable()
export class AgendaLeituraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresas: EmpresasService,
  ) {}

  async findAll(empresaId: number, query: AgendaQueryDto) {
    const empresa = await this.empresas.validarEmpresaAtiva(empresaId);
    const dia = query.data
      ? intervaloDia(query.data, empresa.fusoHorario)
      : undefined;
    const where: Prisma.AgendamentoWhereInput = {
      empresaId,
      ...(query.profissionalId ? { profissionalId: query.profissionalId } : {}),
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dia ? { inicio: { gte: dia.inicio, lt: dia.fim } } : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const [items, total] = await Promise.all([
          tx.agendamento.findMany({
            where,
            include: DETALHES,
            orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.agendamento.count({ where }),
        ]);
        return {
          items: items.map(respostaAgendamento),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async findOne(empresaId: number, id: number) {
    await this.empresas.validarEmpresaAtiva(empresaId);
    const item = await this.prisma.agendamento.findFirst({
      where: { id, empresaId },
      include: DETALHES,
    });
    if (!item)
      throw new NotFoundException('Agendamento não encontrado nesta empresa.');
    return respostaAgendamento(item);
  }

  async operacao(empresaId: number, operacao: string) {
    const chave = chaveOperacao(operacao);
    await this.empresas.validarEmpresaAtiva(empresaId);
    const item = await this.prisma.agendamento.findUnique({
      where: { empresaId_chaveOperacao: { empresaId, chaveOperacao: chave } },
      include: DETALHES,
    });
    if (!item)
      throw new NotFoundException(
        'Confirmação ainda não encontrada. Consulte novamente ou reenvie o mesmo pedido com a mesma chave.',
      );
    return respostaAgendamento(item);
  }

}
