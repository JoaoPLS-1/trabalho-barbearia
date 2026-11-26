# Sistema de Barbearia

Sistema para a recepção operar clientes, profissionais, serviços e agendamentos de várias empresas, sem login. A entrada exige escolher a empresa e abre um painel de atendimentos pendentes.

## Estado do desenvolvimento

A API da aula está em preparação para integração com o front-end. Os cadastros possuem busca paginada, telefone normalizado, preço decimal e desativação com histórico preservado. A agenda da API oferece disponibilidade, reserva com chave de operação, finalização e painel de pendências. A recepção web já oferece seleção e troca de empresa, dashboard e detalhes. Os cadastros web, o formulário de agendamento e os dados de demonstração serão entregues nas próximas partes.

## Arquitetura e decisões

- API NestJS e TypeScript com Prisma e MySQL; front-end em React, TypeScript e Vite.
- Empresa corrente enviada pelo header x-empresa-id. A API valida o contexto e restringe as operações à empresa.
- Profissionais e serviços usam desativação para preservar histórico.
- A API copia os dados contratados e implementa a confirmação transacional de reservas; a execução com MySQL real continua pendente.
- Agendamentos pendentes serão resolvidos pela recepção como concluídos, cancelados ou faltas.
- Pagamentos, estoque e integração automática com WhatsApp ficam fora da primeira entrega.

O planejamento detalhado fica na pasta local docs/, ignorada pelo Git. As instruções necessárias para executar o produto permanecem neste README.

## Requisitos

- Node.js 22.22.3 (versão registrada em .nvmrc), ou outra versão compatível com engines no package.json.
- npm 10 ou superior; lockfile mantido com npm 11.21.1.
- MySQL 8.4 para executar a API e os testes de integração.

