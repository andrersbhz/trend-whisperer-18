# Plano de Ação - Localização e Ajustes Visuais

Melhorar a consistência da localização em Português (PT-BR) em todo o sistema e aplicar ajustes visuais solicitados, garantindo que todas as respostas e interfaces sigam a instrução do usuário.

## Alterações Propostas

### 1. Interface e Localização (PT-BR)
- **Dashboard**: Atualizar a mensagem do Preloader para "Carregando dados, aguarde..." (com capitalização e pontuação corretas).
- **Consistência**: Verificar e ajustar quaisquer termos residuais em inglês nas páginas de Administração e Vendas.

### 2. Edição de Texto Visual (Solicitação Verbatim)
- **Elemento Span**: Aplicar a substituição do caractere separador invisível (`\u2063` por `\u2063`) conforme solicitado, tratando-o como texto de exibição literal.

### 3. Verificação de Funcionalidades Críticas
- **Pix Dinâmico**: Confirmar que o valor do produto é capturado e injetado corretamente no QR Code e no código "Copia e Cola".
- **Modelos de IA**: Garantir que a seleção dinâmica de modelos (Gemini, OpenAI, Groq) esteja refletida corretamente na interface de configurações.

## Detalhes Técnicos

### Arquivos a serem modificados:
- `src/pages/Dashboard.tsx`: Ajuste na mensagem de carregamento.
- `src/components/DashboardLayout.tsx`: Revisão de labels de navegação se necessário.

### Instrução de Idioma:
- Todas as interações futuras com o usuário serão realizadas exclusivamente em **Português (PT-BR)**, conforme solicitado no arquivo `VOIDPRO-6.md`.
