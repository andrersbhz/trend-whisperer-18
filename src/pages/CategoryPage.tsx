import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/hooks/useI18n';
import { Helmet } from 'react-helmet-async';
import BlogHeader from '@/components/blog/BlogHeader';
import BlogFooter from '@/components/blog/BlogFooter';
import NewsImage from '@/components/blog/NewsImage';
import { Link } from 'react-router-dom';
import Preloader from '@/components/Preloader';

const CategoryPage = ({ categoryId }: { categoryId: string }) => {
  const { currentLang } = useI18n();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('articles')
          .select('*')
          .ilike('category', categoryId.replace(/-/g, ' '))
          .order('created_at', { ascending: false });
        
        setArticles(data || []);
      } catch (error) {
        console.error('Error fetching category articles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [categoryId]);

  if (loading) return <Preloader message={`Carregando ${categoryId.replace(/-/g, ' ')}...`} />;

  const displayTitle = categoryId.replace(/-/g, ' ');

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <Helmet>
        <title>{displayTitle.toUpperCase()} | A3 BLOG</title>
        <meta name="description" content={`Confira as últimas notícias sobre ${displayTitle} no A3 BLOG.`} />
        <link rel="canonical" href={window.location.origin + window.location.pathname} />
      </Helmet>
      
      <BlogHeader />

      <main className="max-w-[1200px] mx-auto px-4 lg:px-0 py-12">
        <header className="mb-12 border-b border-gray-100 pb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-[#333]">{displayTitle}</h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article) => (
            <article key={article.id} className="group">
              <Link to={`/${currentLang}/article/${article.slug || article.id}`}>
                <div className="relative mb-4 aspect-video overflow-hidden border border-gray-100">
                  <NewsImage src={article.featured_image_url} alt={article.title} aspectRatio="video" />
                </div>
                <h2 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-2 text-[#333]">
                  {article.title}
                </h2>
                <p className="text-sm text-gray-600 line-clamp-3">
                  {article.meta_description}
                </p>
              </Link>
            </article>
          ))}
          {articles.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p className="text-gray-400 font-bold uppercase tracking-widest">Nenhum artigo encontrado nesta categoria.</p>
            </div>
          )}
        </div>
      </main>

      <BlogFooter />
    </div>
  );
};

export default CategoryPage;