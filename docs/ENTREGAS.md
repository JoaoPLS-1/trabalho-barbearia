# Partes e microcommits

O trabalho será entregue em nove partes, cada uma com quatro microcommits, totalizando 36 incrementos planejados: 12 por participante. A contagem organiza o escopo; cada commit deve conter uma mudança revisável com propósito real. Se um item crescer, subdividir e registrar a mudança aqui, mantendo equilíbrio de responsabilidades.

O plano define autoria e responsabilidade esperadas. O histórico deve refletir o trabalho e a revisão efetivamente realizados; não alterar datas nem reatribuir os commits do professor.

## Contas e responsabilidades

| Responsável | Conta GitHub | Email de autoria |
| --- | --- | --- |
| João | JoaoPLS-1 (identificação informada: JoaoPLS) | barrancoij@gmail.com |
| Helena | helenamoreto | helenamoreto2008@gmail.com |
| Victor | Hcklz | victorzapkkj@gmail.com |

## Sequência de implementação

| ID | Parte e responsável | Commit proposto | Resultado verificável |
| --- | --- | --- | --- |
| 01 | 1 João | docs(produto): define fluxos e decisões da recepção | Escolhas de produto e escopo |
| 02 | 1 João | docs(arquitetura): organiza aplicação e regras de domínio | Estrutura, persistência e concorrência |
| 03 | 1 João | docs(api): especifica contrato das telas | Ação de tela associada à API |
| 04 | 1 João | docs(entregas): divide execução e responsabilidades | README e roteiro de 36 commits |
| 05 | 2 Helena | chore(setup): padroniza instalação e ambiente | npm e lockfiles consistentes; exemplos sem segredos |
| 06 | 2 Helena | fix(api): prepara bootstrap e comunicação entre portas | CORS, validação e erros sem detalhes internos |
| 07 | 2 Helena | fix(prisma): corrige consulta de uso dos serviços | API compila após gerar cliente |
| 08 | 2 Helena | test(api): prepara banco isolado e testes de contexto | Check inicial reproduzível e casos por empresa |
| 09 | 3 Victor | feat(dados): fortalece vínculos e valores monetários | Migração segura, índices e snapshots |
| 10 | 3 Victor | feat(clientes): implementa busca e telefone consistente | Cadastro e edição rejeitam duplicidade |
| 11 | 3 Victor | feat(catalogo): preserva histórico por desativação | Profissionais e serviços ativos/inativos |
| 12 | 3 Victor | test(cadastros): cobre isolamento e preservação de histórico | Casos HTTP de outra empresa e vínculos |
| 13 | 4 João | feat(agenda): calcula expediente e disponibilidade | Intervalos e fuso com testes |
| 14 | 4 João | feat(agenda): confirma reservas com transação e idempotência | Corrida não gera reservas sobrepostas |
| 15 | 4 João | feat(agenda): implementa consulta e estados finais | Agenda, detalhes, operação e finalização |
| 16 | 4 João | feat(painel): lista pendências e atrasos com indicadores | Painel paginado e teste de reservas antigas |
| 17 | 5 Helena | feat(front): inicia React e rotas da aplicação | Front compila e inicia separado da API |
| 18 | 5 Helena | feat(ui): cria campos diálogos e estados acessíveis | Componentes comuns e estilo responsivo |
| 19 | 5 Helena | feat(empresas): implementa escolha e troca de contexto | Sem seleção automática; cache isolado |
| 20 | 5 Helena | feat(painel): integra pendências e ações da recepção | Dashboard consumindo API real |
| 21 | 6 Victor | feat(clientes-ui): adiciona busca cadastro e edição | Cliente encontrado por informação parcial |
| 22 | 6 Victor | feat(profissionais-ui): adiciona gestão de situação | Desativação e aviso de reservas existentes |
| 23 | 6 Victor | feat(servicos-ui): adiciona catálogo com preço e duração | Criação, edição e desativação |
| 24 | 6 Victor | feat(historico-ui): consulta atendimentos do cliente | Histórico com preço contratado |
| 25 | 7 João | feat(agenda-ui): consulta horários por profissional | Dia e profissional com disponibilidade real |
| 26 | 7 João | feat(reserva-ui): reúne cadastro rápido e confirmação | Fluxo de reserva em uma tela |
| 27 | 7 João | feat(finalizacao-ui): resolve conclusão cancelamento e falta | Confirmações e atualização do painel |
| 28 | 7 João | fix(reserva-ui): trata conflito e confirmação incerta | Formulário preservado e chave reutilizada |
| 29 | 8 Helena | feat(seed): adiciona duas empresas e cenários de demonstração | Seed repetível com casos isolados |
| 30 | 8 Helena | test(integracao): cobre reservas concorrentes e idempotência | MySQL real confirma garantias do domínio |
| 31 | 8 Helena | test(front): cobre fluxo e troca de empresa | Resposta antiga não contamina contexto novo |
| 32 | 8 Helena | ci: verifica builds lint e testes com banco isolado | Pipeline executável no GitHub |
| 33 | 9 Victor | fix(usabilidade): ajusta fluxo após ensaio da recepção | Evidências do ensaio e correções identificadas |
| 34 | 9 Victor | docs(execucao): completa instalação e demonstração | Clone limpo executa com dados de exemplo |
| 35 | 9 Victor | docs(apresentacao): distribui demonstração entre integrantes | Roteiro e justificativas para os três |
| 36 | 9 Victor | test(entrega): registra verificação final do produto | Evidências reais dos critérios de aceite |

