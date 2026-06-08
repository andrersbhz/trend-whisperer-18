import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BlogCategory } from '@/components/blog/BlogCategoryNav';

export const useBlogCategories = () => {
  const [categories, setCategories] = useState<BlogCategory[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('articles')
        .select('category')
        .eq('status', 'published')
        .not('category', 'is', null);

      if (!mounted || !data) return;
      const unique = Array.from(new Set(data.map((d) => d.category as string)))
        .map((cat) => ({ id: cat.toLowerCase().replace(/\s+/g, '-'), label: cat }));
      setCategories(unique);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return categories;
};
