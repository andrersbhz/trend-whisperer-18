# Automação sem interrupções por tempo limite

## Problema confirmado
A automação reúne todos os usuários numa única execução. O limite de 90 segundos protege somente a publicação; tendências e geração continuam sem prazo depois dele. A geração limita o lote a dois artigos e verifica 70 segundos antes do segundo, mas não limita o tempo somado de pesquisa, provedores e imagens dentro de um artigo. Os registros recentes mostram uma execução concluída, mas o código ainda permite os estouros relatados.

Não basta interromper uma chamada: ela pode continuar trabalhando e gerar duplicatas numa tentativa seguinte. A correção precisa controlar trabalho em andamento e retomar com segurança.

## O que será feito
1. Separar o trabalho de cada usuário numa fila persistente, com distribuição justa; usuários posteriores não dependerão de terminar todos os anteriores na mesma chamada.
2. Executar etapas pequenas: publicação, tendências, pesquisa, texto e imagem, com limites de tempo e quantidade por execução. Guardar o progresso entre etapas.
3. Garantir uma única execução por tarefa com trava temporária e impedir repetição de artigos ou imagens já concluídos.
4. Pausar a geração em bloqueios de acesso, saldo ou recusas do provedor; mostrar a causa e exigir recuperação apropriada antes de retomar.
5. Exibir tarefas pendentes, pausadas e concluídas, preservando as preferências de horários, categorias, idiomas, formatos e os provedores atuais com chaves próprias/9Router.

## Detalhes técnicos
- Manter React e as funções existentes; adicionar fila e controle de etapas no banco com acesso protegido.
- O disparador agenda trabalho deduplicado, em vez de aguardar geração de todos os usuários. Um trabalhador processa lote pequeno com lease expirável.
- Verificar o prazo global antes de cada etapa; chamadas externas recebem prazo limitado ao tempo restante e reserva para salvar progresso.
- Separar a geração longa em etapas retomáveis, sem reduzir limites de texto nem trocar modelos. Resultado desconhecido não é repetido automaticamente.
- Consultar pausa em todos os disparadores e trabalhadores. Aplicar cooldown e limite de iterações se houver encadeamento.
- Não alterar artigos já publicados, conexões, permissões existentes nem configurações do usuário.

## Validação
- Testar distribuição entre vários usuários, expiração de trava, retomada sem duplicação, pausa por bloqueio e término dentro do prazo.
- Conferir uma execução autenticada de ponta a ponta com publicação desabilitada e acompanhar os próximos ciclos reais antes de encerrar o alerta.

## Segundo alerta: imagem da base de conhecimento
Correção já aplicada: seleção explícita de formato na tela, envio à função de imagem e aviso quando a imagem falha, sem perder o artigo salvo. Quinze testes passaram. A tela foi validada com material e resposta simulados, e a função publicada rejeitou formato ausente com HTTP 400. Não foi gerada imagem real nem publicado artigo nesta verificação.

## Regra e caminhos revisados
- **Regra:** toda geração manual deve usar o formato escolhido e informar se a imagem falhou; a automação deve concluir ou guardar progresso sem deixar usuários para trás.
- **Imagens:** código lido em Artigos (lote), envio/edição de imagem individual, seletor/modal de formato, criação pela base de conhecimento, regeneração e geração automática. Lote e individual já enviam formato; automática usa o formato configurado. A base de conhecimento era a chamada sem formato e foi corrigida. O serviço de regeneração mantém a validação obrigatória.
- **Automação:** código lido no disparador `auto-pipeline` e em `generate-articles`. Ambos precisam da reorganização deste plano; não foram modificados nesta etapa. O limite de lote existente não cobre o tempo total.
- Não há outra chamada de `regenerate-image` nas funções ou telas pesquisadas. A configuração ativa do agendador no banco ainda precisa ser conferida durante a implementação; não foi alterada.