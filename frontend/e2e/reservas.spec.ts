import { test, expect, type Page } from '@playwright/test';
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

test('agenda: consulta horários por dia, profissional e serviços',async({page})=>{
  await start(page,'/agendamentos?data=2040-01-15&profissionalId=12');
  await page.getByRole('checkbox',{name:/Corte HTTP/}).check();
  await expect(page.getByRole('heading',{name:'Nenhum horário disponível'})).toBeVisible();
  await page.getByLabel('Data do atendimento').fill('2040-01-16');
  await expect(page.getByRole('group',{name:'Horários disponíveis'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Profissional da agenda'})).toHaveValue('12');
});
