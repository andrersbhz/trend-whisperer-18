import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';
import BlogHeader from '@/components/blog/BlogHeader';
import BlogFooter from '@/components/blog/BlogFooter';
import NewsImage from '@/components/blog/NewsImage';
import CategorySection from '@/components/blog/CategorySection';
import NewsTicker, { useNewsTicker } from '@/components/blog/NewsTicker';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Preloader from '@/components/Preloader';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

const CATEGORY_ACCENTS: Record<string, string> = {
  default: 'hsl(var(--news-accent))',
  notícias: '#C4170C',
  noticias: '#C4170C',
  esportes: '#06AA48',
  entretenimento: '#FF8000',
  tecnologia: '#0669B2',
  saúde: '#00A1AB',
  saude: '#00A1AB',
};

const getAccent = (cat: string) => {
  const k = cat.toLowerCase();
  return (
    Object.entries(CATEGORY_ACCENTS).find(([key]) => k.includes(key))?.[1] ??
    CATEGORY_ACCENTS.default
  );
};

const formatRelative = (date: string) => {
  try {
    const diff = (Date.now() - new Date(date).getTime()) / 60000;
    if (diff < 60) return `há ${Math.max(1, Math.round(diff))} min`;
    if (diff < 1440) return `há ${Math.round(diff / 60)}h`;
    return new Date(date).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

const BlogHome = () => {
  const { lang } = useParams();
  const { currentLang } = useI18n();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tickerItems = useNewsTicker(15);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 }, [
    Autoplay({ delay: 6000, stopOnInteraction: false }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) console.error(error);
      setArticles(data || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [lang, currentLang]);

  const featured = useMemo(() => articles.slice(0, 5), [articles]);
  const sidebar = useMemo(() => articles.slice(5, 11), [articles]);
  const grouped = useMemo(() => {
    return articles.reduce<Record<string, any[]>>((acc, a) => {
      const cat = a.category || 'Geral';
      (acc[cat] ||= []).push(a);
      return acc;
    }, {});
  }, [articles]);

  if (loading) return <Preloader message="Sincronizando as últimas notícias..." />;

  const siteTitle = 'A3 Portal — Notícias, Esportes e Entretenimento';
  const siteDesc =
    'Portal de notícias A3: últimas notícias, esportes, tecnologia, entretenimento e mais — atualizado em tempo real.';

  return (
    <div className="min-h-dvh bg-[hsl(var(--news-paper))] text-[hsl(var(--news-ink))] font-news antialiased">
      <Helmet>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDesc} />
        <link rel="canonical" href={window.location.origin + window.location.pathname} />
      </Helmet>

      <BlogHeader />
      <NewsTicker items={tickerItems} currentLang={currentLang} />

      <main id="main-content" className="news-container py-6 lg:py-10">
        {articles.length === 0 ? (
          <div className="py-24 text-center">
            <h2 className="news-display text-5xl uppercase text-[hsl(var(--news-navy))]">
              Sem manchetes no momento
            </h2>
            <p className="text-[hsl(var(--news-muted))] mt-3">
              Novas notícias aparecerão aqui assim que publicadas.
            </p>
          </div>
        ) : (
          <>
            {/* HERO: slider + sidebar */}
            <section className="mb-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Slider */}
                <div className="lg:col-span-8 relative">
                  <div className="overflow-hidden bg-[hsl(var(--news-navy-deep))]" ref={emblaRef}>
                    <div className="flex">
                      {featured.map((article) => (
                        <div
                          key={article.id}
                          className="flex-[0_0_100%] min-w-0 relative group"
                        >
                          <Link
                            to={`/${currentLang}/article/${article.slug || article.id}`}
                            className="block relative focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--news-accent))]"
                          >
                            <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
                              <img
                                src={
                                  article.featured_image_url ||
                                  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'
                                }
                                alt={article.title}
                                loading="eager"
                                className="w-full h-full object-cover news-card-img"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10 text-white">
                                <span
                                  className="news-kicker inline-block px-3 py-1.5 mb-4 text-white"
                                  style={{ background: getAccent(article.category || '') }}
                                >
                                  {article.category || 'Destaque'}
                                </span>
                                <h2 className="news-headline text-2xl sm:text-4xl lg:text-5xl max-w-4xl mb-3 group-hover:underline decoration-2 underline-offset-4">
                                  {article.title}
                                </h2>
                                <p className="hidden sm:block text-white/85 line-clamp-2 max-w-2xl mb-3">
                                  {article.meta_description}
                                </p>
                                <div className="flex items-center gap-2 news-kicker text-white/70">
                                  <Clock className="w-3 h-3" />
                                  {formatRelative(article.created_at)}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>

                  {featured.length > 1 && (
                    <>
                      <button
                        onClick={scrollPrev}
                        aria-label="Notícia anterior"
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-[hsl(var(--news-accent))] backdrop-blur flex items-center justify-center text-white transition-all z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={scrollNext}
                        aria-label="Próxima notícia"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-[hsl(var(--news-accent))] backdrop-blur flex items-center justify-center text-white transition-all z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-4 right-4 flex gap-1.5 z-10">
                        {featured.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => emblaApi?.scrollTo(i)}
                            aria-label={`Ir para slide ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                              selectedIndex === i
                                ? 'bg-white w-8'
                                : 'bg-white/40 hover:bg-white/70 w-3'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Sidebar — Últimas Notícias */}
                <aside className="lg:col-span-4">
                  <div className="bg-white border border-[hsl(var(--news-line))] h-full">
                    <div className="bg-[hsl(var(--news-navy))] text-white px-4 py-3 flex items-center justify-between">
                      <h3 className="news-kicker text-sm">Últimas Notícias</h3>
                      <span className="w-2 h-2 rounded-full bg-[hsl(var(--news-accent))] animate-pulse" />
                    </div>
                    <ul className="divide-y divide-[hsl(var(--news-line))]">
                      {sidebar.map((article, idx) => (
                        <li key={article.id}>
                          <Link
                            to={`/${currentLang}/article/${article.slug || article.id}`}
                            className="flex gap-3 p-4 hover:bg-[hsl(var(--news-paper))] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--news-navy))] focus-visible:ring-inset"
                          >
                            <span className="news-display text-3xl text-[hsl(var(--news-blue))]/60 leading-none w-6 flex-shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span
                                className="news-kicker"
                                style={{ color: getAccent(article.category || '') }}
                              >
                                {article.category || 'Geral'}
                              </span>
                              <h4 className="news-headline text-sm mt-1 line-clamp-3 text-[hsl(var(--news-ink))] group-hover:text-[hsl(var(--news-navy))] transition-colors">
                                {article.title}
                              </h4>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              </div>
            </section>

            {/* Category sections */}
            <div>
              {Object.entries(grouped).map(([cat, arts]) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  articles={arts}
                  currentLang={currentLang}
                  accentColor={getAccent(cat)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <BlogFooter />
    </div>
  );
};

export default BlogHome;
