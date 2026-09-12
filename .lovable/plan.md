# Plano: Presets e personalização visual no painel administrativo

## Resultado
Adicionar ao editor **Marca / Vendas** cinco combinações modernas de cores e uma opção **Personalizado**, mantendo todos os controles manuais existentes e sem alterar funções do sistema.

## Implementação
- Criar cinco presets completos para sistema e página de vendas, com amostras visuais e nomes claros.
- Adicionar o modo **Personalizado**, preservando a edição individual de todas as cores, fontes, formas e sombras já disponível.
- Ao selecionar um preset, preencher a prévia sem salvar automaticamente; a alteração só será aplicada pelo botão **Salvar visual**.
- Incluir configuração de borda com hover neon, usando as cores do tema selecionado e movimento suave com respeito à preferência de animação reduzida.
- Disponibilizar o acesso ao editor visual também nas configurações do painel administrativo, mantendo a mesma proteção de administrador existente.
- Manter o tema atual como padrão e preservar configurações salvas anteriormente.

## Detalhes técnicos
- Estender `BrandThemeSettings` de forma retrocompatível com as opções de preset e borda neon.
- Aplicar os novos valores por tokens visuais globais em `BrandThemeRuntime`, sem mexer em regras de negócio.
- Atualizar somente o editor visual e sua apresentação no painel administrativo.
- Validar compilação e conferir visualmente os presets, o modo personalizado e o hover neon.
