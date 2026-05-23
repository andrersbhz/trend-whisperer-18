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

        if (error) throw error;

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

  const siteTitle = 'A3 Portal | Notícias, Tecnologia e Informação em Tempo Real';
  const siteDesc = 'O portal de notícias mais completo com inteligência artificial. Fique por dentro de política, economia, famosos e muito mais.';

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] selection:bg-primary/20 font-sans antialiased">
      <Helmet>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDesc} />
        <link rel="alternate" hrefLang="pt-br" href={`${window.location.origin}/pt-br`} />
        <link rel="alternate" hrefLang="en" href={`${window.location.origin}/eng`} />
        <link rel="alternate" hrefLang="es" href={`${window.location.origin}/es`} />
      </Helmet>
      
      <BlogHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Ad */}
        <AdPlaceholder className="w-full h-24 mb-8" />

        {/* Hero News Grid */}
        <section className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Story */}
            {featuredArticles[0] && (
              <div className="lg:col-span-7 group">
                <div className="relative mb-6 shadow-md border border-border group-hover:border-primary/30 transition-colors">
                  <NewsImage 
                    src={featuredArticles[0].featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                    alt={featuredArticles[0].title}
                    aspectRatio="hero"
                  />
                  <div className="absolute top-6 left-6 z-30">
                    <Badge className="bg-primary text-white rounded-none border-none uppercase font-black text-[10px] tracking-widest px-4 py-1.5 shadow-lg">
                      {featuredArticles[0].category}
                    </Badge>
                  </div>
                </div>
                <Link to={`/${currentLang}/article/${featuredArticles[0].slug || featuredArticles[0].id}`}>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight group-hover:text-primary transition-colors tracking-tighter font-montserrat">
                    {featuredArticles[0].title}
                  </h1>
                </Link>
                <p className="text-muted-foreground text-base leading-relaxed line-clamp-2 mb-6 font-medium">
                  {featuredArticles[0].meta_description}
                </p>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase text-muted-foreground/80 tracking-widest">
                  <span className="flex items-center gap-1.5 bg-muted px-2 py-1"><Clock className="h-3.5 w-3.5" /> 2 MIN ATRÁS</span>
                  <span className="border-l border-border pl-4">POR REDAÇÃO A3</span>
                </div>
              </div>
            )}

            {/* Side Stories */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-primary w-fit mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-black uppercase tracking-widest">Mais Lidas</h2>
              </div>
              {featuredArticles.slice(1, 5).map((article, idx) => (
                <div key={article.id} className="flex gap-5 group items-start pb-6 border-b border-border/50 last:border-0 hover:bg-muted/30 p-2 transition-colors -mx-2">
                  <div className="w-24 sm:w-36 shrink-0 border border-border">
                    <NewsImage 
                      src={article.featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                      alt={article.title}
                      aspectRatio="square"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-6 bg-primary/30" />
                      <span className="text-[9px] uppercase font-black tracking-widest text-primary">
                        {article.category}
                      </span>
                    </div>
                    <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                      <h3 className="text-sm sm:text-base font-black leading-tight group-hover:text-primary transition-colors line-clamp-3 tracking-tight font-montserrat">
                        {article.title}
                      </h3>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section Ad */}
        <AdPlaceholder className="w-full h-32 mb-12" />

        {/* Latest News Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Feed */}
          <div className="lg:col-span-8 space-y-12">
            <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] pb-2 mb-8">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 font-montserrat">
                <Newspaper className="h-5 w-5 text-primary" /> Últimas Notícias
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {latestArticles.map((article) => (
                <article key={article.id} className="group flex flex-col border-b border-border pb-8 last:border-0 last:pb-0 md:border-b-0 md:pb-0">
                  <div className="relative mb-5 border border-border shadow-sm">
                    <NewsImage 
                      src={article.featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                      alt={article.title}
                      aspectRatio="video"
                    />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest rounded-none border-primary/40 text-primary px-2 py-0.5">
                      {article.category}
                    </Badge>
                    <span className="h-[1px] flex-1 bg-border" />
                  </div>
                  <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                    <h3 className="text-xl font-black leading-tight mb-3 group-hover:text-primary transition-colors tracking-tight font-montserrat">
                      {article.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                    {article.meta_description}
                  </p>
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    <span>{new Date(article.created_at).toLocaleDateString()}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Sidebar Ads & Content */}
          <aside className="lg:col-span-4 space-y-8">
            <div className="sticky top-24 space-y-8">
              <div className="p-6 bg-[#f8f8f8] border border-border">
                <h3 className="text-xs font-black uppercase tracking-widest mb-4 border-b border-border pb-2">Patrocinado</h3>
                <AdPlaceholder className="w-full h-[300px]" />
              </div>

              {/* Newsletter conversion */}
              <div className="p-6 bg-primary text-white">
                <h3 className="text-lg font-black uppercase italic mb-2 leading-tight">Receba em primeira mão</h3>
                <p className="text-[11px] mb-4 font-bold opacity-80 uppercase tracking-wider">As notícias mais importantes do dia.</p>
                <div className="space-y-2">
                  <input 
                    type="email" 
                    placeholder="SEU E-MAIL" 
                    className="w-full bg-white/10 border border-white/20 px-3 py-2 text-[10px] font-bold tracking-widest uppercase outline-none placeholder:text-white/50"
                  />
                  <Button className="w-full bg-white text-primary hover:bg-white/90 rounded-none text-[10px] font-black uppercase tracking-widest h-9">
                    Assinar Agora
                  </Button>
                </div>
              </div>

              <div className="p-6 bg-secondary border border-border">
                 <h3 className="text-xs font-black uppercase tracking-widest mb-4 border-b border-border pb-2">Siga nas Redes</h3>
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="rounded-none text-[9px] font-bold border-border/50 uppercase h-8">Facebook</Button>
                    <Button variant="outline" size="sm" className="rounded-none text-[9px] font-bold border-border/50 uppercase h-8">Instagram</Button>
                 </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Dynamic Category Blocks */}
        {Object.entries(categoriesData).filter(([_, arts]: [any, any]) => arts.length >= 1).map(([category, articles]: [string, any], catIdx) => (
          <section key={category} className="mt-20 border-t-4 border-[#1a1a1a] pt-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tighter border-l-4 border-primary pl-4 font-montserrat">
                {category}
              </h2>
              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-[0.2em] group border border-border">
                Ver Mais <ChevronRight className="ml-1 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {articles.slice(0, 3).map((article: any) => (
                <article key={article.id} className="group">
                  <div className="relative mb-4 border border-border shadow-sm">
                    <NewsImage 
                      src={article.featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                      alt={article.title}
                      aspectRatio="video"
                    />
                  </div>
                  <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                    <h3 className="text-base font-black leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-2 tracking-tight font-montserrat">
                      {article.title}
                    </h3>
                  </Link>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {article.meta_description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}

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
