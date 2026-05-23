import { Link } from 'react-router-dom';
import { useI18n, Language } from '@/hooks/useI18n';
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
    { id: 'esportes', label: { 'pt-br': 'Esportes', 'eng': 'Sports', 'es': 'Deportes' } },
    { id: 'politica', label: { 'pt-br': 'Política', 'eng': 'Politics', 'es': 'Política' } },
    { id: 'saude', label: { 'pt-br': 'Saúde', 'eng': 'Health', 'es': 'Salud' } },
    { id: 'tecnologia', label: { 'pt-br': 'Tecnologia', 'eng': 'Technology', 'es': 'Tecnología' } },
  ];

  const currentFlag = languages.find(l => l.code === currentLang)?.flag || '🇧🇷';

  return (
    <header className="sticky top-0 z-50 glass border-b border-primary/20 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link to={`/${currentLang}`} className="flex items-center gap-2 group">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_15px_rgba(0,150,255,0.5)] group-hover:scale-105 transition-transform shrink-0">
               <div className="w-full h-full bg-gradient-to-br from-primary to-accent" />
            </div>
            <span className="font-black text-lg sm:text-xl tracking-tighter uppercase italic text-foreground font-montserrat">
              A3 <span className="text-primary">BLOG</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {categories.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/${currentLang}/category/${cat.id}`}
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
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
                <Button variant="ghost" className="flex items-center gap-2 px-2 h-9">
                  <span className="text-lg">{currentFlag}</span>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                {languages.map((lang) => (
                  <DropdownMenuItem 
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
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
              className="md:hidden text-muted-foreground h-9 w-9"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden glass border-t border-primary/10 animate-fade-in">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {categories.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/${currentLang}/category/${cat.id}`}
                className="block px-3 py-3 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-primary border-b border-primary/5"
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
