// ─────────────────────────────────────────────────────────────────────────────
// Motor editorial compartilhado do PostWP
// Descoberta de fontes, ranking de tendências, verificação factual e de entidades.
// Usado por fetch-trends e generate-articles.
// ─────────────────────────────────────────────────────────────────────────────

export interface SourceRef {
  source_url: string;
  source_name: string;
  source_type: "news" | "official" | "entertainment" | "economy" | "international" | "aggregator";
  published_at: string | null;
  accessed_at: string;
  reliability_score: number; // 0..1
  title: string;
  snippet: string;
}

export interface TrendScoreInput {
  searchVolume?: string | number | null;
  sourceCount: number;
  avgReliability: number;
  ageHours: number;
  updateCount?: number;
  isPriorityCategory?: boolean;
  hasImageCandidate?: boolean;
}

export interface TrendScoreResult {
  trend_score: number;
  seo_potential: number;
  discover_potential: number;
  growth: string;
}

export type VerificationStatus =
  | "verified"
  | "pending"
  | "verification_failed"
  | "source_conflict"
  | "entity_unverified"
  | "image_unverified";

// ── Fontes confiáveis (referências iniciais, não exaustivas) ────────────────

export const TRUSTED_SOURCES: Array<{
  match: RegExp;
  name: string;
  type: SourceRef["source_type"];
  reliability: number;
  feed?: string;
}> = [
  { match: /(^|\.)g1\.globo\.com/i, name: "G1", type: "news", reliability: 0.95, feed: "https://g1.globo.com/rss/g1/" },
  { match: /(^|\.)globo\.com/i, name: "Globo", type: "news", reliability: 0.9 },
  { match: /infomoney\.com\.br/i, name: "InfoMoney", type: "economy", reliability: 0.9, feed: "https://www.infomoney.com.br/feed/" },
  { match: /cnnbrasil\.com\.br/i, name: "CNN Brasil", type: "news", reliability: 0.9, feed: "https://www.cnnbrasil.com.br/feed/" },
  { match: /uol\.com\.br/i, name: "UOL", type: "news", reliability: 0.88, feed: "https://rss.uol.com.br/feed/noticias.xml" },
  { match: /folha\.uol\.com\.br/i, name: "Folha de S.Paulo", type: "news", reliability: 0.92, feed: "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml" },
  { match: /estadao\.com\.br/i, name: "Estadão", type: "news", reliability: 0.92 },
  { match: /valor\.globo\.com/i, name: "Valor Econômico", type: "economy", reliability: 0.93 },
  { match: /agenciabrasil\.ebc\.com\.br/i, name: "Agência Brasil", type: "official", reliability: 0.97, feed: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml" },
  { match: /gov\.br/i, name: "Fonte oficial (gov.br)", type: "official", reliability: 1.0 },
  { match: /bbc\.(com|co\.uk)/i, name: "BBC", type: "international", reliability: 0.95, feed: "https://feeds.bbci.co.uk/portuguese/rss.xml" },
  { match: /reuters\.com/i, name: "Reuters", type: "international", reliability: 0.97 },
  { match: /apnews\.com/i, name: "Associated Press", type: "international", reliability: 0.97 },
  { match: /bloomberg\.com/i, name: "Bloomberg", type: "economy", reliability: 0.93 },
  { match: /cnbc\.com/i, name: "CNBC", type: "economy", reliability: 0.9 },
  { match: /theguardian\.com/i, name: "The Guardian", type: "international", reliability: 0.9, feed: "https://www.theguardian.com/world/rss" },
  { match: /portalleodias\.com/i, name: "Portal LeoDias", type: "entertainment", reliability: 0.8, feed: "https://portalleodias.com/feed/" },
  { match: /metropoles\.com/i, name: "Metrópoles", type: "news", reliability: 0.85 },
  { match: /terra\.com\.br/i, name: "Terra", type: "news", reliability: 0.8 },
  { match: /r7\.com/i, name: "R7", type: "news", reliability: 0.8 },
  { match: /band\.uol\.com\.br|bandnewstv/i, name: "Band", type: "news", reliability: 0.8 },
  { match: /ge\.globo\.com/i, name: "ge (Globo Esporte)", type: "news", reliability: 0.9 },
  { match: /tecmundo\.com\.br|canaltech\.com\.br/i, name: "Tecnologia (TecMundo/Canaltech)", type: "news", reliability: 0.82 },
];

export function classifySource(url: string, fallbackName = ""): {
  name: string;
  type: SourceRef["source_type"];
  reliability: number;
} {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = fallbackName;
  }
  const hit = TRUSTED_SOURCES.find((s) => s.match.test(host) || s.match.test(fallbackName));
  if (hit) return { name: hit.name, type: hit.type, reliability: hit.reliability };
  return { name: fallbackName || host || "Fonte não catalogada", type: "aggregator", reliability: 0.5 };
}

