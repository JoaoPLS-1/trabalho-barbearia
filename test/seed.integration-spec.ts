import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedDemo } from '../src/demo/seed.js';
import { DEMO_COMPANIES } from '../src/demo/seed-data.js';

describe('Seed em MySQL exclusivo de testes', () => {
  let db: PrismaService;
  let claimed = false;
  const ids = DEMO_COMPANIES.map((c) => c.id);
  const outsiders: number[] = [];
  const now = new Date('2026-11-26T15:00:00Z');
  beforeEach(async () => {
    db = new PrismaService();
    await db.$connect();
    claimed = false;
    outsiders.length = 0;
    // Não reivindicar nem limpar uma demonstração existente no banco informado.
    expect(
      await db.empresa.count({ where: { id: { in: ids } } }),
      'O banco exclusivo deve estar sem o namespace de demonstração antes desta suíte.',
    ).toBe(0);
    const where = { id: { gte: 10001, lte: 10104 } };
    const counts = await Promise.all([
      db.cliente.count({ where }),
      db.profissional.count({ where }),
      db.servico.count({ where }),
    ]);
    for (const count of counts)
      expect(
        count,
        'IDs reservados já utilizados; nenhum registro será removido.',
      ).toBe(0);
    claimed = true;
  });
  afterEach(async () => {
    try {
      if (claimed) {
        const where = { empresaId: { in: [...ids, ...outsiders] } };
        await db.agendamentoServico.deleteMany({ where });
        await db.agendamento.deleteMany({ where });
        await db.servico.deleteMany({ where });
        await db.profissional.deleteMany({ where });
        await db.cliente.deleteMany({ where });
        await db.empresa.deleteMany({
          where: { id: { in: [...ids, ...outsiders] } },
        });
      }
    } finally {
      await db?.$disconnect();
    }
  });
  it('repete no mesmo dia sem duplicar e preserva alterações de cadastros e finalizações', async () => {
    const first = await seedDemo(db, now);
    expect(first.inserted).toBe(12);
    await db.cliente.update({
      where: { id: 10001 },
      data: { nome: 'Editado pela recepção' },
    });
    await db.servico.update({ where: { id: 10001 }, data: { preco: '99.90' } });
    const pending = await db.agendamento.findFirstOrThrow({
      where: { empresaId: 10001, status: 'AGENDADO' },
    });
    await db.agendamento.update({
      where: { id: pending.id },
      data: { status: 'CANCELADO' },
    });
    const second = await seedDemo(db, now);
    expect(second).toMatchObject({ inserted: 0, reused: 12 });
    expect(
      await db.agendamento.count({ where: { empresaId: { in: ids } } }),
    ).toBe(12);
    expect(
      (await db.cliente.findUniqueOrThrow({ where: { id: 10001 } })).nome,
    ).toBe('Editado pela recepção');
    expect(
      (
        await db.servico.findUniqueOrThrow({ where: { id: 10001 } })
      ).preco.toFixed(2),
    ).toBe('99.90');
    expect(
      (await db.agendamento.findUniqueOrThrow({ where: { id: pending.id } }))
        .status,
    ).toBe('CANCELADO');
  });
  it('acrescenta cenários no dia seguinte sem alterar as reservas anteriores', async () => {
    await seedDemo(db, now);
    const before = await db.agendamento.findMany({
      where: { empresaId: { in: ids } },
      orderBy: { id: 'asc' },
    });
    const next = await seedDemo(db, new Date('2026-11-27T15:00:00Z'));
    expect(next.inserted).toBe(12);
    expect(
      await db.agendamento.findMany({
        where: { id: { in: before.map((item) => item.id) } },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
  });
  it('colisão de cadastro de outra empresa aborta sem sobrescrever nem deixar inserções parciais', async () => {
    const outsider = await db.empresa.create({
      data: {
        id: 20000,
        nome: 'Registro fora do seed',
        cnpj: 'SEEDCOLLISION0',
      },
    });
    outsiders.push(outsider.id);
    await db.cliente.create({
      data: {
        id: 10001,
        empresaId: outsider.id,
        nome: 'Preservar',
        telefone: '11999998888',
      },
    });
    await expect(seedDemo(db, now)).rejects.toThrow('ID reservado');
    expect(await db.empresa.count({ where: { id: { in: ids } } })).toBe(0);
    expect(
      (await db.cliente.findUniqueOrThrow({ where: { id: 10001 } })).nome,
    ).toBe('Preservar');
  });
});
