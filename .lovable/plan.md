# Plano de Melhoria Visual e Correção de Contrastes

Este plano detalha as ações para garantir que o sistema siga padrões rigorosos de UX/UI, com foco em contrastes acessíveis, legibilidade e padronização visual neon (Verde Limão e Lilás Neon) sobre fundo preto absoluto.

## Alterações Visuais e UX/UI

### 1. Padronização Global de Cores e Contrastes
- **Fundo:** Garantir que o fundo de todas as páginas e cards seja preto absoluto (`#000000`) ou grafite muito escuro para cards (`#0a0a0a`).
- **Cores de Destaque:** Uso consistente de Verde Limão (`#a3ff12`) para ações primárias e Lilás Neon (`#b57bff`) para elementos secundários e detalhes.
- **Regra de Contraste Oposta:** 
  - Fundo Escuro → Texto Branco ou Verde Limão.
  - Fundo Claro (Hover/Active) → Texto Preto Absoluto.
  - Botões brancos serão convertidos para Verde Limão com texto preto no hover.

### 2. Refinamento de Componentes e Feedback Visual
- **Botões:** Todos os botões seguirão o padrão `neon-border-cycle` com bordas que alternam entre verde e lilás.
- **Hover States:** O estado de hover será agressivo e claro: fundo sólido verde limão com texto preto, garantindo que o usuário saiba exatamente onde está clicando.
- **Inputs e Cards:** Bordas neon sutis que brilham no foco ou hover.

### 3. Correção de Erros Reportados
- **Métricas por Categoria:** Corrigir a lógica de agregação que exibe "0 ERR".
- **UX de Agendamento:** Melhorar o contraste dos botões de reagendamento para evitar texto escuro sobre fundo escuro.
- **Geração de Imagens:** Garantir que o sistema utilize o `image_prompt` das configurações de forma obrigatória, integrando o conhecimento da base de dados.

## Detalhes Técnicos

### CSS Global (`src/index.css`)
- Atualização das variáveis de tema `.dark` para reforçar o contraste.
- Implementação de classes utilitárias para "Cores Opostas" automáticas.

### Componentes de UI (`src/components/ui/button.tsx`)
- Revisão das variantes `default`, `outline` e `ghost` para seguir o novo esquema de cores.

### Páginas de Gestão
- **AdminSystemPage:** Melhorar o contraste da tabela de usuários.
- **ArticlesPage:** Ajustar o feedback de carregamento e mensagens de erro (PT-BR).

### Backend (Edge Functions)
- **generate-articles & regenerate-image:** Reforçar a leitura do `image_prompt` e integração com `knowledge_entries`.

Aguardando aprovação para iniciar a implementação de todas as correções de UX/UI solicitadas.
