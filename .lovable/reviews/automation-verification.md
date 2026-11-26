# Verificação da correção

## Regra
A automação deve guardar o progresso sem deixar usuários para trás; toda geração manual de imagem deve receber o formato escolhido e avisar quando falhar.

## Caminhos lidos e corrigidos
- Disparador automático: trocado o processamento de todos os usuários numa chamada por fila persistente, ordem justa e despacho limitado. O agendador existente permanece a cada 15 minutos, sem alteração de frequência ou credenciais.
- Geração de artigos: a entrada manual passa a enfileirar; pesquisa, texto, salvamento e imagem passam a executar em chamadas independentes. Provedores e limites de texto existentes foram preservados.
- Banco: funções de enfileirar, assumir trava, avançar etapa, salvar artigo e despachar próxima etapa foram criadas e lidas. A gravação do artigo e a marcação de progresso são atômicas. Tarefas com trava expirada ficam pausadas para conferência, sem repetir resultados desconhecidos. Publicação de artigos prontos tem faixa independente das pausas de geração.
- Pesquisa de fontes, análise de fatos, busca de fotos, referências e YouTube: arquivos lidos; recebem o orçamento da etapa por contexto de execução. Fora das etapas automáticas, mantêm o comportamento anterior.
- Imagem automática: etapa separada, formato preservado, verificação da tarefa e trava antes de gerar; não substitui imagem já salva nem altera artigo publicado.
- Artigos: lidas geração comum, por título, por categoria, imagens em lote e edição/envio individual. As chamadas de imagens já enviavam formato. Novo progresso mostra etapas e motivo de pausa; retomada só disponível quando o resultado não é desconhecido.
- Tendências e busca viral administrativa: chamadas lidas; já informam início de geração e continuam compatíveis com enfileiramento.
- Dashboard e botão global: chamadas lidas; mensagens corrigidas para não afirmar que um artigo já foi gerado quando está na fila, e Dashboard agora verifica erros retornados.
- Base de conhecimento: escolha explícita de formato, encaminhamento compartilhado e aviso visível de falhas corrigidos anteriormente neste atendimento.

## Validação observada
- 25 testes passaram: formatos, referências, pausas por 402/403/429, recusa em HTTP 200, resultado desconhecido, prazo vencido, ordem justa e chamadas fora da automação.
- Fluxo autenticado da fila real percorreu apuração, texto, salvamento e imagem em modo de validação e mostrou Concluída na tela.
- Salvamento real com conteúdo interno de teste: duas chamadas simultâneas produziram somente um artigo, sem aprovação de publicação; leitura confirmada na tela de Artigos.
- Outro usuário de validação avançou independentemente; uma trava expirada ficou pausada com resultado desconhecido.
- Artigo e tarefas temporários foram removidos após o teste. Nenhuma publicação real foi alterada ou enviada.
- As funções foram implantadas e os registros locais de compilação mostram sucesso.

## Ainda não observado
Os próximos ciclos naturais do agendador e geração completa com provedores reais ainda não foram acompanhados após a implantação; o acesso/saldo dos provedores continua sendo uma condição externa. A infraestrutura de fila e salvamento foi validada sem consumir geração nem publicar.