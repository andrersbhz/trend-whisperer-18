import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n, languages } from '@/hooks/useI18n';
import BlogHeader from '@/components/blog/BlogHeader';
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
          .from('articles')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(40);

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

  if (loading) return <Preloader message="Sincronizando as últimas notícias globais..." />;

  const siteTitle = 'globo.com - Absolutamente tudo sobre notícias, esportes e entretenimento';
  const siteDesc = 'Só na globo.com você encontra tudo sobre g1, ge, gshow e muito mais.';

  return (
    <div className="min-h-screen bg-white text-black selection:bg-primary/20 font-sans antialiased">
      <Helmet>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDesc} />
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

        {/* Triple News Sections (like Jornalismo, Esporte, Entretenimento blocks) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mt-16 pt-12 border-t border-gray-200">
           {/* Section 1: Jornalismo (g1) */}
           <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                 <h2 className="text-[#C4170C] text-2xl font-black lowercase tracking-tighter">g1</h2>
              </div>
              {latestArticles.slice(0, 3).map((article) => (
                <div key={article.id} className="group block pb-6 border-b border-gray-100 last:border-0">
                  <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                    <div className="relative mb-3">
                       <NewsImage src={article.featured_image_url} alt={article.title} aspectRatio="video" />
                    </div>
                    <h3 className="text-base font-bold leading-snug text-[#333] group-hover:text-[#C4170C] transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                  </Link>
                </div>
              ))}
           </div>

           {/* Section 2: Esportes (ge) */}
           <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                 <h2 className="text-[#06AA48] text-2xl font-black lowercase tracking-tighter">ge</h2>
              </div>
              {latestArticles.slice(3, 6).map((article) => (
                <div key={article.id} className="group block pb-6 border-b border-gray-100 last:border-0">
                  <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                    <div className="relative mb-3">
                       <NewsImage src={article.featured_image_url} alt={article.title} aspectRatio="video" />
                    </div>
                    <h3 className="text-base font-bold leading-snug text-[#333] group-hover:text-[#06AA48] transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                  </Link>
                </div>
              ))}
           </div>

           {/* Section 3: Entretenimento (gshow) */}
           <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                 <h2 className="text-[#FF8000] text-2xl font-black lowercase tracking-tighter">gshow</h2>
              </div>
              {latestArticles.slice(6, 9).map((article) => (
                <div key={article.id} className="group block pb-6 border-b border-gray-100 last:border-0">
                  <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                    <div className="relative mb-3">
                       <NewsImage src={article.featured_image_url} alt={article.title} aspectRatio="video" />
                    </div>
                    <h3 className="text-base font-bold leading-snug text-[#333] group-hover:text-[#FF8000] transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                  </Link>
                </div>
              ))}
           </div>
        </section>

        {/* Dynamic Category Blocks (Bottom Grid) */}
        <div className="mt-20 space-y-20">
          {Object.entries(categoriesData).filter(([_, arts]: [any, any]) => arts.length >= 1).map(([category, articles]: [string, any], catIdx) => (
            <section key={category} className="border-t border-gray-200 pt-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-[#333]">
                  {category}
                </h2>
                <Link to={`/${currentLang}/category/${category.toLowerCase()}`} className="text-sm font-bold text-[#0669B2] hover:underline">
                  Ver tudo de {category}
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {articles.slice(0, 4).map((article: any) => (
                  <article key={article.id} className="group">
                    <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                      <div className="relative mb-3 aspect-video overflow-hidden">
                        <NewsImage 
                          src={article.featured_image_url} 
                          alt={article.title}
                          aspectRatio="video"
                        />
                      </div>
                      <h3 className="text-[15px] font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1 text-[#333]">
                        {article.title}
                      </h3>
                      <p className="text-xs text-[#888] line-clamp-2">
                        {article.meta_description}
                      </p>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <AdPlaceholder className="w-full h-24 mt-20" />
      </main>

      <footer className="bg-[#1a1a1a] text-white py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-12 mb-16 border-b border-white/10 pb-12">
            <div className="md:col-span-2 lg:col-span-1">
              <h2 className="font-black text-2xl tracking-tighter uppercase mb-6">A3 <span className="text-primary">PORTAL</span></h2>
              <p className="text-white/60 text-xs leading-relaxed max-w-sm mb-6 uppercase tracking-wider font-bold">
                O maior portal de inteligência de conteúdo do país. Automação, tendências e jornalismo profissional.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-8 lg:col-span-2">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-primary">Editorias</h4>
                <ul className="space-y-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  <li className="hover:text-primary cursor-pointer transition-colors">Policial</li>
                  <li className="hover:text-primary cursor-pointer transition-colors">Famosos</li>
                  <li className="hover:text-primary cursor-pointer transition-colors">Política</li>
                  <li className="hover:text-primary cursor-pointer transition-colors">Economia</li>
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-primary">Institucional</h4>
                <ul className="space-y-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  <li className="hover:text-primary cursor-pointer transition-colors">Anuncie</li>
                  <li className="hover:text-primary cursor-pointer transition-colors">Expediente</li>
                  <li className="hover:text-primary cursor-pointer transition-colors">Privacidade</li>
                  <li className="hover:text-primary cursor-pointer transition-colors">Termos</li>
                </ul>
              </div>
            </div>

            <div className="bg-white/5 p-6 border border-white/10">
               <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-primary">Idiomas</h4>
               <div className="flex gap-4">
                 {languages.map(l => (
                    <span key={l.code} className="text-xl cursor-pointer hover:scale-110 transition-transform" title={l.label}>{l.flag}</span>
                 ))}
               </div>
            </div>
          </div>
          
          <div className="flex flex-col md:row items-center justify-between gap-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">
              © 2026 A3 PORTWP. DESENVOLVIDO COM INTELIGÊNCIA ARTIFICIAL.
            </p>
            <Button variant="ghost" size="sm" className="text-[9px] font-bold text-white/50 hover:text-white uppercase tracking-tighter">
              Voltar ao Topo
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogHome;
