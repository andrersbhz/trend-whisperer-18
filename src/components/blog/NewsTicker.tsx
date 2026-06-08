import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TickerItem {
  id: string;
  title: string;
  slug?: string;
  category?: string;
}

const NewsTicker = ({ items, currentLang }: { items: TickerItem[]; currentLang: string }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div className="bg-[hsl(var(--news-navy-deep))] text-white border-b border-white/10">
      <div className="news-container flex items-center gap-4 h-10 overflow-hidden">
        <span className="news-kicker bg-[hsl(var(--news-accent))] text-white px-3 py-1 flex-shrink-0">
          AO VIVO
        </span>
        <span className="news-kicker text-white/60 hidden sm:inline flex-shrink-0">
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="news-ticker-track flex gap-10 whitespace-nowrap">
            {loop.map((it, i) => (
              <a
                key={`${it.id}-${i}`}
                href={`/${currentLang}/article/${it.slug || it.id}`}
                className="news-kicker text-white/85 hover:text-white transition-colors"
              >
                <span className="text-[hsl(var(--news-accent))] mr-2">●</span>
                {it.title}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const useNewsTicker = (limit = 12) => {
  const [items, setItems] = useState<TickerItem[]>([]);
  useEffect(() => {
    let mounted = true;
    supabase
      .from('articles')
      .select('id, title, slug, category')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        if (mounted && data) setItems(data as TickerItem[]);
      });
    return () => {
      mounted = false;
    };
  }, [limit]);
  return items;
};

export default NewsTicker;
