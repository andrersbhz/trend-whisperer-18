import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n, languages } from '@/hooks/useI18n';
import BlogHeader from '@/components/blog/BlogHeader';
import BlogFooter from '@/components/blog/BlogFooter';
import NewsImage from '@/components/blog/NewsImage';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, TrendingUp, ChevronRight, Newspaper, ArrowRight, Share2, Facebook, Instagram, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';
import Preloader from '@/components/Preloader';

const AdPlaceholder = ({ className }: { className?: string }) => (
  <div className={`bg-muted/30 border border-dashed border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${className}`}>
    Espaço Publicitário (Google AdSense)
  </div>
);

const BlogHome = () => {
  const { currentLang } = useI18n();
  const [featuredArticles, setFeaturedArticles] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any>({});
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: articles, error } = await supabase
          .from('public_articles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          setLoading(false);
          return;
        }

        if (articles) {
          setFeaturedArticles(articles.slice(0, 5));
          setLatestArticles(articles.slice(5, 15));
          
          // Group by category accurately based on your system categories
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
        <link rel="alternate" hrefLang="pt-br" href={`${window.location.origin}/pt-br`} />
        <link rel="alternate" hrefLang="en" href={`${window.location.origin}/eng`} />
        <link rel="alternate" hrefLang="es" href={`${window.location.origin}/es`} />
      </Helmet>
      
      <BlogHeader />
      
      <main className="max-w-[1200px] mx-auto px-4 lg:px-0 py-4">
        {/* Main Highlight Section (Globo.com style) */}
        <section className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* BIG Highlight */}
            {featuredArticles[0] && (
              <div className="lg:col-span-8 group">
                <Link to={`/${currentLang}/article/${featuredArticles[0].slug || featuredArticles[0].id}`} className="block">
                  <div className="relative mb-3 overflow-hidden">
                    <NewsImage 
                      src={featuredArticles[0].featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                      alt={featuredArticles[0].title}
                      aspectRatio="hero"
                      className="group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[#C4170C] font-black uppercase text-[11px] tracking-tight">
                      {featuredArticles[0].category || 'Notícias'}
                    </span>
                    <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold mb-2 leading-[1.1] text-[#333] group-hover:text-primary transition-colors tracking-tighter">
                      {featuredArticles[0].title}
                    </h1>
                    <p className="text-[#666] text-lg leading-snug line-clamp-2 font-medium">
                      {featuredArticles[0].meta_description}
                    </p>
                  </div>
                </Link>
                
                {/* Secondary Highlight under main */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-gray-100">
                   {featuredArticles.slice(1, 3).map((article) => (
                     <div key={article.id} className="group">
                        <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                          <h3 className="text-xl font-bold leading-tight text-[#333] group-hover:text-primary transition-colors mb-2">
                            {article.title}
                          </h3>
                          <p className="text-sm text-[#888] line-clamp-2">{article.meta_description}</p>
                        </Link>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {/* Sidebar Highlights */}
            <div className="lg:col-span-4 flex flex-col gap-8">
              {featuredArticles.slice(3, 6).map((article) => (
                <div key={article.id} className="group pb-6 border-b border-gray-100 last:border-0">
                  <Link to={`/${currentLang}/article/${article.slug || article.id}`} className="flex flex-col gap-3">
                    <div className="relative overflow-hidden">
                      <NewsImage 
                        src={article.featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                        alt={article.title}
                        aspectRatio="video"
                        className="group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div>
                      <span className="text-[#06AA48] font-black uppercase text-[11px] tracking-tight mb-1 block">
                        {article.category || 'ge'}
                      </span>
                      <h3 className="text-lg font-bold leading-tight text-[#333] group-hover:text-primary transition-colors line-clamp-3">
                        {article.title}
                      </h3>
                    </div>
                  </Link>
                </div>
              ))}
              <AdPlaceholder className="w-full h-[250px] bg-gray-50 mt-auto" />
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
