import { test, expect, type Page } from '@playwright/test';
import { empresas, agendamento, painel } from '../test/fixtures';
async function setup(
  page: Page,
  options: { future?: boolean; uncertain?: boolean } = {},
) {
  await page.clock.install({
    time: new Date(
      options.future ? '2029-01-01T10:00:00Z' : '2031-01-01T10:00:00Z',
    ),
  });
  let item = { ...agendamento },
    count = 0;
  const headers = {
    'access-control-allow-origin': 'http://127.0.0.1:5173',
    'access-control-allow-headers': 'content-type,x-empresa-id',
    'access-control-allow-methods': 'GET,PATCH,OPTIONS',
  };
  await page.route('http://localhost:3000/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path === '/agendamentos/41/status') {
      count++;
      item = { ...item, status: route.request().postDataJSON().status };
      if (options.uncertain && count === 1) {
        await route.abort('failed');
        return;
      }
    }
    let body: unknown;
    if (path === '/empresas') body = empresas;
    else if (path === '/empresas/1') body = empresas[0];
    else if (path === '/profissionais')
      body = { items: [], total: 0, page: 1, pageSize: 100 };
    else if (path === '/agendamentos/pendentes')
      body =
        item.status === 'AGENDADO'
          ? painel()
          : {
              ...painel(),
              items: [],
              total: 0,
              resumo: { pendentes: 0, hoje: 0, atrasados: 0 },
            };
    else body = item;
    await route.fulfill({
      headers,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('barbearia.empresaId', '1'));
  await page.goto('/painel');
  await page
    .getByRole('button', { name: /Ver detalhes/ })
    .first()
    .click();
  return () => count;
}
for (const [label, result] of [
  ['Concluir atendimento', 'Concluído'],
  ['Marcar falta', 'Faltou'],
] as const) {
  test(
    'finalização: ' + label + ' confirma e retira a pendência',
    async ({ page }) => {
      await setup(page);
      await page.getByRole('button', { name: label, exact: true }).click();
      await page
        .getByRole('button', { name: 'Confirmar ação', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toContainText(result);
      await page
        .getByRole('button', { name: 'Fechar detalhes do atendimento' })
        .click();
      await expect(page.getByLabel('Indicadores de atendimento')).toContainText(
        '0',
      );
    },
  );
}
test('finalização incerta: consulta encontra o estado final sem enviar outra alteração', async ({
  page,
}) => {
  const count = await setup(page, { uncertain: true });
  await page
    .getByRole('button', { name: 'Concluir atendimento', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirmar ação', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Repetir a mesma ação' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Consultar situação' }).click();
  await expect(page.getByRole('dialog')).toContainText('Concluído');
  expect(count()).toBe(1);
});
test('início futuro: permite cancelar e bloqueia conclusão e falta', async ({
  page,
}) => {
  await setup(page, { future: true });
  await expect(
    page.getByRole('button', { name: 'Concluir atendimento', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Marcar falta', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Cancelar agendamento', exact: true }),
  ).toBeEnabled();
});
