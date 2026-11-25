# Decisões de produto

O produto atende a recepção de várias barbearias, sem login. A prioridade é encontrar o cliente, oferecer um horário realmente disponível e registrar o atendimento enquanto a pessoa está no telefone.

## Exigências do enunciado

A entrada exige escolher a empresa. A tela seguinte é um dashboard com agendamentos não finalizados. O menu lateral contém os cenários Cliente, Profissional, Serviço e Agendamento, organizados em submenus. A última opção permite alterar a empresa. A entrega inclui API e front integrados, README com decisões, dados de exemplo e apresentação de todos.

As escolhas abaixo são decisões do grupo, não requisitos adicionais atribuídos ao professor.

## Pessoa e objetivo

Hipótese de projeto: recepcionista que registra de 20 a 50 atendimentos por dia, alternando telefone, WhatsApp e balcão. Essa hipótese orienta os fluxos e deverá ser confrontada no ensaio de uso. Os principais riscos são duplicar clientes, oferecer horário ocupado e operar a empresa errada.

Meta de usabilidade: com cliente já cadastrado, concluir o agendamento em uma única tela, sem assistente com várias páginas. O número exato de cliques depende da quantidade de serviços. Cadastro rápido de cliente abre um diálogo e retorna à reserva preservando profissional e serviços.

## Navegação e telas

| Tela | Conteúdo e ações |
| --- | --- |
| Escolher empresa | Empresas ativas, nome, telefone e botão Entrar; estados vazio, carregando e erro |
| Dashboard | Todos os AGENDADOS, inclusive atrasados de dias anteriores; próximos primeiro após o bloco de pendências vencidas; filtros por dia e profissional |
| Clientes > Listar / Novo | Busca parcial por nome ou telefone, cadastro, edição e histórico |
| Profissionais > Listar / Novo | Nome, situação e desativação; pendências futuras visíveis |
| Serviços > Listar / Novo | Nome, preço, duração, situação e edição |
| Agendamentos > Agenda / Novo / Histórico | Agenda diária por profissional, disponibilidade, cadastro e estados finais |
| Alterar empresa | Último item do menu; retorna à escolha após tratar alterações não salvas |

O nome da empresa fica sempre visível no topo e no resumo de confirmação. Trocar empresa descarta o contexto anterior: filtros, seleções, formulários e cache. Formulário alterado exige confirmação para descarte. Respostas atrasadas da empresa anterior nunca podem atualizar a tela atual.

Layout: desktop com menu lateral e conteúdo em cartões/tabelas; em telas pequenas, menu recolhível e cartões. Identidade visual sóbria com fundo claro, texto escuro e destaque em verde. Status têm texto e ícone além de cor. Campos têm rótulos, foco visível, navegação por teclado e erros associados.

## Dashboard e urgência

Pendente significa status AGENDADO, qualquer que seja a data. Pela manhã, os próximos atendimentos orientam a recepção. Durante o expediente, atrasos ficam destacados com horário e ação Resolver. Um item vencido nunca é concluído automaticamente: o atendente decide se houve conclusão, cancelamento ou falta.

A lista é paginada; indicadores contam o conjunto completo no servidor, não apenas a página atual. Vazio significa que não há pendências, e não falha de carregamento.

## Cadastros e histórico

- Telefone é normalizado em dígitos e único por empresa. A busca aceita nome parcial ou parte do telefone. Nomes podem repetir.
- Cliente novo pode ser cadastrado durante o agendamento. Falha ao agendar não apaga o cadastro já confirmado.
- Profissional é desativado; mantém histórico e pendências existentes. A interface mostra os futuros atendimentos para resolução manual. Não recebe novas reservas enquanto inativo.
- Serviço é desativado em vez de removido da interface. Cada reserva guarda nome, preço e duração do serviço no momento da contratação. Alterar o catálogo não muda reservas antigas.
- A interface não oferece exclusão física de clientes, profissionais, serviços ou agendamentos. Rotas legadas devem bloquear exclusão quando houver histórico relacionado.

## Agendar e finalizar

Ordem: localizar/cadastrar cliente, selecionar serviços, profissional e dia, escolher uma disponibilidade retornada pela API e confirmar o resumo com empresa, horário, duração e preço. Alterar serviços, profissional ou dia invalida o horário selecionado.

Decisão inicial de expediente: segunda a sábado, 09h às 19h, sem intervalo, fuso America/Sao_Paulo; domingo fechado. A configuração fica na empresa e será documentada no seed. Oferecer inícios a cada 15 minutos; a duração total deve caber integralmente no expediente. A API verifica disponibilidade novamente ao salvar.

Fluxo de estados: AGENDADO pode virar CONCLUIDO, CANCELADO ou FALTOU. Estados finais não reabrem nesta entrega. Concluir e marcar falta só são permitidos a partir do início previsto; cancelamento pode ocorrer antes. Cancelar pede confirmação com identificação do atendimento. Repetir o mesmo estado final retorna o resultado existente; tentar outro estado final gera conflito.

Não haverá edição de horário nesta primeira versão. Para remarcar, cancelar a reserva anterior e cadastrar outra, com aviso explícito antes do cancelamento. Se a nova reserva falhar, o sistema informa que a anterior permanece cancelada.

## Erros e proteção

Validação aparece junto ao campo e em resumo acessível. Horário ocupado devolve mensagem orientando escolher outro. Botão de salvar fica bloqueado durante envio. Falha de leitura oferece Tentar novamente sem perder filtros.

Timeout de escrita tem resultado incerto: informar que a confirmação não chegou e consultar o resultado usando a chave da operação; não afirmar que houve falha nem repetir com uma chave nova. O formulário permanece preenchido. Nenhuma mensagem mostra stack trace ou detalhes do banco.

Sem login, a seleção da empresa é contexto operacional e não controle de acesso de usuários. O isolamento das consultas e vínculos entre empresas continua obrigatório na API. A implantação com acesso público e dados reais exigiria uma decisão de autenticação fora do escopo da aula.

## Fora da primeira entrega

Pagamentos, estoque, comissões, WhatsApp automático, login e reservas pelo próprio cliente foram descartados para concentrar a entrega na recepção. Não adicionar gráficos financeiros sem dados e problema de uso demonstrável.

## Ensaio de aceite

Com duas empresas, um colega deve conseguir escolher uma, encontrar cliente por telefone parcial, cadastrar outro sem sair do agendamento, reservar horário, visualizar pendência, finalizar e trocar de empresa sem ver os dados da anterior. Também deve entender um conflito, um atraso e uma API indisponível sem orientação do autor.
