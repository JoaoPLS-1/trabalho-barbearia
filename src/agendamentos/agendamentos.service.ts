import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { withEmpresaLock } from '../common/empresa-transaction.js';
import { chaveOperacao } from './chave-operacao.js';
import { DETALHES, respostaAgendamento } from './agendamento-resposta.js';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto.js';
import { DisponibilidadeQueryDto } from './dto/agenda-query.dto.js';
import { STATUS_FINAIS, UpdateStatusDto } from './dto/update-status.dto.js';
import {
  diaNoFuso,
  horariosDisponiveis,
  instante,
  intervaloDia,
} from './expediente.js';

@Injectable()
export class AgendamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresas: EmpresasService,
  ) {}

  private async profissional(
    db: Prisma.TransactionClient,
    empresaId: number,
    id: number,
  ) {
    const item = await db.profissional.findFirst({
      where: { empresaId, id, ativo: true },
    });
    if (!item)
      throw new NotFoundException(
        'Profissional não encontrado ou inativo nesta empresa.',
      );
    return item;
  }

  private async servicos(
    db: Prisma.TransactionClient,
    empresaId: number,
    ids: number[],
  ) {
    const items = await db.servico.findMany({
      where: { empresaId, ativo: true, id: { in: ids } },
      orderBy: { id: 'asc' },
    });
    if (
      !ids.length ||
      new Set(ids).size !== ids.length ||
      items.length !== ids.length
    ) {
      throw new NotFoundException(
        'Serviço não encontrado ou inativo nesta empresa.',
      );
    }
    return items;
  }

  async disponibilidade(empresaId: number, dto: DisponibilidadeQueryDto) {
    const empresa = await this.empresas.validarEmpresaAtiva(empresaId);
    await this.profissional(this.prisma, empresaId, dto.profissionalId);
    const servicos = await this.servicos(
      this.prisma,
      empresaId,
      dto.servicoIds,
    );
    const dia = intervaloDia(dto.data, empresa.fusoHorario);
    const ocupados = await this.prisma.agendamento.findMany({
      where: {
        empresaId,
        profissionalId: dto.profissionalId,
        status: 'AGENDADO',
        inicio: { lt: dia.fim },
        fim: { gt: dia.inicio },
      },
      select: { inicio: true, fim: true },
    });
    const duracaoMin = servicos.reduce((sum, item) => sum + item.duracaoMin, 0);
    return {
      data: dto.data,
      fusoHorario: empresa.fusoHorario,
      profissionalId: dto.profissionalId,
      duracaoMin,
      total: servicos
        .reduce((sum, item) => sum.plus(item.preco), new Prisma.Decimal(0))
        .toFixed(2),
      horarios: horariosDisponiveis(
        empresa,
        dto.data,
        duracaoMin,
        new Date(),
        ocupados,
      ).map((item) => ({
        inicio: item.inicio.toISOString(),
        fim: item.fim.toISOString(),
      })),
    };
  }

  async create(
    empresaId: number,
    dto: CreateAgendamentoDto,
    operacao: unknown,
  ) {
    const chave = chaveOperacao(operacao);
    const inicio = instante(dto.inicio);
    const hashPedido = createHash('sha256')
      .update(
        JSON.stringify({
          clienteId: dto.clienteId,
          profissionalId: dto.profissionalId,
          servicoIds: [...dto.servicoIds].sort((a, b) => a - b),
          inicio: inicio.toISOString(),
        }),
      )
      .digest('hex');

    return withEmpresaLock(this.prisma, empresaId, async (tx, empresa) => {
      const existente = await tx.agendamento.findUnique({
        where: { empresaId_chaveOperacao: { empresaId, chaveOperacao: chave } },
        include: DETALHES,
      });
      if (existente) {
        if (existente.hashPedido !== hashPedido) {
          throw new ConflictException({
            code: 'OPERACAO_DIVERGENTE',
            message:
              'Esta chave já foi usada para outra reserva. Confira a operação anterior.',
          });
        }
        return { item: respostaAgendamento(existente), reutilizado: true };
      }

      await tx.$queryRaw`SELECT id FROM profissionais WHERE id = ${dto.profissionalId} AND empresaId = ${empresaId} FOR UPDATE`;
      await this.profissional(tx, empresaId, dto.profissionalId);
      const cliente = await tx.cliente.findFirst({
        where: { id: dto.clienteId, empresaId },
      });
      if (!cliente)
        throw new NotFoundException('Cliente não encontrado nesta empresa.');
      const servicos = await this.servicos(tx, empresaId, dto.servicoIds);
      const duracaoMin = servicos.reduce(
        (sum, item) => sum + item.duracaoMin,
        0,
      );
      const agora = new Date();
      if (inicio <= agora)
        throw new BadRequestException(
          'Não é possível agendar no passado ou no instante atual.',
        );
      const data = diaNoFuso(inicio, empresa.fusoHorario);
      const slot = horariosDisponiveis(empresa, data, duracaoMin, agora).find(
        (item) => item.inicio.getTime() === inicio.getTime(),
      );
      if (!slot)
        throw new BadRequestException({
          code: 'FORA_EXPEDIENTE',
          message:
            'Escolha um horário de 15 em 15 minutos que caiba integralmente no expediente.',
        });

      const conflito = await tx.agendamento.findFirst({
        where: {
          empresaId,
          profissionalId: dto.profissionalId,
          status: 'AGENDADO',
          inicio: { lt: slot.fim },
          fim: { gt: inicio },
        },
      });
      if (conflito) {
        throw new ConflictException({
          code: 'HORARIO_OCUPADO',
          message:
            'Este horário acabou de ser ocupado. Consulte a disponibilidade e escolha outro.',
        });
      }

      const reserva = await tx.agendamento.create({
        data: {
          empresaId,
          clienteId: dto.clienteId,
          profissionalId: dto.profissionalId,
          inicio,
          fim: slot.fim,
          chaveOperacao: chave,
          hashPedido,
          servicos: {
            create: servicos.map((item) => ({
              servicoId: item.id,
              nomeContratado: item.nome,
              duracaoContratadaMin: item.duracaoMin,
              precoCobrado: item.preco,
            })),
          },
        },
        include: DETALHES,
      });
      return { item: respostaAgendamento(reserva), reutilizado: false };
    });
  }

  async atualizarStatus(empresaId: number, id: number, dto: UpdateStatusDto) {
    if (!STATUS_FINAIS.includes(dto.status))
      throw new BadRequestException('Estado final inválido.');
    return withEmpresaLock(this.prisma, empresaId, async (tx) => {
      const item = await tx.agendamento.findFirst({
        where: { id, empresaId },
        include: DETALHES,
      });
      if (!item)
        throw new NotFoundException(
          'Agendamento não encontrado nesta empresa.',
        );
      if (item.status === dto.status) return respostaAgendamento(item);
      if (item.status !== 'AGENDADO') {
        throw new ConflictException({
          code: 'ESTADO_INVALIDO',
          message:
            'Este atendimento já foi finalizado e não pode mudar de estado.',
        });
      }
      if (dto.status !== 'CANCELADO' && item.inicio > new Date()) {
        throw new ConflictException({
          code: 'ESTADO_INVALIDO',
          message: 'Aguarde o início previsto para concluir ou marcar falta.',
        });
      }
      await tx.$queryRaw`SELECT id FROM profissionais WHERE id = ${item.profissionalId} AND empresaId = ${empresaId} FOR UPDATE`;
      const result = await tx.agendamento.updateMany({
        where: { id, empresaId, status: 'AGENDADO' },
        data: { status: dto.status },
      });
      if (result.count !== 1)
        throw new ConflictException({
          code: 'ESTADO_INVALIDO',
          message: 'O atendimento foi alterado. Atualize a consulta.',
        });
      return respostaAgendamento({ ...item, status: dto.status });
    });
  }
}
