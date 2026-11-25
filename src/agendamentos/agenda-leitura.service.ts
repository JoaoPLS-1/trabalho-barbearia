import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { chaveOperacao } from './chave-operacao.js';
import { DETALHES, respostaAgendamento } from './agendamento-resposta.js';
import { AgendaQueryDto, PendentesQueryDto } from './dto/agenda-query.dto.js';
import { diaNoFuso, intervaloDia } from './expediente.js';

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

  async pendentes(empresaId: number, query: PendentesQueryDto) {
    const empresa = await this.empresas.validarEmpresaAtiva(empresaId);
    const agora = new Date();
    const hoje = intervaloDia(
      diaNoFuso(agora, empresa.fusoHorario),
      empresa.fusoHorario,
    );
    const filtroDia = query.data
      ? intervaloDia(query.data, empresa.fusoHorario)
      : undefined;
    const base: Prisma.AgendamentoWhereInput = {
      empresaId,
      status: 'AGENDADO',
      ...(query.profissionalId ? { profissionalId: query.profissionalId } : {}),
    };
    const where: Prisma.AgendamentoWhereInput = {
      ...base,
      ...(filtroDia
        ? { inicio: { gte: filtroDia.inicio, lt: filtroDia.fim } }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const [total, atrasadosLista, pendentes, atrasados, hojeTotal] =
          await Promise.all([
            tx.agendamento.count({ where }),
            tx.agendamento.count({ where: { ...where, fim: { lt: agora } } }),
            tx.agendamento.count({ where: base }),
            tx.agendamento.count({ where: { ...base, fim: { lt: agora } } }),
            tx.agendamento.count({
              where: { ...base, inicio: { gte: hoje.inicio, lt: hoje.fim } },
            }),
          ]);
        const offset = (query.page - 1) * query.pageSize;
        const takeAtrasados = Math.max(
          0,
          Math.min(query.pageSize, atrasadosLista - offset),
        );
        const orderBy = [{ inicio: 'asc' as const }, { id: 'asc' as const }];
        const antigos = takeAtrasados
          ? await tx.agendamento.findMany({
              where: { ...where, fim: { lt: agora } },
              include: DETALHES,
              orderBy,
              skip: offset,
              take: takeAtrasados,
            })
          : [];
        const proximos =
          query.pageSize > takeAtrasados
            ? await tx.agendamento.findMany({
                where: { ...where, fim: { gte: agora } },
                include: DETALHES,
                orderBy,
                skip: Math.max(0, offset - atrasadosLista),
                take: query.pageSize - takeAtrasados,
              })
            : [];
        return {
          resumo: { pendentes, atrasados, hoje: hojeTotal },
          items: [...antigos, ...proximos].map((item) => ({
            ...respostaAgendamento(item),
            atrasado: item.fim < agora,
          })),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
