import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
async function start(page: Page, path = '/agendamentos/novo') {
  await page.route('http://localhost:3000/**', (route) =>
    route.continue({
      url: route
        .request()
        .url()
        .replace('http://localhost:3000', 'http://127.0.0.1:43117'),
    }),
  );
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('barbearia.empresaId', '2'));
  await page.goto(path);
}
async function prepare(page: Page, day: string) {
  await start(page);
  await page.getByRole('button', { name: 'Cliente HTTP Vila' }).click();
  await page.getByRole('checkbox', { name: /Corte HTTP/ }).check();
  await page
    .getByRole('combobox', { name: 'Profissional', exact: true })
    .selectOption('12');
  await page.getByLabel('Data da reserva').fill(day);
  const slots = page.getByRole('group', { name: 'Horários disponíveis' });
  await expect(slots).toBeVisible();
  await slots.getByRole('button').first().click();
}
test('agenda: filtra dia e profissional e leva o contexto para a nova reserva', async ({
  page,
}) => {
  await start(page, '/agendamentos');
  await expect(
    page.getByRole('heading', { name: 'Agenda', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Data do atendimento').fill('2030-01-07');
  await page
    .getByRole('combobox', { name: 'Profissional da agenda' })
    .selectOption('12');
  await expect(
    page.getByRole('list', { name: 'Atendimentos no histórico' }),
  ).toContainText('Cliente HTTP Vila');
  await page
    .getByRole('link', { name: 'Novo agendamento', exact: true })
    .last()
    .click();
  await expect(page.getByLabel('Data da reserva')).toHaveValue('2030-01-07');
  await expect(
    page.getByRole('combobox', { name: 'Profissional', exact: true }),
  ).toHaveValue('12');
});

test('reserva: cadastro rápido e confirmação real, com preço, duração e header de operação', async ({
  page,
}) => {
  await prepare(page, '2040-01-09');
  await page.getByRole('button', { name: 'Cadastrar cliente aqui' }).click();
  await page.getByLabel('Nome do novo cliente').fill('Cliente reserva rápida');
  await page.getByLabel('Telefone do novo cliente').fill('11977775555');
  await page
    .getByRole('button', { name: 'Salvar e selecionar cliente' })
    .click();
  await expect(
    page.getByText('Cliente selecionado: Cliente reserva rápida'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Revisar reserva' }).click();
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/agendamentos') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().headers()['idempotency-key']).toMatch(
    /^[0-9a-f-]{36}$/,
  );
  expect(await response.json()).toMatchObject({
    empresaId: 2,
    total: '40.10',
    cliente: { nome: 'Cliente reserva rápida' },
    servicos: [{ duracaoContratadaMin: 30, precoCobrado: '40.10' }],
  });
  await expect(
    page.getByRole('heading', { name: 'Reserva confirmada' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem('barbearia.reserva.2')),
  ).toBeNull();
  await page.screenshot({
    path: resolve('../.tmp/parte7-confirmada.png'),
    fullPage: true,
  });
});

test('celular: consulta de horários, formulário e resumo sem rolagem horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, '2040-01-13');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: resolve('../.tmp/parte7-reserva-mobile.png'),
    fullPage: true,
  });
});

test('cancelamento real: confirmação altera a situação e atualiza os detalhes', async ({
  page,
}) => {
  await start(page, '/clientes/22/historico');
  await page
    .getByRole('button', { name: /Ver detalhes/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Cancelar agendamento', exact: true })
    .click();
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/status') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Confirmar ação' }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('dialog')).toContainText('Cancelado');
  await expect(
    page.getByRole('button', { name: 'Cancelar agendamento', exact: true }),
  ).toHaveCount(0);
});


test('agenda: mostra dia sem horários e inicia reserva pelo horário livre escolhido', async ({
  page,
}) => {
  await start(page, '/agendamentos?data=2040-01-15&profissionalId=12');
  await page.getByRole('checkbox', { name: /Corte HTTP/ }).check();
  await expect(
    page.getByRole('heading', { name: 'Nenhum horário disponível' }),
  ).toBeVisible();
  await page.getByLabel('Data do atendimento').fill('2040-01-16');
  const slots = page.getByRole('group', { name: 'Horários disponíveis' });
  await expect(slots).toBeVisible();
  await slots.getByRole('button').first().click();
  await expect(
    page.getByRole('heading', { name: 'Novo agendamento' }),
  ).toBeVisible();
  await expect(page.getByLabel('Data da reserva')).toHaveValue('2040-01-16');
  await expect(
    page.getByRole('checkbox', { name: /Corte HTTP/ }),
  ).toBeChecked();
  await expect(
    page
      .getByRole('group', { name: 'Horários disponíveis' })
      .getByRole('button')
      .first(),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('cadastro rápido: telefone duplicado preserva os campos e busca o cadastro existente', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Cadastrar cliente aqui' }).click();
  await page.getByLabel('Nome do novo cliente').fill('Nome informado');
  await page.getByLabel('Telefone do novo cliente').fill('11999990001');
  await page
    .getByRole('button', { name: 'Salvar e selecionar cliente' })
    .click();
  await expect(page.getByRole('alert')).toContainText('Telefone já cadastrado');
  await expect(page.getByLabel('Nome do novo cliente')).toHaveValue(
    'Nome informado',
  );
  await expect(page.getByRole('searchbox')).toHaveValue('11999990001');
  await page.getByRole('button', { name: 'Cliente HTTP Vila' }).click();
  await expect(
    page.getByText('Cliente selecionado: Cliente HTTP Vila'),
  ).toBeVisible();
});
