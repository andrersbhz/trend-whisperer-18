import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/hooks/useI18n';

const LanguageSwitcher = () => {
  const { currentLang, changeLanguage, languages } = useI18n();
  const currentFlag = languages.find((l) => l.code === currentLang)?.flag || '🇧🇷';

  return (
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
            onClick={() => changeLanguage(lang.code)}
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-800 focus:bg-gray-800 text-white px-4 py-2"
          >
            <span className="text-lg">{lang.flag}</span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-white">{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
