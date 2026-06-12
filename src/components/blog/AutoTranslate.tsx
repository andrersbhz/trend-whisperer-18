import { useEffect } from 'react';
import type { Language } from '@/hooks/useI18n';

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

const LANG_MAP: Record<Language, string> = {
  'pt-br': 'pt',
  'eng': 'en',
  'es': 'es',
};

interface Props {
  currentLang: Language;
}

/**
 * Widget invisível do Google Translate que traduz automaticamente o conteúdo
 * para o idioma atual quando o leitor está em uma página cujo conteúdo original
 * esteja em outro idioma. Usa o elemento oficial do Google Translate.
 */
const AutoTranslate = ({ currentLang }: Props) => {
  useEffect(() => {
    const target = LANG_MAP[currentLang] || 'pt';

    // Define a língua de destino via cookie googtrans (suportado pelo widget)
    const setCookie = (value: string) => {
      document.cookie = `googtrans=${value};path=/`;
      const host = window.location.hostname;
      if (host && !host.includes('localhost')) {
        document.cookie = `googtrans=${value};path=/;domain=.${host.split('.').slice(-2).join('.')}`;
      }
    };
    setCookie(`/auto/${target}`);

    if (document.getElementById('google-translate-script')) return;

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate) return;
      // eslint-disable-next-line new-cap
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'auto',
          includedLanguages: 'pt,en,es',
          autoDisplay: false,
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        },
        'google_translate_element'
      );
    };

    const s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.body.appendChild(s);
  }, [currentLang]);

  return (
    <>
      {/* O elemento é necessário para o widget inicializar, mas fica oculto */}
      <div id="google-translate-element" style={{ display: 'none' }} />
      <style>{`
        /* Esconde a barra superior e qualquer overlay do Google Translate */
        .goog-te-banner-frame,
        .goog-te-banner-frame.skiptranslate,
        .skiptranslate iframe,
        #goog-gt-tt,
        .goog-te-balloon-frame,
        .goog-tooltip,
        .goog-tooltip:hover { display: none !important; visibility: hidden !important; }
        body { top: 0 !important; position: static !important; }
        font[style*="background-color"] { background: transparent !important; box-shadow: none !important; }
        .goog-text-highlight { background: transparent !important; box-shadow: none !important; }
      `}</style>
    </>
  );
};

export default AutoTranslate;
