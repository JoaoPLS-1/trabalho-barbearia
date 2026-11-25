# Sistema de Barbearia

Sistema para a recepção operar clientes, profissionais, serviços e agendamentos de várias empresas, sem login. A entrada permitirá escolher a empresa e acessar um painel de atendimentos pendentes.

## Estado do desenvolvimento

A API da aula está em preparação para integração com o front-end. Esta parte configura comunicação HTTP, validação, erros e testes. O front-end, a agenda completa e os dados de demonstração serão entregues nas próximas partes.

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

## Colaboração

Trabalhar em mudanças pequenas e revisar os arquivos preparados antes de cada commit. A autoria será decidida com o grupo antes de cada commit; o cronograma anterior não escolhe automaticamente quem assina as próximas alterações.

| Participante | Conta GitHub | Email de autoria           |
| ------------ | ------------ | -------------------------- |
| João         | JoaoPLS-1    | barrancoij@gmail.com       |
| Helena       | helenamoreto | helenamoreto2008@gmail.com |
| Victor       | Hcklz        | victorzapkkj@gmail.com     |

Nome e email configurados no Git definem autoria; a conta autenticada para o push é independente.