export function isTrusted(url: string, fallbackName = ""): boolean {
  return classifySource(url, fallbackName).reliability >= 0.75;
}

// ── Parsing de RSS ──────────────────────────────────────────────────────────

export const decodeXml = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

export function pickTag(block: string, tagName: string): string {
  const tag = tagName.replace(":", "\\:");
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (m) return decodeXml(m[1]);
  if (tagName.includes(":")) {
    const simple = tagName.split(":")[1];
    const m2 = block.match(new RegExp(`<${simple}[^>]*>([\\s\\S]*?)<\\/${simple}>`, "i"));
    if (m2) return decodeXml(m2[1]);
  }
  return "";
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  sourceLabel: string;
  /** URL do veículo original (atributo url da tag <source>, usado pelo Google News). */
  sourceUrl: string;
}

export function parseRssItems(xml: string, limit = 40): RssItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const out: RssItem[] = [];
  for (const block of blocks.slice(0, limit)) {
    const title = pickTag(block, "title");
    if (!title) continue;
    const rawDate = pickTag(block, "pubDate");
    let iso: string | null = null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) iso = d.toISOString();
    }
    out.push({
      title,
      link: pickTag(block, "link"),
      description: pickTag(block, "description").replace(/<[^>]+>/g, "").slice(0, 400),
      pubDate: iso,
      sourceLabel: pickTag(block, "source"),
      sourceUrl: (block.match(/<source[^>]*url="([^"]+)"/i)?.[1] || "").trim(),
    });
  }
  return out;
}

export async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, text/html, */*",
      },
    });
    if (!resp.ok) {
      console.warn(`[fetchText] ${url} → HTTP ${resp.status}`);
      return null;
    }
    const text = await resp.text();
    return text && text.length > 200 ? text : null;
  } catch (err) {
    console.warn(`[fetchText] ${url} falhou:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── SOURCE_DISCOVERY ────────────────────────────────────────────────────────
// Cruza o assunto com o Google News (que agrega os grandes veículos) e devolve
// a lista de fontes reais que estão cobrindo o mesmo acontecimento.

export async function discoverSources(topic: string, maxItems = 12): Promise<SourceRef[]> {
  const q = encodeURIComponent(`${topic} when:2d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt`;
  const xml = await fetchText(url);
  if (!xml) return [];

  const accessedAt = new Date().toISOString();
  const items = parseRssItems(xml, maxItems * 2);
  const seenHosts = new Set<string>();
  const refs: SourceRef[] = [];

  for (const item of items) {
    // O título do Google News vem como "Manchete - Veículo" e a tag <source url="...">
    // aponta para o site do veículo original (o <link> é um redirecionador do Google).
    const parts = item.title.split(" - ");
    const label = item.sourceLabel || (parts.length > 1 ? parts[parts.length - 1] : "");
    const headline = parts.length > 1 ? parts.slice(0, -1).join(" - ") : item.title;
    const originUrl = item.sourceUrl || item.link;
    const meta = classifySource(originUrl, label);
    // Fontes independentes: uma por domínio de veículo.
    let hostKey = meta.name.toLowerCase();
    try {
      hostKey = new URL(originUrl).hostname.replace(/^www\./, "").toLowerCase();
    } catch { /* mantém o nome como chave */ }
    if (!hostKey || seenHosts.has(hostKey)) continue;
    seenHosts.add(hostKey);
    refs.push({
      source_url: item.link || originUrl,
      source_name: meta.name === "Fonte não catalogada" && label ? label : meta.name,
      source_type: meta.type,
      published_at: item.pubDate,
      accessed_at: accessedAt,
      reliability_score: meta.reliability,
      title: headline,
      snippet: item.description,
    });
    if (refs.length >= maxItems) break;
  }


  refs.sort((a, b) => b.reliability_score - a.reliability_score);
  return refs;
}

