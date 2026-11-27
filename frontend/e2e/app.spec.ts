import { test, expect, type Page, type Route } from '@playwright/test';
import { resolve } from 'node:path';
import { empresas, agendamento, painel } from '../test/fixtures';

const cors = {
  'access-control-allow-origin': 'http://127.0.0.1:5173',
  'access-control-allow-headers': 'content-type,x-empresa-id',
  'access-control-allow-methods': 'GET,OPTIONS',
};
async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: cors,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function setup(
  page: Page,
  options: {
    fail?: () => boolean;
    delayFirst?: boolean;
    pagination?: boolean;
  } = {},
) {
  await page.clock.install({ time: new Date('2030-01-07T14:00:00Z') });
  await page.route('http://localhost:3000/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const url = new URL(route.request().url());
    const empresaId = Number(route.request().headers()['x-empresa-id']);
    if (url.pathname === '/empresas') {
      await json(route, empresas);
      return;
    }
    if (url.pathname.startsWith('/empresas/')) {
      const empresa = empresas.find(
        (e) => e.id === Number(url.pathname.split('/').at(-1)),
      );
      await json(
        route,
        empresa ?? { message: 'Empresa não encontrada.' },
        empresa ? 200 : 404,
      );
      return;
    }
    if (url.pathname === '/profissionais') {
      await json(route, {
        items:
          empresaId === 1
            ? [
                { id: 7, empresaId: 1, nome: 'Bruno Almeida', ativo: true },
                { id: 8, empresaId: 1, nome: 'Diego Costa', ativo: true },
                { id: 9, empresaId: 1, nome: 'Carlos Mendes', ativo: false },
              ]
            : [{ id: 17, empresaId: 2, nome: 'João Lima', ativo: true }],
        total: empresaId === 1 ? 3 : 1,
        page: 1,
        pageSize: 100,
      });
      return;
    }
    if (url.pathname === '/agendamentos/pendentes') {
      if (options.fail?.()) {
        await json(
          route,
          { message: 'Serviço temporariamente indisponível.' },
          503,
        );
        return;
      }
      const result = painel(empresaId);
      if (empresaId === 2)
        result.items = [
          {
            ...agendamento,
            id: 51,
            empresaId: 2,
            cliente: {
              id: 22,
              nome: 'Cliente da Vila Nova',
              telefone: '11999990022',
            },
            profissional: { id: 17, nome: 'João Lima' },
            atrasado: false,
          },
        ];
      if (options.delayFirst && empresaId === 1) {
        result.items = [
          {
            ...agendamento,
            cliente: {
              ...agendamento.cliente,
              nome: 'DADO ANTIGO DA EMPRESA CENTRO',
            },
          },
        ];
        await new Promise((done) => setTimeout(done, 700));
        await json(route, result).catch(() => undefined);
        return;
      }
      if (options.pagination && empresaId === 1) {
        result.items = Array.from({ length: 12 }, (_, index) => ({
          ...agendamento,
          id: 100 + index,
          cliente: { ...agendamento.cliente, nome: 'Cliente ' + (index + 1) },
        }));
      }
      const selectedProfessional = url.searchParams.get('profissionalId');
      const base = selectedProfessional
        ? result.items.filter(
            (item) => String(item.profissional.id) === selectedProfessional,
          )
        : result.items;
      result.resumo = {
        pendentes: base.length,
        atrasados: base.filter((item) => item.atrasado).length,
        hoje: base.filter((item) => item.inicio.startsWith('2030-01-07'))
          .length,
      };
      const data = url.searchParams.get('data');
      const items = data
        ? base.filter((item) => item.inicio.startsWith(data))
        : base;
      result.total = items.length;
      result.page = Number(url.searchParams.get('page') ?? 1);
      result.items = items.slice((result.page - 1) * 10, result.page * 10);
      await json(route, result);
      return;
    }
    if (url.pathname.startsWith('/agendamentos/')) {
      await json(route, agendamento);
      return;
    }
    await json(route, { message: 'Não encontrado.' }, 404);
  });
}
async function enter(page: Page, company = 'Barbearia Centro') {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Entrar na empresa ' + company })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Painel da recepção' }),
  ).toBeVisible();
}

