# Contrato planejado entre interface e API

Este é o contrato alvo. Rotas legadas devem ser corrigidas ou completadas antes de o front depender delas. Os exemplos não significam que as rotas já estejam implementadas.

## Convenções

Todas as rotas de clientes, profissionais, serviços, painel e agendamentos exigem x-empresa-id inteiro positivo e empresa ativa. Toda consulta, alteração, vínculo e contagem deve usar esse contexto. Empresas tem listagem global necessária à escolha, sem login.

IDs de URL usam ParseIntPipe e validação de inteiro positivo. DTOs rejeitam campos não permitidos. Listas usam paginação com page e pageSize, limite máximo 100, e retornam { items, total, page, pageSize }. Busca usa busca; profissional e serviço aceitam ativo=true|false, com parse explícito. Datas da agenda usam YYYY-MM-DD validado no calendário.

Erros seguem { statusCode, code, message, fieldErrors? }. Códigos previstos: VALIDACAO, EMPRESA_INATIVA, NAO_ENCONTRADO, TELEFONE_DUPLICADO, HORARIO_OCUPADO, ESTADO_INVALIDO e OPERACAO_DIVERGENTE. Erros desconhecidos recebem mensagem genérica e log interno. 400 para entrada inválida, 404 para recurso ausente no contexto, 409 para conflito e 500 para falha inesperada.

## Telas e requisições

| Ação da recepção | Requisição alvo | Observação |
| --- | --- | --- |
| Escolher empresa | GET /empresas?ativa=true | Listagem de empresas ativas |
| Consultar contexto | GET /empresas/:id | Validar existência e situação |
| Abrir painel | GET /agendamentos/pendentes | Inclui todos os AGENDADOS vencidos e futuros; filtros opcionais |
| Buscar cliente | GET /clientes?busca=1199&page=1&pageSize=20 | Nome parcial ou telefone normalizado |
| Cadastrar cliente | POST /clientes | { nome, telefone } |
| Editar cliente | PATCH /clientes/:id | Normalização e unicidade inclusive na edição |
| Histórico do cliente | GET /agendamentos?clienteId=12 | Apenas empresa corrente |
| Listar profissionais | GET /profissionais?ativo=true | Paginado, nome e situação |
| Cadastrar ou editar profissional | POST /profissionais; PATCH /profissionais/:id | Nome e ativo; desativação preserva histórico |
| Listar serviços | GET /servicos?ativo=true | Nome, preço decimal, duração e situação |
| Cadastrar ou editar serviço | POST /servicos; PATCH /servicos/:id | Não altera snapshots de reservas |
| Agenda do dia | GET /agendamentos?data=2026-12-01&profissionalId=3 | Intervalo no fuso da empresa; status opcional |
| Oferecer horários | GET /agendamentos/disponibilidade?data=2026-12-01&profissionalId=3&servicoIds=1,2 | Retorna inícios/fins ISO, duração e total |
| Confirmar reserva | POST /agendamentos | Header Idempotency-Key obrigatório |
| Consultar confirmação incerta | GET /agendamentos/operacoes/:chave | Localiza reserva pela chave na empresa |
| Ver detalhes | GET /agendamentos/:id | Cliente, profissional, snapshots e total |
| Finalizar | PATCH /agendamentos/:id/status | { status: "CONCLUIDO" ou "CANCELADO" ou "FALTOU" } |

Registrar rotas fixas pendentes, disponibilidade e operacoes antes da rota :id. Não criar endpoint DELETE para agendamento: cancelar é uma transição auditável.

## Reserva e retorno

Pedido: { clienteId, profissionalId, servicoIds: [1, 2], inicio: "2026-12-01T09:00:00-03:00" }. Preço, duração, fim e empresa nunca são aceitos como valores confiáveis vindos do front. A lista de serviços precisa ser não vazia, única e válida na empresa.

Resposta: { id, empresaId, inicio, fim, status, cliente, profissional, servicos, total }. Cada item de serviços contém servicoId, nomeContratado, duracaoContratadaMin e precoCobrado. Preços são strings decimais. POST novo responde 201; repetição confirmada da mesma chave pode responder 200 com a mesma reserva.

A disponibilidade retorna { data, fusoHorario, profissionalId, duracaoMin, total, horarios: [{ inicio, fim }] }. Lista vazia é um resultado normal e deve permitir alterar dia ou profissional.

## Painel

Retorno: { resumo: { pendentes, atrasados, hoje }, items, total, page, pageSize }. Indicadores respeitam o filtro de profissional, mas são calculados sobre todas as pendências; hoje representa pendências do dia civil da empresa. Filtro de data restringe a lista, não oculta a quantidade global de atrasados. A tela explica essa diferença.

Atrasado é AGENDADO com fim anterior ao instante atual. Ordenar atrasados por início ascendente e depois próximos por início ascendente. O painel inclui pendências antigas até que a recepção as resolva.

## Compatibilidade e testes de contrato

Ao introduzir o envelope de paginação, atualizar consumidores e routes.http no mesmo incremento. Testar JSON monetário, offset de datas, validação de query, headers CORS, empresa inválida e IDs de outra empresa. Uma resposta 404 de operação ainda em andamento não prova que a escrita falhou: repetir consulta ou reenviar o mesmo pedido com a mesma chave.
