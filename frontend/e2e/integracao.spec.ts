import { test, expect, type Page } from '@playwright/test';
async function start(page: Page, path: string) {
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
async function fill(page: Page, day: string) {
  await page.getByRole('button', { name: 'Cliente HTTP Vila' }).click();
  await page.getByLabel('Data da reserva').fill(day);
  await page.getByRole('checkbox', { name: /Corte HTTP/ }).check();
  await page
    .getByRole('combobox', { name: 'Profissional', exact: true })
    .selectOption('12');
}
test('fluxo integrado: reserva, consulta, cancelamento e troca de empresa isolam o atendimento', async ({
  page,
}) => {
  await start(page, '/agendamentos/novo');
  await fill(page, '2040-02-06');
  await page
    .getByRole('group', { name: 'Horários disponíveis' })
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('button', { name: 'Revisar reserva' }).click();
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(
    page.getByRole('heading', { name: 'Reserva confirmada' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver agenda', exact: true }).click();
  await page.getByLabel('Data do atendimento').fill('2040-02-06');
  await page.getByRole('button', { name: /Ver detalhes/ }).click();
  await page
    .getByRole('button', { name: 'Cancelar agendamento', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar ação' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cancelado');
  await page
    .getByRole('button', { name: 'Fechar detalhes do atendimento' })
    .click();
  await expect(
    page.getByRole('list', { name: 'Atendimentos no histórico' }),
  ).toContainText('Cancelado');
  await page
    .getByRole('button', { name: 'Alterar empresa', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Entrar na empresa API Centro' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Painel da recepção' }),
  ).toBeVisible();
  await page.goto('/agendamentos?data=2040-02-06');
  await expect(
    page.getByRole('heading', { name: 'Nenhum atendimento encontrado' }),
  ).toBeVisible();
  await expect(
    page.getByText('Cliente HTTP Vila', { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem('barbearia.empresaId')),
  ).toBe('1');
});
test('troca de empresa descarta disponibilidade atrasada e o formulário anterior', async ({
  page,
}) => {
  await start(page, '/agendamentos/novo');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const arrived = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route(
    'http://localhost:3000/agendamentos/disponibilidade?**',
    async (route) => {
      if (route.request().method() === 'OPTIONS')
        return route.continue({
          url: route
            .request()
            .url()
            .replace('http://localhost:3000', 'http://127.0.0.1:43117'),
        });
      const response = await route.fetch({
        url: route
          .request()
          .url()
          .replace('http://localhost:3000', 'http://127.0.0.1:43117'),
      });
      requested();
      await held;
      await route.fulfill({ response }).catch(() => {});
    },
  );
  await fill(page, '2040-02-07');
  await arrived;
  await page
    .getByRole('button', { name: 'Alterar empresa', exact: true })
    .click();
  await page.getByRole('button', { name: 'Descartar e sair' }).click();
  await page
    .getByRole('button', { name: 'Entrar na empresa API Centro' })
    .click();
  release();
  await expect(
    page.getByRole('heading', { name: 'Painel da recepção' }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Horários disponíveis' }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Cliente selecionado: Cliente HTTP Vila'),
  ).toHaveCount(0);
});
test('reserva com confirmação pendente bloqueia a troca de contexto até consultar e resolver', async ({
  page,
}) => {
  await start(page, '/agendamentos/novo');
  await fill(page, '2040-02-08');
  let first = true;
  await page.route('http://localhost:3000/agendamentos', async (route) => {
    if (route.request().method() === 'POST' && first) {
      first = false;
      await route.abort('failed');
      return;
    }
    await route.continue({
      url: route
        .request()
        .url()
        .replace('http://localhost:3000', 'http://127.0.0.1:43117'),
    });
  });
  await page
    .getByRole('group', { name: 'Horários disponíveis' })
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('button', { name: 'Revisar reserva' }).click();
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(
    page.getByRole('heading', { name: 'Conferir confirmação da reserva' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Alterar empresa', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Confirmação pendente' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descartar e sair' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem('barbearia.empresaId')),
  ).toBe('2');
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await page.getByRole('button', { name: 'Consultar resultado' }).click();
  await page.getByRole('button', { name: 'Repetir o mesmo pedido' }).click();
  await expect(
    page.getByRole('heading', { name: 'Reserva confirmada' }),
  ).toBeVisible();
});
