import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BlogCategory } from '@/components/blog/BlogCategoryNav';

interface UseBlogCategoriesResult {
  categories: BlogCategory[];
  loading: boolean;
  error: string | null;
}

export const useBlogCategories = (): UseBlogCategoriesResult => {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('category')
          .eq('status', 'published')
          .not('category', 'is', null);

        if (!mounted) return;
        if (error) throw error;

        const unique = Array.from(new Set((data ?? []).map((d) => d.category as string)))
          .map((cat) => ({ id: cat.toLowerCase().replace(/\s+/g, '-'), label: cat }));
        setCategories(unique);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar categorias');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { categories, loading, error };
};