// ── TREND_SCORING ───────────────────────────────────────────────────────────

export function parseVolume(v: string | number | null | undefined): number {
  if (typeof v === "number") return v;
  const s = (v || "").toString().toLowerCase();
  const digits = s.replace(/[^0-9]/g, "");
  if (digits) return parseInt(digits, 10);
  if (s.includes("alto") || s.includes("high")) return 20000;
  if (s.includes("médio") || s.includes("medio") || s.includes("medium")) return 5000;
  if (s.includes("baixo") || s.includes("low")) return 1000;
  if (s.includes("evergreen")) return 0;
  return 2000;
}

export function computeTrendScore(input: TrendScoreInput): TrendScoreResult {
  const volume = parseVolume(input.searchVolume);
  // Volume (0..30) em escala logarítmica
  const volumeScore = Math.min(30, volume > 0 ? Math.log10(volume + 1) * 6 : 0);
  // Recência (0..25): notícia das últimas 3h vale o máximo, cai até 48h
  const recencyScore = Math.max(0, 25 - Math.max(0, input.ageHours - 3) * (25 / 45));
  // Repercussão / número de fontes (0..25)
  const sourcesScore = Math.min(25, input.sourceCount * 5);
  // Confiabilidade média das fontes (0..15)
  const reliabilityScore = Math.max(0, Math.min(15, input.avgReliability * 15));
  // Recorrência da tendência entre coletas (0..5)
  const repeatScore = Math.min(5, (input.updateCount || 1) - 1);
  const priorityBoost = input.isPriorityCategory ? 8 : 0;

  const raw = volumeScore + recencyScore + sourcesScore + reliabilityScore + repeatScore + priorityBoost;
  const trend_score = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;

  // Potencial SEO: demanda de busca + confiabilidade
  const seo_potential = Math.round(Math.min(100, volumeScore * 2.2 + reliabilityScore * 1.5 + sourcesScore));
  // Potencial Discover: atualidade + repercussão + imagem disponível
  const discover_potential = Math.round(
    Math.min(100, recencyScore * 2.4 + sourcesScore * 1.4 + (input.hasImageCandidate ? 10 : 0)),
  );

  let growth = "estável";
  if (recencyScore > 18 && input.sourceCount >= 3) growth = "explosivo";
  else if (recencyScore > 12 && input.sourceCount >= 2) growth = "em alta";
  else if (input.ageHours > 36) growth = "em queda";

  return { trend_score, seo_potential, discover_potential, growth };
}

// ── DUPLICATE_CHECK ─────────────────────────────────────────────────────────

export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "no", "na", "nos", "nas",
  "para", "por", "com", "um", "uma", "que", "se", "ao", "the", "of", "and", "to", "in",
]);

export function keywordSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

/** Similaridade de Jaccard entre dois textos (0..1). */
export function similarity(a: string, b: string): number {
  const A = keywordSet(a);
  const B = keywordSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function findDuplicate(
  candidate: string,
  existing: Array<{ id: string; title: string; trending_topic?: string | null; slug?: string | null }>,
  threshold = 0.55,
): { id: string; title: string; score: number } | null {
  let best: { id: string; title: string; score: number } | null = null;
  for (const art of existing) {
    const score = Math.max(
      similarity(candidate, art.title || ""),
      similarity(candidate, art.trending_topic || ""),
    );
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: art.id, title: art.title, score: Math.round(score * 100) / 100 };
    }
  }
  return best;
}

// ── Slug ────────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return normalizeText(text).replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80).replace(/^-|-$/g, "");
}

// ── Registro de falhas de serviço (item 13 do briefing) ─────────────────────

export interface PipelineEvent {
  stage: string;
  status: "ok" | "skipped" | "failed";
  detail?: string;
  at: string;
  attempt?: number;
  fallback?: string;
}

export class PipelineLog {
  private events: PipelineEvent[] = [];
  add(stage: string, status: PipelineEvent["status"], detail?: string, extra?: Partial<PipelineEvent>) {
    const ev: PipelineEvent = { stage, status, detail, at: new Date().toISOString(), ...extra };
    this.events.push(ev);
    console.log(`[Pipeline:${stage}] ${status}${detail ? ` — ${detail}` : ""}`);
    return ev;
  }
  toJSON() {
    return this.events;
  }
}
