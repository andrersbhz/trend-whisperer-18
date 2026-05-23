import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { Search, Menu, X, Globe } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BlogHeader = () => {
  const { currentLang, changeLanguage, languages } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const categories = [
    { id: 'policia', label: { 'pt-br': 'Policial', 'eng': 'Police', 'es': 'Policía' } },
    { id: 'celebridades', label: { 'pt-br': 'Famosos', 'eng': 'Celebrities', 'es': 'Famosos' } },
    { id: 'politica', label: { 'pt-br': 'Política', 'eng': 'Politics', 'es': 'Política' } },
    { id: 'esportes', label: { 'pt-br': 'Esportes', 'eng': 'Sports', 'es': 'Deportes' } },
    { id: 'saude', label: { 'pt-br': 'Saúde', 'eng': 'Health', 'es': 'Salud' } },
    { id: 'financas', label: { 'pt-br': 'Finanças', 'eng': 'Finance', 'es': 'Finanzas' } },
  ];

  const currentFlag = languages.find(l => l.code === currentLang)?.flag || '🇧🇷';

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
      {/* Top Bar for Ads/Info */}
      <div className="bg-primary py-1 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 text-[10px] font-bold text-white uppercase tracking-widest text-center">
          Últimas Notícias: A3 PostWP | Inteligência Artificial e Automação de Conteúdo
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link to={`/${currentLang}`} className="flex items-center gap-2 group">
            <span className="font-black text-2xl sm:text-3xl tracking-tighter uppercase text-foreground">
              A3 <span className="text-primary">BLOG</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-6">
            {categories.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/${currentLang}/category/${cat.id}`}
                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
              >
                {cat.label[currentLang]}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-9 w-9">
              <Search className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 h-9 border border-border">
                  <span className="text-lg">{currentFlag}</span>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border border-border shadow-xl">
                {languages.map((lang) => (
                  <DropdownMenuItem 
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code as any)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="text-xs font-bold uppercase tracking-wider">{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="ghost" 
              size="icon" 
              className="xl:hidden text-muted-foreground h-9 w-9"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="xl:hidden bg-background border-t border-border animate-fade-in shadow-2xl">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {categories.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/${currentLang}/category/${cat.id}`}
                className="block px-3 py-3 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-primary border-b border-border/50"
                onClick={() => setIsMenuOpen(false)}
              >
                {cat.label[currentLang]}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default BlogHeader;
