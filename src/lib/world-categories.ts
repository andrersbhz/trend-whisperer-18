export const WORLD_SUBCATEGORIES = [
  { key: 'sports', name: 'Sports' },
  { key: 'technology', name: 'Technology' },
  { key: 'finance', name: 'Finance' },
  { key: 'politics', name: 'Politics' },
  { key: 'entertainment', name: 'Entertainment' },
  { key: 'health', name: 'Health & Science' },
];

export const baseCategory = (cat?: string | null) =>
  String(cat || 'geral').split(/[\/:>]/)[0].trim().toLowerCase();

/** Adds World children (world/sports...) right after "world" in a category list. */
export function withWorldSubs(cats: string[]): string[] {
  const out: string[] = [];
  for (const c of cats) {
    if (c.includes('/')) continue;
    out.push(c);
    if (c.trim().toLowerCase() === 'world') {
      for (const s of WORLD_SUBCATEGORIES) out.push(`world/${s.key}`);
    }
  }
  return out;
}

/** "world/sports" -> "World › Sports" */
export function categoryLabel(cat?: string | null): string {
  if (!cat) return 'Geral';
  const [base, sub] = cat.split(/[\/:>]/).map((p) => p.trim());
  if (!sub) return base;
  const s = WORLD_SUBCATEGORIES.find((w) => w.key === sub.toLowerCase() || w.name.toLowerCase() === sub.toLowerCase());
  return `${base} › ${s?.name || sub}`;
}
