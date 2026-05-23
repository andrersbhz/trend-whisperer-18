import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';
import BlogHeader from '@/components/blog/BlogHeader';
import { Helmet } from 'react-helmet-async';
import { Clock, Calendar, Share2, ArrowLeft } from 'lucide-react';
import Preloader from '@/components/Preloader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const BlogArticle = () => {
  const { articleId } = useParams<{ articleId: string }>();
  const { currentLang } = useI18n();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .or(`id.eq.${articleId},slug.eq.${articleId}`)
          .maybeSingle();

        if (data) setArticle(data);
      } catch (error) {
        console.error('Error fetching article:', error);
      } finally {
        setLoading(false);
      }
    };

    if (articleId) fetchArticle();
  }, [articleId]);

  if (loading) return <Preloader message="Abrindo artigo..." />;
  if (!article) return <div className="min-h-screen flex items-center justify-center">Artigo não encontrado.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Helmet>
        <title>{article.seo_title || article.title} | A3 Blog</title>
        <meta name="description" content={article.meta_description} />
        {article.seo_keyword && <meta name="keywords" content={article.seo_keyword} />}
        {/* Open Graph Tags */}
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.meta_description} />
        <meta property="og:image" content={article.featured_image_url} />
        <meta property="og:type" content="article" />
      </Helmet>
      
      <BlogHeader />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 animate-fade-in">
        <Link to={`/${currentLang}`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary mb-8 hover:translate-x-[-4px] transition-transform">
          <ArrowLeft className="h-4 w-4" /> Voltar para o Início
        </Link>

        <header className="mb-12">
          <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 rounded-none text-[10px] uppercase font-black tracking-[0.2em] px-3 py-1">
            {article.category}
          </Badge>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase italic leading-[0.95] mb-8 font-montserrat tracking-tighter">
            {article.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-y border-primary/10 py-6">
            <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {new Date(article.created_at).toLocaleDateString()}</span>
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> 6 MIN DE LEITURA</span>
            <Button variant="ghost" size="sm" className="ml-auto text-[10px] font-black uppercase tracking-widest gap-2">
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
          </div>
        </header>

        {article.featured_image_url && (
          <div className="relative aspect-[16/9] mb-12 overflow-hidden border border-primary/20">
            <img 
              src={article.featured_image_url} 
              alt={article.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
          </div>
        )}

        <div 
          className="prose prose-invert prose-primary max-w-none 
            prose-headings:font-black prose-headings:uppercase prose-headings:italic prose-headings:font-montserrat prose-headings:tracking-tighter
            prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:text-lg
            prose-strong:text-foreground prose-strong:font-black
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            animate-float-up"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
        
        <footer className="mt-20 pt-12 border-t border-primary/20">
          <div className="glass-card p-8 sm:p-12 text-center">
            <h3 className="text-2xl font-black uppercase italic mb-4 font-montserrat">Gostou deste conteúdo?</h3>
            <p className="text-muted-foreground mb-8 text-sm max-w-lg mx-auto">
              Inscreva-se na nossa newsletter para receber mais artigos como este diretamente no seu e-mail.
            </p>
            <div className="flex flex-col sm:row items-center justify-center gap-4 max-w-md mx-auto">
              <input 
                type="email" 
                placeholder="SEU E-MAIL" 
                className="w-full bg-secondary/30 border border-primary/20 px-6 py-3 text-xs font-bold tracking-widest uppercase focus:border-primary outline-none"
              />
              <Button className="w-full sm:w-auto gradient-primary px-8 h-auto py-3 text-xs font-black uppercase tracking-widest shadow-neon-lilac">
                ASSINAR
              </Button>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
};

export default BlogArticle;