As ferramentas Nest/Angular instaladas exigem uma revisão mais recente do Node 22. Não usar a versão 22.20 para uma instalação suportada. O compilador SWC nos testes preserva os metadados dos decorators exigidos pelo Nest, conforme a [documentação do NestJS](https://docs.nestjs.com/recipes/swc).

## Executar a API

1. Instalar dependências:

   ```bash
   npm ci
   ```

2. Copiar .env.example para .env e preencher DATABASE_URL com a conexão de desenvolvimento. Não versionar esse arquivo.
3. Criar o banco e aplicar as migrações existentes com um usuário autorizado a fazê-lo:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. Iniciar a API:

   ```bash
   npm run start:dev
   ```

Porta padrão: 3000. O front usará 5173. CORS_ORIGINS aceita origens HTTP separadas por vírgula, sem caminho ou barra final; os padrões permitem localhost e 127.0.0.1 na porta 5173. Essa configuração permite comunicação entre portas e não substitui regras de empresa na API.

Requisições de cadastro usam Content-Type: application/json e x-empresa-id. Campos extras são recusados; erros retornam statusCode, code, message e, quando aplicável, fieldErrors. Falhas inesperadas retornam mensagem genérica e são registradas apenas no servidor.

## Verificações sem banco

```bash
npm run db:generate
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

A suíte unitária cobre configuração, proteção do banco de testes e exclusão de serviços. A suíte HTTP inicializa os controllers e services reais com Prisma substituído; verifica CORS, DTOs, contexto de empresa e mensagens de erro sem abrir conexão MySQL. Esses testes não comprovam consultas SQL reais.

## Integração com MySQL

1. Preparar uma instância MySQL acessível e exclusiva para testes.
2. Copiar .env.test.example para .env.test.local.
3. Preencher DATABASE_TEST_URL. O nome do banco precisa terminar em _test e ser diferente do banco em DATABASE_URL.
4. Executar:

   ```bash
   npm run db:generate
   npm run test:integration
   ```

O runner valida o destino, aplica as migrações existentes e executa os testes HTTP com MySQL real. Não há fallback para o banco de desenvolvimento, reset automático, truncate ou limpeza global. A suíte cria seus dados e remove apenas seus próprios registros.

Os testes de integração estão preparados, mas sua execução está pendente de configuração do banco de testes, por decisão do grupo.

## Cadastros da API

Clientes, profissionais e serviços agora retornam listas no formato { items, total, page, pageSize }. As queries aceitam busca, page (padrão 1) e pageSize (padrão 20, máximo 100). Nome e id definem a ordenação estável. A contagem respeita a empresa e os filtros, independentemente da página.

Clientes aceitam busca parcial por nome ou telefone. Cadastro e edição normalizam espaços do nome e a formatação do telefone; +55 é removido quando acompanhado de DDD e número completo. A API mantém 10 ou 11 dígitos e rejeita letras. O telefone é único por empresa, inclusive na edição e em tentativas simultâneas.

Profissionais e serviços aceitam ativo=true ou ativo=false; omitir o filtro retorna ambos. O parâmetro antigo ativos foi substituído por ativo. PATCH com { ativo: false } desativa sem apagar atendimentos existentes; PATCH com true permite reativar. A recepção resolverá manualmente as reservas de quem saiu da barbearia.

Preço de serviço é enviado e retornado como string com duas casas decimais, por exemplo "40.10". Aceita de "0.01" a "99999999.99". Duração é um inteiro entre 5 e 600 minutos. Nome, preço e duração contratados ficam copiados no item da reserva. Mudanças posteriores no catálogo não os atualizam.

As rotas DELETE legadas recusam clientes, profissionais e serviços com histórico ou reservas. As chaves estrangeiras também restringem a exclusão e os vínculos entre empresas no banco. Exemplos atualizados estão em routes.http.

## Migração dos cadastros

A migração 20261125230000_fortalecer_cadastros_e_historico foi preparada, mas não aplicada nem validada com MySQL real nesta etapa. Executar a suíte de integração em banco de testes antes de migrar um banco com dados.

Para migrar dados existentes, parar a API e conferir um backup. A migração verifica empresas obrigatórias, vínculos cruzados, telefones inválidos ou duplicados após normalização e valores monetários/durações incompatíveis antes de alterar tabelas do produto. Uma falha identifica a categoria por uma constraint com prefixo sanear_. Corrigir os registros indicados pela categoria antes de prosseguir; não atribuir órfãos a uma empresa arbitrária.

O MySQL não torna toda a sequência de alterações de estrutura atômica. Se uma migração falhar, examinar o estado e seguir o fluxo de recuperação de migrações antes de tentar novamente; não executar reset em um banco de uso normal.

A base antiga já preservava o preço cobrado, mas não o nome e a duração de cada serviço contratado. Para registros anteriores, a migração copia nome e duração do catálogo disponível no momento da migração, pois não é possível reconstruir alterações históricas perdidas. Novas reservas preservam esses três valores desde a criação.

## Agenda da API

O expediente padrão é segunda a sábado, 09h às 19h, no fuso America/Sao_Paulo. POST/PATCH de empresas aceita fusoHorario (IANA), aberturaMin, fechamentoMin e diasFuncionamento (1 = segunda, 7 = domingo). Abertura e fechamento usam minutos desde meia-noite, em múltiplos de 15, sem atravessar o dia. Por exemplo, 540 significa 09h. Alterações não remanejam reservas existentes.

| Ação                        | Rota                                                                              |
| --------------------------- | --------------------------------------------------------------------------------- |
| Disponibilidade             | GET /agendamentos/disponibilidade?data=AAAA-MM-DD&profissionalId=1&servicoIds=1,2 |
| Reservar                    | POST /agendamentos                                                                |
| Confirmar resultado incerto | GET /agendamentos/operacoes/:chave                                                |
| Agenda e histórico          | GET /agendamentos?data=AAAA-MM-DD&profissionalId=1&clienteId=1&status=AGENDADO    |
| Detalhes                    | GET /agendamentos/:id                                                             |
| Finalizar                   | PATCH /agendamentos/:id/status                                                    |
| Painel                      | GET /agendamentos/pendentes                                                       |

Todas essas rotas exigem x-empresa-id e empresa ativa. Agenda e painel aceitam page e pageSize, até 100 itens por página. Os filtros de cliente, profissional, data e estado são opcionais na consulta da agenda; o painel aceita data e profissional. GET /empresas?ativa=true permite listar as empresas disponíveis na entrada.

A disponibilidade soma os serviços ativos da empresa e retorna duração, total decimal e inícios/fins em ISO UTC. A data da consulta é interpretada no fuso da empresa. Horários passados, ocupados, ambíguos ou inexistentes em mudanças de fuso não são oferecidos. A duração inteira deve caber no expediente. Reservas adjacentes são aceitas. A disponibilidade é uma consulta: o horário é revalidado na confirmação.

Para reservar, enviar { clienteId, profissionalId, servicoIds, inicio } e o header Idempotency-Key com um UUID v4 novo para cada pedido lógico. inicio exige ISO com segundos e Z ou offset, por exemplo "2030-01-07T09:00:00-03:00". Preço, duração e fim são calculados pela API.

Reserva nova responde 201. Repetir a mesma chave com o mesmo pedido retorna 200 e a reserva existente, inclusive após seu início ou uma alteração de catálogo. A chave é isolada por empresa; pedido diferente com a mesma chave retorna 409 OPERACAO_DIVERGENTE. Preços e totais retornam como strings com duas casas. O hash interno do pedido não é exposto.

Em caso de demora ou resposta perdida, consultar /operacoes/:chave ou repetir exatamente o mesmo pedido com a mesma chave. Um 404 de consulta pode significar que a primeira requisição ainda está em andamento. Não gerar outra chave para a mesma tentativa incerta.

A confirmação usa transação com bloqueios parametrizados, primeiro na empresa e depois no profissional, com nova checagem de situação, expediente e sobreposição antes de gravar a reserva e os itens contratados. Alterações de empresa, profissionais e serviços usam a mesma coordenação. A serialização por empresa simplifica a consistência para o volume da recepção; empresas diferentes continuam independentes. Conflitos e falhas transacionais têm mensagens de recuperação, sem detalhes do banco. A verificação desses bloqueios em MySQL real ainda está pendente.

AGENDADO pode virar CONCLUIDO, CANCELADO ou FALTOU. Concluir e marcar falta exigem que o início previsto tenha chegado. Repetir o mesmo estado final não faz outra alteração; mudar um estado final para outro retorna 409 ESTADO_INVALIDO. Cancelar libera a ocupação sem apagar o histórico. Não existe DELETE de agendamento nem edição de horário; para remarcar, cancelar e cadastrar outra reserva.

O painel inclui todos os AGENDADOS, inclusive pendências de dias anteriores. Atrasado significa fim anterior ao instante atual. A lista prioriza atrasados e depois os demais, com paginação estável por início e id dentro de cada grupo. Indicadores pendentes, atrasados e hoje respeitam o profissional, mas ignoram o filtro de data da lista para manter as pendências globais visíveis. Hoje é o dia civil da empresa.

## Migração do expediente e das operações

A migração 20261126000000_expediente_e_operacoes também está preparada e não foi aplicada. Ela preenche o expediente das empresas existentes, cria o padrão JSON no MySQL e adiciona chave/hash opcionais para preservar reservas legadas sem inventar chaves de operação. As novas reservas exigem a chave pela API.

A suíte de integração inclui testes de duas reservas simultâneas, repetição simultânea da mesma chave, rollback com itens contratados, finalizações divergentes e alterações concorrentes de preço ou situação. Esses testes devem rodar em banco exclusivo antes de considerar a concorrência validada. As suítes sem banco testam regras e HTTP, sem simular garantias reais de locks e rollback.

## Executar o front-end

O front fica em frontend/ e usa React, TypeScript, Vite e TanStack Query. O npm workspace mantém um único package-lock.json na raiz. Instalar tudo com npm ci na raiz, usando a versão de Node indicada em .nvmrc.

Com a API configurada e disponível na porta 3000, abrir outro terminal na raiz e executar:

```bash
npm run dev:web
```

Abrir http://127.0.0.1:5173. A URL da API é http://localhost:3000 por padrão. Para mudar, copiar frontend/.env.example para frontend/.env.local e ajustar VITE_API_URL. Não colocar senhas ou tokens em variáveis VITE_, pois elas são públicas no navegador.

O front acessa a API diretamente, sem proxy de desenvolvimento. Se mudar a origem do front, ajustar CORS_ORIGINS no ambiente da API. VITE_API_URL deve apontar para a raiz HTTP da API, sem barra final.

A primeira entrada exige escolher uma empresa ativa. O sistema guarda somente o id selecionado em sessionStorage e o valida na API ao abrir a recepção. Alterar empresa cancela consultas em andamento, limpa o cache e reinicia os filtros. Não há escolha automática da primeira empresa da lista.

O dashboard apresenta indicadores, pendências vencidas e futuras, filtros por data e profissional, paginação e detalhes dos serviços contratados. Os dados são atualizados a cada 30 segundos e podem ser atualizados manualmente. Erros de leitura não apagam os filtros; dados antigos ainda visíveis são identificados como última consulta. Empresa inativa bloqueia a lista e oferece outra seleção.

O menu lateral oferece os submenus de clientes, profissionais, serviços e agendamentos. Os cadastros web permitem buscar, paginar, cadastrar e editar dados da empresa selecionada. Profissionais e serviços podem ser filtrados por situação e desativados com confirmação, preservando reservas e histórico. A agenda permite consultar reservas e horários livres. A nova reserva oferece cadastro rápido de cliente, revisão e confirmação. Os detalhes permitem concluir, cancelar e marcar falta, com confirmação e atualização das pendências.

```bash
npm run build:web
npm run typecheck:web
npm run lint:web
npm run test:web
```

O build fica em frontend/dist. A compilação e os testes da API continuam separados; npm run build, npm run typecheck, npm test e npm run test:e2e verificam o back-end.

## Testes de navegador

Os testes Playwright verificam desktop, celular, teclado, filtros, paginação, falhas de leitura e resposta atrasada após troca de empresa. Um dos fluxos abre o front contra a API NestJS real em outra porta, substituindo somente Prisma por dados isolados de teste. Os demais cenários controlam as respostas HTTP no navegador. Nenhuma dessas verificações comprova SQL, locks ou migrações MySQL.

Por padrão, instalar o navegador de teste uma vez:

```bash
npx playwright install chromium
npm run test:web:e2e
```

No Windows, é possível aproveitar o Chrome já instalado, sem baixar outro navegador. Em PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:web:e2e
```

O comando gera o cliente Prisma, compila a API e inicia servidores de teste nas portas 5173 e 43117, encerrados pelo Playwright ao terminar. A API de teste só aceita NODE_ENV=test e não conecta ao MySQL. Não iniciar outro serviço nessas portas durante a verificação.

Os dados de teste ficam somente em frontend/test e frontend/e2e; não há modo de demonstração com respostas fictícias no front de produção. Para usar o produto com dados persistidos, executar a API normal com seu MySQL configurado.

## Colaboração

Trabalhar em mudanças pequenas e revisar os arquivos preparados antes de cada commit. A autoria será decidida com o grupo antes de cada commit; o cronograma anterior não escolhe automaticamente quem assina as próximas alterações.

| Participante | Conta GitHub | Email de autoria           |
| ------------ | ------------ | -------------------------- |
| João         | JoaoPLS-1    | barrancoij@gmail.com       |
| Helena       | helenamoreto | helenamoreto2008@gmail.com |
| Victor       | Hcklz        | victorzapkkj@gmail.com     |

Nome e email configurados no Git definem autoria; a conta autenticada para o push é independente.


## Cadastros e histórico na recepção

A busca dos cadastros é enviada ao confirmar Buscar ou pressionar Enter; os filtros e a página ficam na URL e podem ser retomados ao voltar pelo navegador. Clientes aceitam nome ou telefone na busca. A API valida telefone brasileiro com DDD e impede duplicidade dentro da mesma empresa. Mensagens de validação aparecem junto ao campo, sem apagar o formulário.

O preço de serviço pode ser digitado com vírgula ou ponto e até duas casas decimais; ele é enviado como texto com centavos, sem aritmética de ponto flutuante. A duração deve ser inteira, de 5 a 600 minutos. Os novos dados do catálogo não substituem nome, duração e preço já contratados nas reservas existentes.

Ao desativar um profissional, a tela consulta a quantidade de atendimentos ainda AGENDADOS, incluindo pendências antigas, e avisa que eles não serão cancelados. A contagem orienta a recepção; ela não reserva nem bloqueia a agenda enquanto a confirmação está aberta. Não há exclusão de cadastros pela interface.

Formulários com alterações pedem confirmação antes de cancelar, voltar, navegar pelo menu ou trocar de empresa. A seleção e o cache só são limpos depois da navegação aceita. Fechar ou recarregar a aba usa a confirmação nativa do navegador quando disponível. Enquanto uma gravação está em andamento, o envio e a saída pela navegação interna ficam bloqueados. Falha de rede ou resposta de servidor incerta orienta consultar os cadastros antes de repetir o envio; as mutações não têm repetição automática.

O histórico pode ser aberto pela lista de clientes ou pelo submenu de agendamentos. Ele inclui todas as situações, com filtros por data e situação e paginação, na ordem do mais antigo ao mais recente. O horário usa o fuso da empresa, e os detalhes apresentam os serviços e valores registrados na reserva. A consulta de um cliente de outra empresa retorna indisponível.

Os testes de navegador também percorrem as gravações de cadastro e a validação de duplicidade pela API NestJS real, com somente a persistência substituída por dados isolados. Esses testes não acessam MySQL. A execução das migrações e da suíte com MySQL real permanece pendente.


## Reservas e finalização pela interface

A agenda abre no dia atual da empresa e permite filtrar data, profissional (inclusive inativos para consulta) e situação. Na seção de horários livres, selecionar até 20 serviços ativos e um profissional. Os horários vêm da API e consideram duração, expediente, fuso e reservas existentes. Um clique no horário abre a nova reserva com a seleção preenchida; a disponibilidade é consultada novamente.

No novo agendamento, buscar e selecionar um cliente existente ou cadastrar um cliente sem sair da tela. Telefone duplicado mantém os dados e busca o cadastro existente. Serviços e profissionais disponíveis para novas reservas são somente os ativos. O resumo mostra uma estimativa; os valores e serviços da confirmação são os devolvidos pela API. Conflito de horário preserva cliente e serviços, atualiza a disponibilidade e exige outra escolha.

Cada pedido de reserva usa uma chave UUID enviada em Idempotency-Key. Antes do envio, a chave e o corpo imutável são guardados em sessionStorage por empresa, sem nome ou telefone. Enquanto uma confirmação estiver incerta, o formulário bloqueia alterações e troca de contexto, oferecendo consulta do resultado. Se a consulta ainda retornar 404, a recepção pode repetir explicitamente o mesmo pedido com a mesma chave. Não há repetição automática de gravações. Após recarregar a mesma aba, abrir Novo agendamento na empresa original para recuperar a consulta pendente. Fechar a sessão do navegador ou limpar seu armazenamento elimina essa recuperação local; o atendimento eventualmente gravado continua consultável na agenda.

Nos detalhes do atendimento, concluir ou marcar falta só fica disponível a partir do início previsto. Cancelar pode ocorrer antes e mantém o histórico. Todas as ações exigem confirmação, e a API revalida o estado. Resposta incerta de finalização exige consultar a situação antes de repetir a mesma ação; as demais ações ficam bloqueadas até resolver a consulta. Uma atualização confirmada invalida as consultas da empresa para atualizar painel, agenda e histórico.

Os testes de navegador cobrem a reserva e o cancelamento contra NestJS com persistência isolada, conflitos controlados, perda de resposta antes e depois da gravação, recuperação após recarregar, chave e corpo reutilizados, cadastro rápido, conclusão, falta e tela de celular. Eles não comprovam transações MySQL: migrações e testes com banco real seguem pendentes conforme combinado.
