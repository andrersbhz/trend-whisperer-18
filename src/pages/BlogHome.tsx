import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n, languages } from '@/hooks/useI18n';
import BlogHeader from '@/components/blog/BlogHeader';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Preloader from '@/components/Preloader';

const BlogHome = () => {
  const { currentLang } = useI18n();
  const [featuredArticles, setFeaturedArticles] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // In a real app, we would filter by language.
        // For now, we fetch the latest articles.
        const { data: articles } = await supabase
          .from('articles')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(10);

        if (articles) {
          setFeaturedArticles(articles.slice(0, 3));
          
          // Group by category
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

  if (loading) return <Preloader message="Carregando as últimas notícias..." />;

  const siteTitle = currentLang === 'pt-br' ? 'A3 Blog - Notícias e Tendências' : currentLang === 'eng' ? 'A3 Blog - News and Trends' : 'A3 Blog - Noticias y Tendencias';
  const siteDesc = currentLang === 'pt-br' ? 'Fique por dentro das últimas notícias sobre tecnologia, política e muito mais.' : 'Stay updated with the latest news on technology, politics, and more.';

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Helmet>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDesc} />
        <link rel="alternate" hrefLang="pt-br" href={`${window.location.origin}/pt-br`} />
        <link rel="alternate" hrefLang="en" href={`${window.location.origin}/eng`} />
        <link rel="alternate" hrefLang="es" href={`${window.location.origin}/es`} />
      </Helmet>
      <BlogHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section / Banner */}
        {featuredArticles.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-6 animate-fade-in">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Destaques do Dia</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Featured */}
              <div className="lg:col-span-8 group relative overflow-hidden rounded-none border border-primary/20 aspect-[16/9] lg:aspect-auto lg:h-[500px] animate-float-up">
                <img 
                  src={featuredArticles[0].featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  alt={featuredArticles[0].title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-90" />
                <div className="absolute bottom-0 left-0 p-6 sm:p-10 w-full">
                  <Badge className="mb-4 bg-primary hover:bg-primary/80 rounded-none text-[10px] uppercase font-bold tracking-widest">
                    {featuredArticles[0].category}
                  </Badge>
                  <Link to={`/${currentLang}/article/${featuredArticles[0].slug || featuredArticles[0].id}`}>
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-black mb-4 leading-tight group-hover:text-primary transition-colors font-montserrat uppercase italic">
                      {featuredArticles[0].title}
                    </h1>
                  </Link>
                  <p className="text-muted-foreground text-sm sm:text-base mb-6 line-clamp-2 max-w-2xl">
                    {featuredArticles[0].meta_description}
                  </p>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 5 min read</span>
                    <span>•</span>
                    <span>{new Date(featuredArticles[0].created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Side Featured */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {featuredArticles.slice(1, 3).map((article, idx) => (
                  <div key={article.id} className={`flex-1 group relative overflow-hidden border border-primary/20 aspect-[16/9] lg:aspect-auto animate-float-up`} style={{ animationDelay: `${(idx + 1) * 100}ms` }}>
                    <img 
                      src={article.featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      alt={article.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-6 w-full">
                      <Badge className="mb-2 bg-accent/20 text-accent border-accent/30 rounded-none text-[9px] uppercase font-bold tracking-widest">
                        {article.category}
                      </Badge>
                      <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                        <h3 className="text-lg font-bold mb-2 leading-tight group-hover:text-primary transition-colors font-montserrat uppercase italic line-clamp-2">
                          {article.title}
                        </h3>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Categories Grid */}
        {Object.entries(categoriesData).map(([category, articles]: [string, any], catIdx) => (
          <section key={category} className="mb-20 animate-fade-in" style={{ animationDelay: `${catIdx * 150}ms` }}>
            <div className="flex items-center justify-between mb-8 border-b border-primary/10 pb-4">
              <h2 className="text-xl font-black uppercase italic tracking-tighter font-montserrat">
                <span className="text-primary mr-2">//</span> {category}
              </h2>
              <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-[0.2em] group">
                Ver Tudo <ChevronRight className="ml-1 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {articles.slice(0, 4).map((article: any) => (
                <article key={article.id} className="group flex flex-col hover-lift">
                  <div className="relative aspect-[4/5] mb-4 overflow-hidden border border-primary/10">
                    <img 
                      src={article.featured_image_url || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d'} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt={article.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                      <h3 className="text-sm font-black uppercase italic leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-3">
                        {article.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                      {article.meta_description}
                    </p>
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      <span>{new Date(article.created_at).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 4 MIN</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Conversion CTA */}
        <section className="relative overflow-hidden glass-card p-10 sm:p-16 text-center border-primary/30">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ArrowRight className="h-40 w-40 -rotate-45" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black uppercase italic mb-6 font-montserrat leading-tight">
            Receba o Melhor Conteúdo <br /> <span className="text-primary">Direto no seu E-mail</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-10 text-sm sm:text-base">
            Junte-se a mais de 50.000 leitores e receba as tendências mais quentes da semana, análises exclusivas e insights que você não encontra em outro lugar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="SEU MELHOR E-MAIL" 
              className="w-full bg-secondary/30 border border-primary/20 px-6 py-3 text-xs font-bold tracking-widest uppercase focus:border-primary outline-none transition-colors"
            />
            <Button className="w-full sm:w-auto gradient-primary px-10 py-3 h-auto text-xs font-black uppercase tracking-widest shadow-neon-lilac hover:scale-105 transition-transform">
              INSCREVER
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-primary/20 bg-background/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent" />
                <span className="font-black text-xl tracking-tighter uppercase italic font-montserrat">A3 <span className="text-primary">BLOG</span></span>
              </div>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Plataforma de conteúdo inteligente focada em tendências, tecnologia e o futuro da informação. 
                Desenvolvido com tecnologia de ponta para entregar a melhor experiência de leitura.
              </p>
              <div className="flex items-center gap-4">
                 {/* Social links placeholder */}
                 <div className="h-8 w-8 rounded-none border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all cursor-pointer text-xs font-bold italic">FB</div>
                 <div className="h-8 w-8 rounded-none border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all cursor-pointer text-xs font-bold italic">IG</div>
                 <div className="h-8 w-8 rounded-none border border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all cursor-pointer text-xs font-bold italic">TW</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-primary">Navegação</h4>
              <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <li className="hover:text-primary cursor-pointer transition-colors">Home</li>
                <li className="hover:text-primary cursor-pointer transition-colors">Sobre Nós</li>
                <li className="hover:text-primary cursor-pointer transition-colors">Categorias</li>
                <li className="hover:text-primary cursor-pointer transition-colors">Contato</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-primary">Legal</h4>
              <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <li className="hover:text-primary cursor-pointer transition-colors">Privacidade</li>
                <li className="hover:text-primary cursor-pointer transition-colors">Termos de Uso</li>
                <li className="hover:text-primary cursor-pointer transition-colors">Cookies</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-primary/10 pt-8 flex flex-col md:row items-center justify-between gap-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
              © 2026 A3 POSTWP. TODOS OS DIREITOS RESERVADOS.
            </p>
            <div className="flex gap-4 items-center">
              <div className="flex gap-1">
                {languages.map(l => (
                  <span key={l.code} className="text-sm cursor-pointer grayscale hover:grayscale-0 transition-all" title={l.label}>{l.flag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogHome;
