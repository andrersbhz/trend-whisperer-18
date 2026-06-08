import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import NewsCard from './NewsCard';

interface CategorySectionProps {
  category: string;
  articles: any[];
  currentLang: string;
  accentColor?: string;
}

const CategorySection = ({
  category,
  articles,
  currentLang,
  accentColor = 'hsl(var(--news-accent))',
}: CategorySectionProps) => {
  if (!articles || articles.length === 0) return null;

  const sorted = [...articles].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const items = sorted.slice(0, 4);
  const [lead, ...rest] = items;
  const slug = category.toLowerCase().replace(/\s+/g, '-');

  return (
    <section
      className="py-8 sm:py-10 border-t border-[hsl(var(--news-line))]"
      aria-labelledby={`cat-${slug}`}
    >
      <div className="flex items-end justify-between gap-4 mb-6 sm:mb-7 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            className="inline-block w-1.5 h-8 sm:h-9"
            style={{ background: accentColor }}
            aria-hidden="true"
          />
          <h2
            id={`cat-${slug}`}
            className="news-display text-3xl sm:text-4xl md:text-5xl uppercase text-[hsl(var(--news-ink))]"
          >
            {category}
          </h2>
        </div>
        <Link
          to={`/${currentLang}/category/${slug}`}
          className="news-kicker text-[hsl(var(--news-navy))] hover:text-[hsl(var(--news-accent))] inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--news-navy))] focus-visible:ring-offset-2 rounded min-h-11 px-2"
          aria-label={`Ver todas as matérias de ${category}`}
        >
          Ver mais <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-7">
          <NewsCard article={lead} currentLang={currentLang} variant="lead" accentColor={accentColor} />
        </div>
        <div className="lg:col-span-5 flex flex-col divide-y divide-[hsl(var(--news-line))]">
          {rest.map((article) => (
            <div key={article.id} className="py-4 first:pt-0 last:pb-0">
              <NewsCard
                article={article}
                currentLang={currentLang}
                variant="list"
                accentColor={accentColor}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
