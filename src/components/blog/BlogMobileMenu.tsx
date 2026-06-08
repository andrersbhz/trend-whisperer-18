import { Link } from 'react-router-dom';
import { ADMIN_NAV } from './AdminMenu';
import type { BlogCategory } from './BlogCategoryNav';
import type { User } from '@supabase/supabase-js';

interface BlogMobileMenuProps {
  categories: BlogCategory[];
  currentLang: string;
  user: User | null;
  onNavigate: () => void;
}

const BlogMobileMenu = ({ categories, currentLang, user, onNavigate }: BlogMobileMenuProps) => (
  <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 animate-in slide-in-from-top duration-200 z-40">
    <div className="px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/${currentLang}/category/${cat.id}`}
            className="text-xs font-bold uppercase tracking-widest p-2 border border-gray-100 rounded text-center text-gray-700 hover:text-primary hover:border-primary transition-colors"
            onClick={onNavigate}
          >
            {cat.label}
          </Link>
        ))}
      </div>
      {user && (
        <div className="border-t border-gray-100 pt-4">
          <span className="text-[10px] font-black text-[#0669B2] uppercase tracking-widest block mb-2">Painel Admin</span>
          <div className="grid grid-cols-2 gap-2">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide p-2 border border-[#0669B2]/20 rounded text-[#0669B2] hover:bg-[#0669B2] hover:text-white transition-colors"
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-gray-100 pt-4 space-y-2 text-center">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Portal de Notícias</span>
      </div>
    </div>
  </div>
);

export default BlogMobileMenu;
