import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

async function start(page: Page, path: string) {
  await page.route('http://localhost:3000/**', async (route) => {
    await route.continue({
      url: route
        .request()
        .url()
        .replace('http://localhost:3000', 'http://127.0.0.1:43117'),
    });
  });
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('barbearia.empresaId', '1'));
  await page.goto(path);
}
test('cliente: cria, busca, edita e apresenta duplicidade da API junto ao telefone', async ({
  page,
}) => {
  await start(page, '/clientes/novo');
  await page.getByLabel('Nome', { exact: false }).fill('Ana Navegador');
  await page.getByLabel('Telefone com DDD').fill('(11) 98888-4321');
  const created = page.waitForResponse(
    (r) => r.url().includes('/clientes') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  expect((await created).status()).toBe(201);
  await expect(page.locator('.save-notice')).toHaveText(
    'Cadastro salvo com sucesso.',
  );
  await page.getByRole('searchbox').fill('Ana Navegador');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ana Navegador' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Editar Ana Navegador' }).click();
  await page.getByLabel('Nome', { exact: false }).fill('Ana Editada');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ana Editada' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Novo cliente', exact: true })
    .last()
    .click();
  await page.getByLabel('Nome', { exact: false }).fill('Outro cliente');
  await page.getByLabel('Telefone com DDD').fill('11988884321');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(
    page.getByText('Use o cadastro existente ou informe outro telefone.'),
  ).toBeVisible();
  await expect(page.getByLabel('Telefone com DDD')).toBeFocused();
  await expect(page.getByLabel('Nome', { exact: false })).toHaveValue(
    'Outro cliente',
  );
});

test('formulário: protege voltar e trocar de empresa; permite descartar', async ({
  page,
}) => {
  await start(page, '/clientes');
  await page
    .getByRole('link', { name: 'Novo cliente', exact: true })
    .last()
    .click();
  await page.getByLabel('Nome', { exact: false }).fill('Rascunho protegido');
  await page.goBack();
  await expect(
    page.getByRole('dialog', { name: 'Descartar alterações?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.getByLabel('Nome', { exact: false })).toHaveValue(
    'Rascunho protegido',
  );
  await page
    .getByRole('button', { name: 'Alterar empresa', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  expect(
    await page.evaluate(() => sessionStorage.getItem('barbearia.empresaId')),
  ).toBe('1');

  await page
    .getByRole('button', { name: 'Alterar empresa', exact: true })
    .click();
  await page.getByRole('button', { name: 'Descartar e sair' }).click();
  await expect(
    page.getByRole('heading', { name: /Qual barbearia/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem('barbearia.empresaId')),
  ).toBeNull();
});

test('profissional: cadastra, desativa com aviso de reservas e filtra inativos', async ({
  page,
}) => {
  await start(page, '/profissionais/novo');
  await page.getByLabel('Nome', { exact: false }).fill('Profissional novo');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(
    page.getByRole('heading', { name: 'Profissional novo', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Editar Profissional API 1', exact: true })
    .click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(
    page.getByText(/1 atendimento\(s\) ainda agendado/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar desativação' }).click();
  await page
    .getByRole('combobox', { name: 'Situação', exact: true })
    .selectOption('false');
  await expect(
    page.getByRole('heading', { name: 'Profissional API 1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Profissional novo', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Inativo', { exact: true })).toBeVisible();
});

test('serviço: valida duração e preço, grava centavos, edita e preserva o contratado', async ({
  page,
}) => {
  await start(page, '/servicos/novo');
  await page.getByLabel('Nome', { exact: false }).fill('Barba desenhada');
  await page.getByLabel('Preço (R$)').fill('1,001');
  await page.getByLabel('Duração (minutos)').fill('4');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByText(/Informe um preço entre/)).toBeVisible();
  await expect(page.getByText(/Informe uma duração inteira/)).toBeVisible();
  await page.getByLabel('Preço (R$)').fill('25,09');
  await page.getByLabel('Duração (minutos)').fill('25');
  const created = page.waitForResponse(
    (r) => r.url().includes('/servicos') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  expect(await (await created).json()).toMatchObject({
    preco: '25.09',
    duracaoMin: 25,
  });
  await expect(page.getByText('R$ 25,09', { exact: true })).toBeVisible();
  await page
    .getByRole('link', { name: 'Editar Corte HTTP', exact: true })
    .click();
  await page.getByLabel('Nome', { exact: false }).fill('Corte atualizado');
  await page.getByLabel('Preço (R$)').fill('75,99');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(
    page.getByRole('heading', { name: 'Corte atualizado', exact: true }),
  ).toBeVisible();
});

test('cadastros: lista vazia, filtros, paginação e erro de leitura recuperável', async ({
  page,
}) => {
  await start(page, '/clientes?busca=SemResultado');
  await expect(
    page.getByRole('heading', { name: 'Nenhum resultado para estes filtros' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.getByRole('list', { name: 'Clientes' })).toBeVisible();
  await page.goto('/clientes?page=2');
  await page.getByRole('button', { name: 'Voltar à primeira página' }).click();
  await expect(page.getByRole('list', { name: 'Clientes' })).toBeVisible();
  let fail = true;
  await page.route('http://localhost:3000/clientes?**', async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        headers: { 'access-control-allow-origin': 'http://127.0.0.1:5173' },
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha temporária' }),
      });
    else
      await route.continue({
        url: route
          .request()
          .url()
          .replace('http://localhost:3000', 'http://127.0.0.1:43117'),
      });
  });
  await page.getByRole('searchbox').fill('Centro');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Não foi possível carregar os cadastros',
    }),
  ).toBeVisible();
  expect(await page.getByRole('searchbox').inputValue()).toBe('Centro');
  fail = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cliente HTTP Centro', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve('../.tmp/parte6-clientes-desktop.png'),
    fullPage: true,
  });
});


test('formulário: recarregar pede confirmação e cancelar preserva o texto', async ({
  page,
}) => {
  await start(page, '/clientes/novo');
  await page.getByLabel('Nome', { exact: false }).click();
  await page
    .getByLabel('Nome', { exact: false })
    .fill('Rascunho ao recarregar');
  const dialog = page.waitForEvent('dialog');
  const reload = page
    .reload({ timeout: 2000, waitUntil: 'commit' })
    .catch(() => null);
  const unload = await dialog;
  expect(unload.type()).toBe('beforeunload');
  await unload.dismiss();
  await reload;
  expect(await page.getByLabel('Nome', { exact: false }).inputValue()).toBe(
    'Rascunho ao recarregar',
  );
});
