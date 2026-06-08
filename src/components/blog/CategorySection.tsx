import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import NewsImage from './NewsImage';

interface CategorySectionProps {
  category: string;
  articles: any[];
  currentLang: string;
  accentColor?: string;
}

const formatDate = (date: string) => {
  try {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '';
  }
};

const CategorySection = ({ category, articles, currentLang, accentColor = 'hsl(var(--news-accent))' }: CategorySectionProps) => {
  if (!articles || articles.length === 0) return null;

  const sorted = [...articles].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const items = sorted.slice(0, 4);
  const [lead, ...rest] = items;
  const slug = category.toLowerCase().replace(/\s+/g, '-');

  return (
    <section className="py-10 border-t border-[hsl(var(--news-line))]" aria-labelledby={`cat-${slug}`}>
      <div className="flex items-end justify-between mb-7">
        <div className="flex items-center gap-4">
          <span
            className="inline-block w-1.5 h-9"
            style={{ background: accentColor }}
            aria-hidden="true"
          />
          <h2
            id={`cat-${slug}`}
            className="news-display text-4xl md:text-5xl uppercase text-[hsl(var(--news-ink))]"
          >
            {category}
          </h2>
        </div>
        <Link
          to={`/${currentLang}/category/${slug}`}
          className="news-kicker text-[hsl(var(--news-navy))] hover:text-[hsl(var(--news-accent))] inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--news-navy))] focus-visible:ring-offset-2 rounded"
        >
          Ver mais <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Lead article */}
        <article className="lg:col-span-7 group news-card-hover">
          <Link
            to={`/${currentLang}/article/${lead.slug || lead.id}`}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--news-navy))] focus-visible:ring-offset-4"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[hsl(var(--news-paper))] mb-4">
              <NewsImage
                src={lead.featured_image_url}
                alt={lead.title}
                aspectRatio="hero"
                className="news-card-img w-full h-full"
              />
              <span
                className="absolute top-4 left-4 news-kicker text-white px-3 py-1.5"
                style={{ background: accentColor }}
              >
                Destaque
              </span>
            </div>
            <h3 className="news-headline text-2xl md:text-3xl text-[hsl(var(--news-ink))] group-hover:text-[hsl(var(--news-navy))] transition-colors line-clamp-3 mb-2">
              {lead.title}
            </h3>
            <p className="font-news text-[hsl(var(--news-muted))] line-clamp-2 mb-2">
              {lead.meta_description}
            </p>
            <span className="news-kicker text-[hsl(var(--news-muted))]">
              {formatDate(lead.created_at)}
            </span>
          </Link>
        </article>

        {/* Secondary articles */}
        <div className="lg:col-span-5 flex flex-col divide-y divide-[hsl(var(--news-line))]">
          {rest.map((article) => (
            <article key={article.id} className="group py-4 first:pt-0 last:pb-0 news-card-hover">
              <Link
                to={`/${currentLang}/article/${article.slug || article.id}`}
                className="flex gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--news-navy))] focus-visible:ring-offset-2"
              >
                <div className="w-28 h-20 sm:w-32 sm:h-24 flex-shrink-0 overflow-hidden bg-[hsl(var(--news-paper))]">
                  <NewsImage
                    src={article.featured_image_url}
                    alt={article.title}
                    aspectRatio="square"
                    className="news-card-img w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="news-headline text-base sm:text-lg text-[hsl(var(--news-ink))] group-hover:text-[hsl(var(--news-navy))] transition-colors line-clamp-3">
                    {article.title}
                  </h4>
                  <span className="news-kicker text-[hsl(var(--news-muted))] mt-1.5 block">
                    {formatDate(article.created_at)}
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
