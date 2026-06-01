import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';
import BlogHeader from '@/components/blog/BlogHeader';
import BlogFooter from '@/components/blog/BlogFooter';
import NewsImage from '@/components/blog/NewsImage';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Preloader from '@/components/Preloader';
import useEmblaCarousel from 'embla-carousel-react';

const AdPlaceholder = ({ className }: { className?: string }) => (
  <div className={`bg-muted/30 border border-dashed border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${className}`}>
    Espaço Publicitário (Google AdSense)
  </div>
);

const BlogHome = () => {
  const { currentLang } = useI18n();
  const [featuredArticles, setFeaturedArticles] = useState<any[]>([]);
  const [sidebarArticles, setSidebarArticles] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: articles, error } = await supabase
          .from('articles')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          setLoading(false);
          return;
        }

        if (articles) {
          // The banner will show the 4 latest articles in a slider
          setFeaturedArticles(articles.slice(0, 4));
          // Sidebar shows the same or the next 4? Usually, the user wants the "latest news" column.
          // Let's show the next 4 for variety, or the same 4 if they want a summary.
          // Re-reading: "coluna do lado direito com as 4 ultimas noticias".
          // I'll use the next 4 (4 to 8) so the user sees more content.
          setSidebarArticles(articles.slice(4, 8));
          
          const grouped = articles.reduce((acc: any, article) => {
            const cat = article.category || 'Geral';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(article);
            return acc;
          }, {});
          setCategoriesData(grouped);
        }
      } catch (error) {
        console.error('Error fetching blog data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentLang]);

  if (loading) return <Preloader message="Sincronizando as últimas notícias..." />;

  const siteTitle = 'A3 BLOG - Absolutamente tudo sobre notícias, esportes e entretenimento';
  const siteDesc = 'No A3 BLOG você encontra tudo sobre as últimas notícias, esportes, entretenimento e muito mais.';
  const siteKeywords = 'notícias, esportes, entretenimento, a3 blog, brasil';

  return (
    <div className="min-h-screen bg-white text-black selection:bg-primary/20 font-sans antialiased">
      <Helmet>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDesc} />
        <meta name="keywords" content={siteKeywords} />
        <link rel="canonical" href={window.location.origin + window.location.pathname} />
      </Helmet>
      
      <BlogHeader />
      
      <main className="max-w-[1200px] mx-auto px-4 lg:px-0 py-4">
        {/* Main Highlight Section with Sidebar */}
        <section className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Slider (Left) */}
            <div className="lg:col-span-8 relative">
              <div className="overflow-hidden rounded-sm" ref={emblaRef}>
                <div className="flex">
                  {featuredArticles.map((article, index) => (
                    <div key={article.id} className="flex-[0_0_100%] min-w-0 relative group">
                      <Link to={`/${currentLang}/article/${article.slug || article.id}`} className="block relative">
                        <div className="relative h-[400px] sm:h-[600px] lg:h-[800px] overflow-hidden">
                          <img 
                            src={article.featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                          
                          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 text-white">
                            <span className="inline-block px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-widest mb-4">
                              {article.category || 'Destaque'}
                            </span>
                            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-4 leading-[1.05] tracking-tighter max-w-4xl group-hover:underline underline-offset-4 decoration-primary">
                              {article.title}
                            </h2>
                            <p className="text-gray-200 text-sm sm:text-base line-clamp-2 max-w-2xl font-medium hidden sm:block">
                              {article.meta_description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slider Controls (Internal) */}
              {featuredArticles.length > 1 && (
                <>
                  <button 
                    onClick={scrollPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-all z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={scrollNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center text-white transition-all z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Latest News Sidebar (Right) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#333] border-l-4 border-primary pl-3">Últimas Notícias</h3>
                <div className="flex gap-1">
                  {featuredArticles.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => emblaApi?.scrollTo(index)}
                      className={`h-1 rounded-full transition-all ${selectedIndex === index ? 'bg-primary w-4' : 'bg-gray-200 w-2'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-4 flex-grow">
                {sidebarArticles.map((article) => (
                  <article key={article.id} className="group border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <Link to={`/${currentLang}/article/${article.slug || article.id}`} className="flex gap-4">
                      <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-sm">
                        <img 
                          src={article.featured_image_url} 
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-primary uppercase mb-1">{article.category || 'Geral'}</span>
                        <h4 className="text-sm font-bold leading-tight group-hover:text-primary transition-colors line-clamp-3 text-[#333]">
                          {article.title}
                        </h4>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
              <AdPlaceholder className="w-full h-[150px] bg-gray-50 mt-auto" />
            </div>
          </div>
        </section>

        {/* Dynamic Category Blocks */}
        <div className="mt-12 space-y-16">
          {Object.entries(categoriesData)
            .filter(([_, arts]: [any, any]) => arts.length >= 1)
            .map(([category, articles]: [string, any]) => {
              // Standard system colors/styles based on category
              const getCategoryStyle = (cat: string) => {
                const lowerCat = cat.toLowerCase();
                if (lowerCat.includes('notícia') || lowerCat.includes('news')) return { color: '#C4170C', label: 'notícias' };
                if (lowerCat.includes('esport') || lowerCat.includes('ge')) return { color: '#06AA48', label: 'esportes' };
                if (lowerCat.includes('entreten') || lowerCat.includes('gshow')) return { color: '#FF8000', label: 'entretenimento' };
                if (lowerCat.includes('tecnolog')) return { color: '#0669B2', label: 'tecnologia' };
                if (lowerCat.includes('saúde') || lowerCat.includes('saude')) return { color: '#00A1AB', label: 'saúde' };
                return { color: '#333333', label: lowerCat };
              };

              const style = getCategoryStyle(category);

              return (
                <section key={category} className="border-t border-gray-100 pt-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <h2 style={{ color: style.color }} className="text-2xl font-black lowercase tracking-tighter">
                        {style.label}
                      </h2>
                    </div>
                    <Link 
                      to={`/${currentLang}/category/${category.toLowerCase()}`} 
                      className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase tracking-widest"
                    >
                      Ver tudo <ChevronRight className="inline-block w-3 h-3 ml-1" />
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {/* Featured in category */}
                    <div className="lg:col-span-2">
                      <article className="group">
                        <Link to={`/${currentLang}/article/${articles[0].slug || articles[0].id}`}>
                          <div className="relative mb-4 overflow-hidden rounded-sm">
                            <NewsImage 
                              src={articles[0].featured_image_url} 
                              alt={articles[0].title}
                              aspectRatio="hero"
                              className="group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                          <h3 className="text-2xl font-bold leading-tight group-hover:text-primary transition-colors mb-2 text-[#333]">
                            {articles[0].title}
                          </h3>
                          <p className="text-[#666] leading-snug line-clamp-2">
                            {articles[0].meta_description}
                          </p>
                        </Link>
                      </article>
                    </div>

                    {/* List in category */}
                    <div className="space-y-6">
                      {articles.slice(1, 4).map((article: any) => (
                        <article key={article.id} className="group pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                          <Link to={`/${currentLang}/article/${article.slug || article.id}`} className="flex gap-4">
                            <div className="w-24 h-24 flex-shrink-0 relative overflow-hidden rounded-sm">
                              <NewsImage 
                                src={article.featured_image_url} 
                                alt={article.title}
                                aspectRatio="square"
                                className="group-hover:scale-110 transition-transform duration-500"
                              />
                            </div>
                            <div className="flex flex-col justify-center">
                              <h4 className="text-[15px] font-bold leading-tight group-hover:text-primary transition-colors line-clamp-3 text-[#333]">
                                {article.title}
                              </h4>
                            </div>
                          </Link>
                        </article>
                      ))}
                      {articles.length < 2 && (
                        <div className="h-full flex items-center justify-center border border-dashed border-gray-100 rounded-sm p-8 bg-gray-50/50">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Destaque da categoria</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
        </div>
      </main>

      <BlogFooter />
    </div>
  );
};

export default BlogHome;
