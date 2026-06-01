import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { Search, Menu, X, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BlogHeader = () => {
  const { currentLang, changeLanguage, languages } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<{id: string, label: string}[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('category')
        .not('category', 'is', null);
      
      if (data) {
        const uniqueCategories = Array.from(new Set(data.map(item => item.category)))
          .map(cat => ({
            id: cat.toLowerCase().replace(/\s+/g, '-'),
            label: cat
          }));
        setDynamicCategories(uniqueCategories);
      }
    };
    fetchCategories();
  }, []);

  const currentFlag = languages.find(l => l.code === currentLang)?.flag || '🇧🇷';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Top Bar for Navigation */}
      <div className="bg-[#f2f2f2] border-b border-gray-200 py-2 hidden lg:block">
        <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-tight text-[#444]">
          <div className="flex items-center gap-6">
            <span className="text-[#000] font-black mr-2">A3 BLOG</span>
            {dynamicCategories.slice(0, 6).map((cat) => (
              <Link 
                key={cat.id} 
                to={`/${currentLang}/category/${cat.id}`}
                className="hover:opacity-70 transition-opacity text-[#444] hover:text-primary"
              >
                {cat.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
             <button className="flex items-center gap-1.5 px-3 py-1 bg-white/50 hover:bg-white hover:shadow-sm rounded-full transition-all duration-200 text-black/80 hover:text-black border border-black/5">
               <Search className="h-3.5 w-3.5" /> BUSCAR
             </button>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
               <button className="flex items-center gap-1.5 px-3 py-1 bg-white/50 hover:bg-white hover:shadow-sm rounded-full transition-all duration-200 text-black/80 hover:text-black border border-black/5 uppercase">
                 {currentFlag} {currentLang}
               </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900 border border-gray-800 shadow-2xl z-[100] min-w-[120px]">
                {languages.map((lang) => (
                  <DropdownMenuItem 
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code as any)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-800 focus:bg-gray-800 text-white px-4 py-2"
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-white">{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
             <button className="px-4 py-1.5 bg-[#0669B2] text-white rounded-full font-black text-[10px] hover:bg-[#055a9a] hover:shadow-md transition-all duration-200 active:scale-95">MINHA CONTA</button>
          </div>
        </div>
      </div>

      {/* Main Brand Area (Mobile & Sticky Desktop) */}
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between lg:h-12 lg:border-t lg:border-gray-100">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-[#444] h-10 w-10 p-0 hover:bg-transparent"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <Link to={`/${currentLang}`} className="flex items-center">
              <span className="font-black text-2xl tracking-tighter text-[#0669B2] lg:hidden">
                A3 BLOG
              </span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold uppercase text-[#333]">
           {dynamicCategories.slice(0, 5).map(cat => (
             <Link 
               key={cat.id} 
               to={`/${currentLang}/category/${cat.id}`} 
               className="hover:text-primary transition-colors"
             >
               {cat.label}
             </Link>
           ))}
        </div>

        <div className="lg:hidden">
          <Button variant="ghost" size="icon" className="text-[#444] h-10 w-10 p-0 hover:bg-transparent">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 animate-in slide-in-from-top duration-200 z-40">
          <div className="px-4 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {dynamicCategories.map((cat) => (
                <Link 
                  key={cat.id} 
                  to={`/${currentLang}/category/${cat.id}`}
                  className="text-xs font-bold uppercase tracking-widest p-2 border border-gray-100 rounded text-center text-gray-700 hover:text-primary hover:border-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {cat.label}
                </Link>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2 text-center">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Portal de Notícias</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default BlogHeader;