test('seleção, painel, detalhes, teclado e troca de empresa em desktop', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Qual barbearia/ }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve('../.tmp/parte5-escolha.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Entrar na empresa Barbearia Centro' })
    .click();
  await expect(
    page.getByText('Rafael Oliveira', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve('../.tmp/parte5-painel.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', {
      name: 'Ver detalhes do atendimento de Rafael Oliveira',
    })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Detalhes do atendimento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Corte tradicional')).toBeVisible();
  await expect(dialog.getByText('Barbearia Centro')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Alterar empresa' }).click();
  await expect(
    page.getByRole('heading', { name: /Qual barbearia/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Entrar na empresa Barbearia Vila Nova' })
    .click();
  await expect(
    page.getByText('Cliente da Vila Nova', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Rafael Oliveira', { exact: true }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem('barbearia.empresaId')),
  ).toBe('2');
  expect(errors).toEqual([]);
});

test('troca de empresa descarta uma resposta antiga ainda em andamento', async ({
  page,
}) => {
  await setup(page, { delayFirst: true });
  await enter(page);
  await expect(
    page.getByRole('heading', { name: 'Carregando atendimentos' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Alterar empresa' }).click();
  await page
    .getByRole('button', { name: 'Entrar na empresa Barbearia Vila Nova' })
    .click();
  await expect(
    page.getByText('Cliente da Vila Nova', { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(900);
  await expect(
    page.getByText('DADO ANTIGO DA EMPRESA CENTRO'),
  ).not.toBeVisible();
  await expect(
    page.getByText('Cliente da Vila Nova', { exact: true }),
  ).toBeVisible();
});

test('filtros, paginação, limpar e estado vazio usam o contrato da API', async ({
  page,
}) => {
  await setup(page, { pagination: true });
  await enter(page);
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByText('Cliente 11', { exact: true })).toBeVisible();
  await page.getByLabel('Filtrar por data').fill('2030-01-08');
  await expect(
    page.getByRole('heading', { name: 'Nenhum atendimento com esses filtros' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
  await expect(page.getByText('Cliente 1', { exact: true })).toBeVisible();
  await page.getByLabel('Filtrar por profissional').selectOption('9');
  await expect(
    page.getByRole('heading', { name: 'Nenhum atendimento com esses filtros' }),
  ).toBeVisible();
});

test('falha na API permite tentar novamente mantendo a data', async ({
  page,
}) => {
  let fail = false;
  await setup(page, { fail: () => fail });
  await enter(page);
  await expect(
    page.getByText('Rafael Oliveira', { exact: true }),
  ).toBeVisible();
  fail = true;
  await page.getByLabel('Filtrar por data').fill('2030-01-08');
  await expect(
    page.getByRole('heading', {
      name: 'Não foi possível carregar os atendimentos',
    }),
  ).toBeVisible();
  fail = false;
  await page
    .getByRole('button', { name: 'Tentar novamente', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Nenhum atendimento com esses filtros' }),
  ).toBeVisible();
  await expect(page.getByLabel('Filtrar por data')).toHaveValue('2030-01-08');
});

test('menu e leitura do painel funcionam em tela pequena sem rolagem horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await enter(page);
  await expect(
    page.getByText('Rafael Oliveira', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: resolve('../.tmp/parte5-mobile.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu da recepção' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Alterar empresa' }).click();
  await expect(
    page.getByRole('heading', { name: /Qual barbearia/ }),
  ).toBeVisible();
});

test('entrada direta exige seleção e contexto inválido salvo não abre outra empresa', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/painel');
  await expect(
    page.getByRole('heading', { name: /Qual barbearia/ }),
  ).toBeVisible();
  await page.evaluate(() =>
    sessionStorage.setItem('barbearia.empresaId', '999'),
  );
  await page.goto('/painel');
  await expect(
    page.getByRole('heading', { name: 'Não foi possível abrir esta empresa' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Escolher outra empresa' }).click();
  await expect(
    page.getByRole('heading', { name: /Qual barbearia/ }),
  ).toBeVisible();
});

test('front conversa com NestJS real entre portas, usando apenas persistência de teste', async ({
  page,
}) => {
  const headers: string[] = [];
  await page.route('http://localhost:3000/**', async (route) => {
    if (
      route.request().method() === 'GET' &&
      route.request().url().includes('/agendamentos/pendentes')
    ) {
      headers.push(route.request().headers()['x-empresa-id']);
    }
    await route.continue({
      url: route
        .request()
        .url()
        .replace('http://localhost:3000', 'http://127.0.0.1:43117'),
    });
  });
  await enter(page, 'API Centro');
  await expect(
    page.getByText('Cliente HTTP Centro', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Ver detalhes do atendimento de Cliente HTTP Centro',
    })
    .click();
  await expect(page.getByRole('dialog').getByText('Corte HTTP')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Alterar empresa' }).click();
  await page
    .getByRole('button', { name: 'Entrar na empresa API Vila' })
    .click();
  await expect(
    page.getByText('Cliente HTTP Vila', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Cliente HTTP Centro', { exact: true }),
  ).not.toBeVisible();
  expect(headers).toContain('1');
  expect(headers).toContain('2');
});

test('empresa desativada não mantém atendimentos antigos expostos como atuais', async ({
  page,
}) => {
  await setup(page);
  await enter(page);
  await expect(
    page.getByText('Rafael Oliveira', { exact: true }),
  ).toBeVisible();
  await page.route('http://localhost:3000/agendamentos/pendentes**', (route) =>
    json(
      route,
      {
        code: 'EMPRESA_INATIVA',
        message: 'Empresa inativa. Escolha outra empresa.',
      },
      400,
    ),
  );
  await page.getByRole('button', { name: 'Atualizar painel' }).click();
  await expect(
    page.getByRole('heading', { name: 'Empresa indisponível' }),
  ).toBeVisible();
  await expect(
    page.getByText('Rafael Oliveira', { exact: true }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Escolher outra empresa' }).click();
  await expect(
    page.getByRole('heading', { name: /Qual barbearia/ }),
  ).toBeVisible();
});
