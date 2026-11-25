# Arquitetura do sistema

Manter a API NestJS com TypeScript e Prisma/MySQL já utilizada em aula. Criar front-end React com TypeScript e Vite em frontend/. Usar React Router para navegação, TanStack Query para dados remotos e CSS com variáveis e componentes próprios. As versões serão fixadas no lockfile durante a instalação; não se pressupõe compatibilidade de versões ainda não instalada.

## Organização

Evitar mover toda a API durante a entrega. O repositório continua único, com dois pacotes e comandos documentados. npm será o gerenciador adotado; consolidar o lockfile em uma tarefa específica, sem apagar o package-lock.json local antes de conferi-lo.

```text
src/
  common/                 contexto da empresa, erros e validação
  empresas/               escolha e expediente
  clientes/
  profissionais/
  servicos/
  agendamentos/           reserva, disponibilidade, painel e estados
  prisma/
prisma/
  schema.prisma
  migrations/
  seed.ts                 dados fictícios e reproduzíveis
frontend/
  src/
    app/                  rotas, provedores e shell
    components/           campos, diálogos, tabela e estados de tela
    lib/                  cliente HTTP, dinheiro e datas
    features/
      empresas/
      dashboard/
      clientes/
      profissionais/
      servicos/
      agendamentos/
  tests/                  testes dos fluxos de recepção
docs/                     produto, arquitetura, contrato e entregas
test/                     integração HTTP com MySQL de teste
scripts/                  comandos de desenvolvimento e verificação
```

Esta árvore é o destino de implementação; frontend/, scripts/ e seed ainda não existem na main inicial.

## Fronteiras

Controller recebe e valida entrada; service aplica regras, valida vínculos com a empresa e controla transações; Prisma persiste. Não criar uma camada genérica de repositórios apenas para encapsular cada chamada ao Prisma.

Front usa um cliente HTTP único com URL por variável de ambiente e x-empresa-id. A empresa selecionada vive no contexto de navegação e sessionStorage. Nenhuma empresa é escolhida automaticamente na primeira entrada. IDs da empresa integram todas as query keys. Troca de empresa cancela consultas, limpa cache e reinicia formulários; mutações capturam o contexto original e não atualizam outra empresa.

API em localhost:3000 e front em localhost:5173. Configurar CORS para origens explícitas de desenvolvimento e variável de ambiente em implantação, incluindo o header de operação. Não usar proxy de desenvolvimento como substituto do teste de CORS.

## Modelo e migrações planejadas

| Entidade | Alteração |
| --- | --- |
| Empresa | Fuso, abertura, fechamento, dias de expediente; padrão inicial descrito em PRODUTO.md |
| Cliente | empresaId obrigatório; telefone normalizado e índice único por empresa |
| Profissional | empresaId obrigatório; manter ativo |
| Servico | empresaId obrigatório; ativo; preço Decimal com duas casas |
| Agendamento | Empresa, cliente e profissional obrigatórios; chave de operação e hash do pedido; índices por empresa, profissional, início e status |
| AgendamentoServico | Vínculos obrigatórios; nome, duração e preço Decimal copiados da contratação |

Preservar as migrações existentes. Antes de tornar vínculos obrigatórios, verificar registros sem empresa ou com relações cruzadas. A migração não deve atribuir registros órfãos a uma empresa arbitrária: interromper com orientação de saneamento. Banco local descartável pode ser recriado somente por comando explícito documentado.

Preço trafega como string decimal, por exemplo "45.00". Somar em centavos inteiros ou Decimal na API; não usar Float para total monetário. O front apenas formata e exibe o total confirmado pela API.

## Reserva concorrente

A checagem de sobreposição atual ocorre antes da gravação e permite duas requisições simultâneas aprovarem o mesmo horário. A reserva deverá usar transação MySQL:

1. Validar DTO e iniciar transação.
2. Bloquear a linha do profissional com SELECT FOR UPDATE parametrizado e escopado à empresa.
3. Revalidar empresa ativa, profissional ativo, cliente e serviços da mesma empresa.
4. Calcular fim e preço no servidor; verificar passado, expediente e sobreposição.
5. Persistir agendamento e snapshots na mesma transação.

Sobreposição usa inicioExistente < novoFim e fimExistente > novoInicio. Reservas adjacentes são aceitas. AGENDADO ocupa a agenda; estados finais não ocupam. Todas as operações que alteram ocupação devem seguir a mesma ordem de locks. Alterações de situação do profissional e da empresa devem coordenar-se com esse protocolo. Deadlock ou timeout de lock gera erro recuperável, sem gravação parcial.

Cada tentativa lógica de reserva usa uma chave UUID gerada no front e mantida durante tentativas de confirmação. Unicidade por empresa; a mesma chave e mesmo pedido retornam a reserva existente. Mesma chave e pedido diferente retornam 409. A atualização de status usa condição no estado atual para impedir duas finalizações divergentes. Esses comportamentos exigem testes com banco real.

## Datas e disponibilidade

Entrada de instante exige ISO 8601 com Z ou offset. Persistir instantes em UTC e apresentar no fuso da empresa. A data da agenda é uma data civil no fuso da empresa, convertida na API para intervalo UTC; não depender do fuso do processo Node.

Disponibilidade e criação compartilham o mesmo cálculo de duração, expediente e conflito. Disponibilidade não garante reserva: outra recepção pode ocupar o horário antes da confirmação. Datas inválidas, serviços repetidos, duração não positiva e IDs não positivos devem ser rejeitados no servidor.

## Verificação

- Testes unitários para intervalos, expediente, datas, preço e transições.
- Integração HTTP em MySQL separado para isolamento em todas as operações, relações cruzadas, rollback, corrida de reservas, idempotência e preço histórico.
- Testes de interface para cadastro rápido, preservação de formulário, erro de leitura e escrita incerta.
- Fluxo completo no navegador: duas empresas, reserva, conflito, conclusão e troca de contexto.
- CI com instalação reproduzível, geração Prisma, build, lint, testes e banco de teste. Nunca apontar teste destrutivo para DATABASE_URL de uso normal.

## Diagnóstico da base inicial

Revisão estática sobre main 84ef128:

- main.ts não habilita CORS.
- Listar, detalhar e remover agendamentos ainda retornam textos de scaffold; não estão prontos para uso.
- Atualização de status possui DTO, mas não fluxo HTTP implementado.
- Criação já verifica empresa, vínculos, profissional ativo, conflito e preço copiado; ainda precisa de transação e snapshots completos.
- ServicosService.remove filtra AgendamentoServico por empresaId, campo inexistente nesse modelo; filtrar pela relação correta e proteger o registro da empresa.
- Cliente.update não executa a validação amigável de telefone duplicado usada no cadastro.
- Vários vínculos de empresa e atendimento são opcionais no schema.
- Preço usa Float; serviço ainda não tem situação ativo.
- O teste HTTP atual verifica apenas Hello World e depende da inicialização do banco.
- README ainda é o template do Nest. Não há front-end nem seed na main.

Nenhum funcionamento de rota é presumido a partir dessa revisão. A etapa de infraestrutura deve executar os checks e registrar os resultados.
