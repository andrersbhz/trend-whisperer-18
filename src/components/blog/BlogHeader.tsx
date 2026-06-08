import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { useBlogCategories } from '@/hooks/useBlogCategories';
import AdminMenu from './AdminMenu';
import LanguageSwitcher from './LanguageSwitcher';
import BlogCategoryNav from './BlogCategoryNav';
import BlogMobileMenu from './BlogMobileMenu';

const BlogHeader = () => {
  const { currentLang } = useI18n();
  const { user } = useAuth();
  const categories = useBlogCategories();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Top Bar (Desktop) */}
      <div className="bg-[#f2f2f2] border-b border-gray-200 py-2 hidden lg:block">
        <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-tight text-[#444]">
          <BlogCategoryNav
            categories={categories}
            currentLang={currentLang}
            limit={6}
            withBrand
            className="flex items-center gap-6"
          />
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 px-3 py-1 bg-white/50 hover:bg-white hover:shadow-sm rounded-full transition-all duration-200 text-black/80 hover:text-black border border-black/5">
              <Search className="h-3.5 w-3.5" /> BUSCAR
            </button>
            <LanguageSwitcher />
            {user ? (
              <AdminMenu user={user} />
            ) : (
              <Link
                to="/auth"
                className="px-4 py-1.5 bg-[#0669B2] text-white rounded-full font-black text-[10px] hover:bg-[#055a9a] hover:shadow-md transition-all duration-200 active:scale-95"
              >
                MINHA CONTA
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Brand Area */}
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between lg:h-12 lg:border-t lg:border-gray-100">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-[#444] h-10 w-10 p-0 hover:bg-transparent"
            onClick={() => setIsMenuOpen((v) => !v)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <Link to={`/${currentLang}`} className="flex items-center">
            <span className="font-black text-2xl tracking-tighter text-[#0669B2] lg:hidden">A3 BLOG</span>
          </Link>
        </div>

        <BlogCategoryNav
          categories={categories}
          currentLang={currentLang}
          limit={5}
          className="hidden lg:flex items-center gap-6 text-[11px] font-bold uppercase text-[#333]"
          itemClassName="hover:text-primary transition-colors"
        />

        <div className="lg:hidden">
          <Button variant="ghost" size="icon" className="text-[#444] h-10 w-10 p-0 hover:bg-transparent">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {isMenuOpen && (
        <BlogMobileMenu
          categories={categories}
          currentLang={currentLang}
          user={user}
          onNavigate={() => setIsMenuOpen(false)}
        />
      )}
    </header>
  );
};

export default BlogHeader;
