# Plano para Resolver Anexação no Search Console

O usuário reportou que o sistema não está "anexando" no Search Console. Isso geralmente se refere à falta de verificação de propriedade (meta tag `google-site-verification`) ou falha no envio de sitemaps/URLs para a Indexing API.

## Alterações Propostas

### 1. Banco de Dados (Manual via UI se necessário, mas planejado aqui)
- Adicionar coluna `google_site_verification` na tabela `platform_settings`.
- Garantir permissões de leitura `anon` para este campo para que a meta tag apareça no frontend.

### 2. Frontend - Interface Administrativa
- **BrandingPage.tsx**: Adicionar um campo na seção "Identidade Visual" para o administrador inserir o código de verificação do Google Search Console.
- **usePlatformSettings.ts**: Atualizar a interface e o carregamento de dados para incluir o novo campo.

### 3. Frontend - Integração Search Console
- **App.tsx**: Utilizar o `Helmet` ou uma lógica no `index.html` (via script ou componente root) para injetar a meta tag `<meta name="google-site-verification" content="..." />` dinamicamente baseada nas configurações da plataforma.
- **index.html**: Adicionar um comentário/espaço reservado para a meta tag.

### 4. Verificação de Indexação
- Garantir que o `sitemap.xml` em `public/sitemap.xml` esteja acessível e atualizado (o arquivo atual parece estático, mas funcional).
- Revisar se a Indexing API em `GoogleIndexingSettings.tsx` está funcionando corretamente (já existem campos para Chave JSON e OAuth).

## Detalhes Técnicos
- A meta tag deve ser renderizada no `<head>` para que o rastreador do Google a encontre.
- O campo no banco deve ser `text`.

## Passo a Passo
1. Criar migração para adicionar o campo (tentar via RPC ou avisar que requer alteração no banco).
2. Atualizar o hook `usePlatformSettings`.
3. Adicionar o campo na UI de `BrandingPage`.
4. Injetar a meta tag no `App.tsx` usando os dados do hook.