Os IDs não são hashes nem commits já executados. Consultar git log para saber o que foi entregue. Não criar commits vazios para cumprir a tabela. Os commits de teste devem incluir casos e evidências reais, sem fabricar resultados.

## Critérios de passagem entre partes

1. Planejamento: produto, arquitetura, contrato e divisão registrados.
2. Infraestrutura: instalação, geração Prisma, build, lint e testes iniciais com resultados conhecidos.
3. Cadastros: dados isolados, busca útil e histórico protegido.
4. Agenda API: disponibilidade, escrita concorrente segura, consulta e finalização.
5. Estrutura visual: escolher empresa, trocar contexto e abrir painel real.
6. Cadastros visuais: operar cadastros sem chamadas manuais.
7. Agendamento visual: executar reserva e finalização de ponta a ponta.
8. Integração: seed e verificações automatizadas reproduzíveis.
9. Entrega: README validado e apresentação ensaiada pelos três.

## Fluxo de Git e autenticação

Preservar a main e as branches backup/* já existentes. Para cada parte de implementação, usar branch parte/02-infraestrutura, parte/03-cadastros etc. Integrar por fast-forward quando possível; PRs sem squash preservam os microcommits quando houver revisão no GitHub. Não usar force push para reorganizar o histórico.

Antes de iniciar uma parte, conferir git status, branch e remoto. Não incluir arquivos locais sem relação com a mudança. Cada commit usa staging explícito de arquivos, git diff --cached --check e revisão do diff. Rodar os checks relevantes à mudança; documentação não exige suíte da aplicação.

Autoria local (user.name e user.email) e autenticação do transporte Git são independentes. Configurar autoria somente neste repositório. Confirmar a conta do transporte antes de publicar a parte. Nunca publicar como Helena ou Victor apenas trocando --author sob a sessão de João quando a exigência é usar cada conta.

Fluxo exigido pelo grupo ao mudar de responsável:

1. Concluir e publicar a parte da conta atual.
2. Sair da conta GitHub atual no gerenciador de credenciais.
3. Autenticar a próxima conta por fluxo interativo do Git Credential Manager ou GitHub CLI; o titular informa credenciais diretamente ao provedor, sem senhas ou tokens em arquivos ou chat.
4. Conferir a conta autenticada, acesso de colaborador ao repositório e email de autoria associado à conta.
5. Configurar user.name e user.email locais, fazer os commits da parte e publicar.
6. Conferir no histórico remoto o resultado de autoria e os hashes publicados.

No diagnóstico inicial, Git Credential Manager lista somente JoaoPLS-1 e GitHub CLI não foi encontrado no PATH. A disponibilidade das outras contas e sua permissão de escrita ainda devem ser verificadas na transição. Não remover a sessão atual antes de preparar uma troca que possa ser concluída.

## Apresentação e dados de exemplo

João explica arquitetura, agenda, concorrência e decisões de finalização. Helena demonstra entrada, painel, troca de empresa e tratamento de falhas. Victor demonstra clientes, catálogo, histórico e execução a partir do README. Todos devem entender o fluxo completo.

Seed com duas empresas, clientes e profissionais de nomes semelhantes, serviços com durações diferentes, profissional inativo, reservas futuras, atrasadas e finalizadas. Datas relativas à execução permitem demonstrar pendências em qualquer dia. Seed idempotente deve usar identificadores estáveis e não apagar dados criados pelo usuário.

Registro final: comandos executados, resultados, limitações conhecidas e passos do ensaio. Marcar uma etapa como concluída só após verificar seu resultado.
