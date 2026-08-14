# Plano: Customização de Interface e Cores Editáveis

O objetivo é adicionar controles avançados de interface no painel de administração, permitindo ao administrador ajustar o arredondamento dos botões, efeitos de hover e cores das fontes em todo o sistema.

## Alterações Técnicas

### Banco de Dados (Supabase)
- Adição de colunas na tabela `platform_settings`:
  - `button_radius`: Controle de arredondamento (`border-radius`).
  - `button_hover_style`: Estilo visual do hover (ex: brilho neon, contorno, escala).
  - `font_color_base`: Cor principal dos textos.
  - `font_color_muted`: Cor de textos secundários/suaves.

### Frontend (React/Tailwind)
- **Hooks & Contexto**:
  - Atualização do `usePlatformSettings.ts` para carregar as novas variáveis.
  - Expansão do `ThemeProvider.tsx` para injetar essas variáveis como propriedades CSS (`--radius`, `--font-base`, `--font-muted`, etc.) no `documentElement`.
- **Componentes de Configuração**:
  - Modificação da `BrandingPage.tsx` para incluir seletores de cores de fontes e controles de botões.
  - Atualização do `AppearancePaletteSettings.tsx` para permitir ajustes rápidos de estilo de interface.
- **Estilos Globais**:
  - Refatoração do `src/index.css` para utilizar as variáveis dinâmicas injetadas pelo provider, garantindo que as mudanças reflitam em todos os componentes Shadcn UI e customizados.

### Segurança
- Manutenção das políticas RLS para garantir que apenas administradores possam alterar as configurações de interface.
