# Sistema de Barbearia

Produto para a recepção operar clientes, profissionais, serviços e agendamentos de várias empresas, sem login. A entrada exige escolher a empresa; a tela inicial mostra os atendimentos pendentes e o menu permite trocar de empresa.

## Situação atual

A main inicial contém a API da aula em NestJS, Prisma e MySQL. O planejamento do produto está registrado; o front-end, os dados de exemplo e as melhorias de domínio serão implementados nas próximas partes. As rotas de agendamento ainda estão incompletas. Esta etapa não representa o produto pronto.

## Decisões e execução por partes

- [Produto e fluxos da recepção](docs/PRODUTO.md)
- [Arquitetura e diagnóstico da base](docs/ARQUITETURA.md)
- [Contrato planejado da API](docs/CONTRATO_API.md)
- [Nove partes e 36 microcommits distribuídos entre os três participantes](docs/ENTREGAS.md)

Stack decidida: manter NestJS, TypeScript, Prisma e MySQL; adicionar React, TypeScript e Vite em frontend/. A estrutura da API permanece na raiz para aproveitar a base da aula.

## Preparação da API existente

Pré-requisitos: Node compatível com as versões do package.json, npm e MySQL disponível. A padronização e a verificação das versões fazem parte da etapa 2.

1. Instalar as dependências com npm install. Após consolidar e versionar o lockfile, usar npm ci.
2. Copiar .env.example para .env e preencher DATABASE_URL com o banco local.
3. Gerar o cliente: npx prisma generate --config prisma7.config.ts.
4. Aplicar migrações: npx prisma migrate deploy --config prisma7.config.ts.
5. Iniciar: npm run start:dev.

Esses são os comandos previstos a partir dos scripts existentes; sua execução completa será validada na etapa de infraestrutura. A API escuta a porta 3000 por padrão. Rotas por empresa usam o header x-empresa-id. Há exemplos em routes.http.

## Verificação

Scripts existentes: npm run build, npm run lint, npm test e npm run test:e2e. O teste HTTP atual inicializa a aplicação com banco; preparar um MySQL exclusivo de testes antes de ampliar a suíte. O teste atual de Hello World não demonstra o fluxo do produto.

As instruções de execução do front, carga de exemplos e demonstração serão acrescentadas nos commits que entregarem essas funcionalidades.

## Participantes

| Identificação | Conta | Email de autoria |
| --- | --- | --- |
| João | JoaoPLS-1 | barrancoij@gmail.com |
| Helena | helenamoreto | helenamoreto2008@gmail.com |
| Victor | Hcklz | victorzapkkj@gmail.com |

A primeira parte pertence a João. As partes seguintes alternam responsáveis em blocos, com 12 microcommits planejados para cada participante. As publicações devem usar a conta correspondente, conforme o fluxo em docs/ENTREGAS.md.
