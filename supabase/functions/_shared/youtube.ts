// Corrige vídeos do YouTube no corpo dos artigos.
// O YouTube não aceita mais embeds de busca (embed?listType=search&list=...),
// que aparecem como "Este vídeo não está disponível". Aqui trocamos esses
// embeds por um vídeo real encontrado pela YouTube Data API v3; se não houver
// chave, cota ou resultado, o bloco de vídeo é removido.

const SEARCH_EMBED_RE = /<iframe[^>]*src=["'][^"']*youtube(?:-nocookie)?\.com\/embed\/?\?[^"']*listType=search[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;

function extractQuery(iframe: string): string {
  const m = iframe.match(/[?&;]list=([^"'&]+)/i);
  if (!m) return "";
  try { return decodeURIComponent(m[1].replace(/\+/g, " ")).trim(); } catch { return m[1].replace(/\+/g, " ").trim(); }
}

async function searchVideoId(apiKey: string, query: string): Promise<string | null> {
  if (!query) return null;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1&order=relevance&q=${encodeURIComponent(query)}&key=${apiKey}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[YouTube] busca falhou (${resp.status}) para "${query}"`);
      return null;
    }
    const data = await resp.json();
    const id = data?.items?.[0]?.id?.videoId;
    return typeof id === "string" && /^[\w-]{11}$/.test(id) ? id : null;
  } catch (e) {
    console.warn("[YouTube] erro na busca:", e);
    return null;
  }
}

function removeBlock(html: string, iframe: string): string {
  // Remove o contêiner do vídeo, comentário e a frase "Confira no vídeo abaixo".
  const idx = html.indexOf(iframe);
  if (idx < 0) return html;
  let out = html.replace(iframe, "");
  out = out.replace(/<div class=["']video-container["'][^>]*>\s*<\/div>/gi, "");
  out = out.replace(/<!--\s*CONTAINER DE V[ÍI]DEO[^>]*-->/gi, "");
  out = out.replace(/<p>[^<]*(?:no|neste|nesse) v[íi]deo abaixo[^<]*<\/p>/gi, "");
  return out;
}

export function hasBrokenYouTubeEmbeds(html: string | null | undefined): boolean {
  if (!html) return false;
  SEARCH_EMBED_RE.lastIndex = 0;
  return SEARCH_EMBED_RE.test(html);
}

export async function fixYouTubeEmbeds(html: string, apiKey: string | null): Promise<string> {
  if (!hasBrokenYouTubeEmbeds(html)) return html;
  const iframes = html.match(SEARCH_EMBED_RE) || [];
  let out = html;
  for (const iframe of iframes) {
    const id = apiKey ? await searchVideoId(apiKey, extractQuery(iframe)) : null;
    if (id) {
      const fixed = iframe.replace(/src=["'][^"']*["']/i, `src="https://www.youtube.com/embed/${id}"`);
      out = out.replace(iframe, fixed);
      console.log(`[YouTube] embed de busca trocado pelo vídeo ${id}`);
    } else {
      out = removeBlock(out, iframe);
      console.log("[YouTube] embed de busca removido (sem vídeo real disponível)");
    }
  }
  return out;
}

export async function loadYouTubeKey(supabase: any, encrypted: string | null | undefined): Promise<string | null> {
  if (!encrypted) return null;
  const { data } = await supabase.rpc("decrypt_credential", { enc_key: "", val: encrypted });
  return typeof data === "string" && data.length > 10 ? data : null;
}
