import {
  Prisma,
  type PrismaClient,
  type Servico,
  type Profissional,
} from '../generated/prisma/client.js';
import { seedPlan } from './seed-data.js';

async function preserve<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
  belongs: (item: T) => boolean,
  kind: string,
): Promise<T> {
  const current = await find();
  if (current) {
    if (!belongs(current))
      throw new Error(
        'ID reservado de demonstração já utilizado por outro registro: ' +
          kind +
          '. Nenhum registro será sobrescrito.',
      );
    return current;
  }
  return create();
}
/** Somente inserções; nunca atualiza ou apaga cadastros e atendimentos existentes. */
export async function seedDemo(db: PrismaClient, now = new Date()) {
  const plan = seedPlan(now);
  return db.$transaction(
    async (tx) => {
      let inserted = 0,
        reused = 0,
        skipped = 0;
      for (const group of plan) {
        const storedCompany = await preserve(
          () => tx.empresa.findUnique({ where: { id: group.company.id } }),
          () => tx.empresa.create({ data: group.company }),
          (item) => item.cnpj === group.company.cnpj,
          'empresa',
        );
        await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${storedCompany.id} FOR UPDATE`;
        const company = await tx.empresa.findUniqueOrThrow({
          where: { id: storedCompany.id },
        });
        for (const data of group.clientes)
          await preserve(
            () => tx.cliente.findUnique({ where: { id: data.id } }),
            () => tx.cliente.create({ data }),
            (item) => item.empresaId === company.id,
            'cliente',
          );
        const professionals: Profissional[] = [];
        for (const data of group.profissionais)
          professionals.push(
            await preserve(
              () => tx.profissional.findUnique({ where: { id: data.id } }),
              () => tx.profissional.create({ data }),
              (item) => item.empresaId === company.id,
              'profissional',
            ),
          );
        const services: Servico[] = [];
        for (const data of group.servicos)
          services.push(
            await preserve(
              () => tx.servico.findUnique({ where: { id: data.id } }),
              () => tx.servico.create({ data }),
              (item) => item.empresaId === company.id,
              'serviço',
            ),
          );
        const unchanged =
          company.ativa &&
          company.fusoHorario === group.company.fusoHorario &&
          company.aberturaMin === 540 &&
          company.fechamentoMin === 1140 &&
          JSON.stringify(company.diasFuncionamento) === '[1,2,3,4,5,6,7]';
        for (const booking of group.agendamentos) {
          const existing = await tx.agendamento.findUnique({
            where: {
              empresaId_chaveOperacao: {
                empresaId: company.id,
                chaveOperacao: booking.chaveOperacao,
              },
            },
          });
          if (existing) {
            reused++;
            continue;
          }
          const pending = booking.status === 'AGENDADO';
          const selected = booking.servicos.map((item) =>
            services.find((service) => service.id === item.servicoId)!,
          );
          const professional = professionals.find(
            (item) => item.id === booking.profissionalId,
          )!;
          // Preservar o catálogo editado pelo usuário. Novos cenários dependem da base original.
          const unchangedServices = selected.every((service) => {
            const original = group.servicos.find(
              (item) => item.id === service.id,
            )!;
            return (
              service.nome === original.nome &&
              service.preco.toFixed(2) === original.preco &&
              service.duracaoMin === original.duracaoMin &&
              (!pending || service.ativo)
            );
          });
          if (
            !unchanged ||
            !unchangedServices ||
            (pending && !professional.ativo)
          ) {
            skipped++;
            continue;
          }
          if (
            pending &&
            (await tx.agendamento.findFirst({
              where: {
                empresaId: company.id,
                profissionalId: booking.profissionalId,
                status: 'AGENDADO',
                inicio: { lt: booking.fim },
                fim: { gt: booking.inicio },
              },
            }))
          ) {
            skipped++;
            continue;
          }
          const { servicos, ...data } = booking;
          await tx.agendamento.create({
            data: {
              ...data,
              servicos: {
                create: servicos.map(
                  (
                    item,
                  ): Prisma.AgendamentoServicoUncheckedCreateWithoutAgendamentoInput => ({
                    servicoId: item.servicoId,
                    nomeContratado: item.nomeContratado,
                    duracaoContratadaMin: item.duracaoContratadaMin,
                    precoCobrado: new Prisma.Decimal(item.precoCobrado),
                  }),
                ),
              },
            },
          });
          inserted++;
        }
      }
      return {
        companies: plan.map((group) => ({
          id: group.company.id,
          nome: group.company.nome,
        })),
        inserted,
        reused,
        skipped,
      };
    },
    {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}
