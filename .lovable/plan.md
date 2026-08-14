# Plano: Adição de Múltiplos Blogs e Métricas por Blog

O objetivo é permitir que o usuário cadastre múltiplos blogs (instâncias do WordPress) e visualize métricas específicas para cada um deles. Atualmente, o sistema parece suportar apenas uma configuração de WordPress por usuário.

## Alterações Sugeridas

### Banco de Dados (Supabase)
- Criar a tabela `user_blogs` para armazenar as credenciais de múltiplos sites WordPress.
- Adicionar políticas de RLS e GRANTs necessários.
- Migrar os dados existentes da `user_settings` (campos `wordpress_*`) para a nova tabela (opcional, mas recomendado para consistência).

### Frontend
- **Configurações**: Criar uma nova aba ou seção "Meus Blogs" para listar, adicionar, editar e remover blogs.
- **Navegação**: Adicionar um seletor de blog global ou específico nas páginas de Analytics e Artigos.
- **Página de Analytics**: Ajustar a página de métricas para filtrar os dados com base no blog selecionado.
- **Geração de Artigos**: Permitir escolher para qual blog o artigo será gerado/agendado.

## Detalhes Técnicos

### 1. Migração SQL
```sql
CREATE TABLE public.user_blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    wordpress_url TEXT NOT NULL,
    wordpress_username TEXT NOT NULL,
    wordpress_app_password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_blogs TO authenticated;
GRANT ALL ON public.user_blogs TO service_role;

ALTER TABLE public.user_blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blogs"
ON public.user_blogs
FOR ALL
TO authenticated
USING (auth.uid() = user_id);
```

### 2. Interface de Usuário
- Criar o componente `src/components/blogs/BlogManager.tsx`.
- Atualizar `src/pages/SettingsPage.tsx` para incluir o gerenciador de blogs.
- Atualizar `src/pages/AnalyticsPage.tsx` para aceitar um `blog_id` como filtro.
