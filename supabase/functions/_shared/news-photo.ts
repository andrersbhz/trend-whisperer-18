export interface NewsPhoto {
  url: string;
  source: string;
  caption: string;
  publishedAt: string;
  license: string;
}

// Reject non-public targets and redirects: source URLs never receive router credentials.
export function publicPhotoUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password &&
      !u.hostname.includes(':') && !/^\d+(\.\d+){3}$/.test(u.hostname) &&
      u.hostname.includes('.') && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname);
  } catch { return false; }
}

function decode(text: string) {
  return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]*>/g, '').trim();
}

export function photoFromPage(html: string, source: string): NewsPhoto | null {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  const meta = (name: string) => {
    for (const tag of tags) {
      const key = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
      if (key === name) return decode(tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] || '');
    }
    return '';
  };
  const license = meta('image:license');
  // Page copyright notices do not grant image reuse. Require explicit image licensing metadata.
  if (!/^https:\/\/creativecommons\.org\/(licenses\/by(?:-sa)?\/|publicdomain\/)/i.test(license)) return null;
  const url = meta('og:image');
  const publishedAt = meta('article:published_time');
  const age = Date.now() - Date.parse(publishedAt);
  if (!publicPhotoUrl(url) || !Number.isFinite(age) || age < 0 || age > 7 * 86400_000) return null;
  const caption = meta('og:image:alt');
  if (!caption) return null;
  return { url, source, caption, publishedAt, license };
}

export async function searchNewsPhoto(title: string, sources: string[] = []): Promise<NewsPhoto[]> {
  let urls = sources.filter(publicPhotoUrl);
  try {
    const rss = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(title)}&format=RSS&sortbydate=1`,
      { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (rss.ok) {
      const xml = await rss.text();
      for (const m of xml.matchAll(/<link>([\s\S]*?)<\/link>/g)) {
        const link = decode(m[1]);
        const wrapped = link.match(/[?&]url=([^&]+)/)?.[1];
        const url = wrapped ? decodeURIComponent(wrapped) : link;
        if (publicPhotoUrl(url) && !/bing\.com/.test(new URL(url).hostname)) urls.push(url);
      }
    }
  } catch { /* existing editorial sources remain available */ }
  const photos = await Promise.all([...new Set(urls)].slice(0, 4).map(async source => {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
      return photoFromPage((await response.text()).slice(0, 500_000), source);
    } catch { return null; }
  }));
  return photos.filter((photo): photo is NewsPhoto => photo !== null)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}