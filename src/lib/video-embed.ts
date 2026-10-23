import DOMPurify from 'dompurify';

// Hosts de vídeo cujos iframes podem aparecer no corpo dos artigos.
const ALLOWED_IFRAME_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.dailymotion\.com|www\.facebook\.com|www\.instagram\.com|www\.tiktok\.com)\//i;

export function youTubeIdFromUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:[^"'\s<]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

export function buildVideoEmbed(id: string, title = 'Vídeo'): string {
  return `<div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;margin:20px 0;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" src="https://www.youtube.com/embed/${id}" title="${title.replace(/"/g, '&quot;')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
}

/** Aceita um link do YouTube ou um código embed (iframe) e devolve o HTML do player. */
export function toEmbedHtml(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/<iframe[\s>]/i.test(raw)) return raw;
  const id = youTubeIdFromUrl(raw);
  return id ? buildVideoEmbed(id) : null;
}

let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe') {
      const src = (node as Element).getAttribute?.('src') || '';
      if (!ALLOWED_IFRAME_HOSTS.test(src)) node.parentNode?.removeChild(node);
    }
  });
}

/** Sanitiza o HTML do artigo mantendo players de vídeo de sites confiáveis. */
export function sanitizeArticleHtml(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'title', 'width', 'height', 'style', 'referrerpolicy'],
  });
}
