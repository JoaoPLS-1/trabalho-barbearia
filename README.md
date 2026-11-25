# Sistema de Barbearia

Sistema para a recepção operar clientes, profissionais, serviços e agendamentos de várias empresas, sem login. A entrada permitirá escolher a empresa e acessar um painel de atendimentos pendentes.

## Estado do desenvolvimento

A API da aula está em preparação para integração com o front-end. Os cadastros possuem busca paginada, telefone normalizado, preço decimal e desativação com histórico preservado. As rotas completas de agenda ainda estão em construção. O front-end, a agenda completa e os dados de demonstração serão entregues nas próximas partes.

## Arquitetura e decisões

- API NestJS e TypeScript com Prisma e MySQL; front-end planejado em React, TypeScript e Vite.
- Empresa corrente enviada pelo header x-empresa-id. A API valida o contexto e restringe as operações à empresa.
- Profissionais e serviços terão desativação para preservar histórico.
- Reservas deverão preservar preço e duração contratados e impedir sobreposição na API.
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

## Colaboração

Trabalhar em mudanças pequenas e revisar os arquivos preparados antes de cada commit. A autoria será decidida com o grupo antes de cada commit; o cronograma anterior não escolhe automaticamente quem assina as próximas alterações.

| Participante | Conta GitHub | Email de autoria           |
| ------------ | ------------ | -------------------------- |
| João         | JoaoPLS-1    | barrancoij@gmail.com       |
| Helena       | helenamoreto | helenamoreto2008@gmail.com |
| Victor       | Hcklz        | victorzapkkj@gmail.com     |

Nome e email configurados no Git definem autoria; a conta autenticada para o push é independente.
