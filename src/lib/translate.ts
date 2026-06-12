import type { Language } from '@/hooks/useI18n';

const LANG_MAP: Record<Language, string> = {
  'pt-br': 'pt',
  'eng': 'en',
  'es': 'es',
};

const setCookie = (name: string, value: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value};path=/`;
  const host = window.location.hostname;
  if (host && !host.includes('localhost')) {
    const parts = host.split('.');
    const root = parts.length >= 2 ? parts.slice(-2).join('.') : host;
    document.cookie = `${name}=${value};path=/;domain=.${root}`;
  }
};

/**
 * Define o idioma de destino do Google Translate.
 * Usa o cookie `googtrans` (formato /auto/<lang>) suportado nativamente pelo widget.
 * Recarrega a página para que a tradução seja aplicada de forma limpa.
 */
export const setTranslateLang = (lang: Language) => {
  const target = LANG_MAP[lang] || 'pt';
  setCookie('googtrans', `/auto/${target}`);
  // Pequeno delay para garantir que a navegação do React Router tenha tempo de iniciar
  setTimeout(() => {
    try { window.location.reload(); } catch { /* noop */ }
  }, 60);
};
