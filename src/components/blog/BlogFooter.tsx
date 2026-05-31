import { Link } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';

const BlogFooter = () => {
  const { currentLang } = useI18n();

  return (
    <footer className="bg-[#f2f2f2] border-t border-gray-200 py-12 mt-20">
      <div className="max-w-[1200px] mx-auto px-4 text-center">
        <div className="flex flex-col items-center gap-6">
          <span className="font-black text-3xl tracking-tighter text-[#444]">A3 BLOG</span>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] font-bold uppercase text-[#777]">
             <Link to="#" className="hover:text-black">princípios editoriais</Link>
             <Link to={`/${currentLang}/termos`} className="hover:text-black">termos de uso</Link>
             <Link to="#" className="hover:text-black">política de privacidade</Link>
             <Link to="#" className="hover:text-black">contato</Link>
             <Link to="#" className="hover:text-black">anuncie</Link>
          </div>
          <p className="text-[10px] text-[#999] max-w-2xl">
            © Copyright 2026 A3 BLOG - Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default BlogFooter;
