import { Link } from 'react-router-dom';
import { Calendar, User } from 'lucide-react';
import { isVideoUrl } from '@/lib/utils';
import { formatRelative } from '@/lib/date';

interface CategorySectionProps {
  category: string;
  articles: any[];
  currentLang: string;
  accentColor?: string;
}

interface SuperCardProps {
  article: any;
  currentLang: string;
  accentColor: string;
  size: 'lead' | 'small';
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d';

const SuperCard = ({ article, currentLang, accentColor, size }: SuperCardProps) => {
  const href = `/${currentLang}/article/${article.slug || article.id}`;
  const category = article.category || 'Geral';
  const date = formatRelative(article.created_at);
  const authorName = article.author_name || 'Redação';
  const src = article.featured_image_url || FALLBACK_IMG;
  const video = isVideoUrl(src);

  const isLead = size === 'lead';

  return (
    <article
      className="group relative bg-white border border-[hsl(var(--news-line))] overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow"
    >
      <Link
        to={href}
        className="flex flex-col h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--news-navy))]"
      >
        {/* Image area with overlaid title */}
        <div
          className={`relative w-full overflow-hidden bg-[hsl(var(--news-navy-deep))] ${
            isLead ? 'aspect-[3/4] sm:aspect-[4/5]' : 'aspect-[4/3]'
          }`}
        >
          {video ? (
            <video
              src={src}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
              src={src}
              alt={article.title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMG;
              }}
            />
          )}

          {/* Category badge (top right) */}
          <span
            className="absolute top-2 right-2 z-10 px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white"
            style={{ background: accentColor }}
          >
            {category}
          </span>

          {/* Gradient + title overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className={`absolute bottom-0 left-0 right-0 p-3 ${isLead ? 'sm:p-5' : 'sm:p-3'}`}>
            <h3
              className={`news-headline text-white line-clamp-4 ${
                isLead
                  ? 'text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight'
                  : 'text-sm sm:text-base leading-snug line-clamp-3'
              }`}
            >
              {article.title}
            </h3>
          </div>
        </div>

        {/* Meta footer */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] sm:text-xs text-[hsl(var(--news-muted))] border-t border-[hsl(var(--news-line))] bg-white">
          <span className="inline-flex items-center gap-1 min-w-0">
            <Calendar
              className="w-3 h-3 flex-shrink-0"
              style={{ color: accentColor }}
              aria-hidden="true"
            />
            <time className="truncate">{date}</time>
          </span>
          <span className="inline-flex items-center gap-1 min-w-0">
            <User className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{authorName}</span>
          </span>
        </div>
      </Link>
    </article>
  );
};

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
  const items = sorted.slice(0, 6);

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
          className="news-kicker text-[hsl(var(--news-navy))] hover:text-[hsl(var(--news-accent))] inline-flex items-center gap-1 transition-colors min-h-11 px-2"
          aria-label={`Ver todas as matérias de ${category}`}
          style={{ color: accentColor }}
        >
          Ver mais →
        </Link>
      </div>

      {/* Grid: 3 colunas × 2 linhas = 6 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {items.map((article) => (
          <SuperCard
            key={article.id}
            article={article}
            currentLang={currentLang}
            accentColor={accentColor}
            size="small"
          />
        ))}
      </div>
    </section>
  );
};

export default CategorySection;
