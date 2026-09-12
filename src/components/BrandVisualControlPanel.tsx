import { useEffect, useMemo, useState } from "react";
import { Check, Palette, Save, Settings2, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { DEFAULT_BRAND_THEME, normalizeBrandTheme, type BrandThemeSettings } from "@/lib/brand-theme";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const COLOR_FIELDS: Array<[keyof BrandThemeSettings, string]> = [
  ["background_color", "Fundo do sistema"],
  ["card_color", "Cards / painéis"],
  ["popover_color", "Menus / popovers"],
  ["sidebar_color", "Sidebar"],
  ["secondary_color", "Superfície secundária"],
  ["muted_color", "Superfície neutra"],
  ["input_color", "Campos / inputs"],
  ["border_color", "Bordas"],
  ["text_color", "Texto principal"],
  ["muted_text_color", "Texto secundário"],
  ["link_color", "Links"],
  ["link_hover_color", "Links no hover"],
  ["success_color", "Sucesso / conectado"],
  ["warning_color", "Avisos"],
  ["danger_color", "Erro / destrutivo"],
  ["sales_background_color", "Vendas: fundo"],
  ["sales_surface_color", "Vendas: cards"],
  ["sales_text_color", "Vendas: texto"],
  ["sales_muted_text_color", "Vendas: texto secundário"],
  ["primary_button_bg", "Botão primário: fundo"],
  ["primary_button_text", "Botão primário: texto"],
  ["primary_button_hover_bg", "Botão primário: hover fundo"],
  ["primary_button_hover_text", "Botão primário: hover texto"],
  ["secondary_button_bg", "Botão secundário: fundo"],
  ["secondary_button_text", "Botão secundário: texto"],
  ["secondary_button_hover_bg", "Botão secundário: hover fundo"],
  ["secondary_button_hover_text", "Botão secundário: hover texto"],
];

type Preset = {
  id: string;
  name: string;
  description: string;
  colors: [string, string, string, string];
  values: Partial<BrandThemeSettings>;
};

const COLOR_PRESETS: Preset[] = [
  {
    id: "black-neon", name: "Black Neon", description: "Preto, lima e lilás",
    colors: ["#000000", "#050505", "#a3ff12", "#b57bff"],
    values: { background_color: "#000000", card_color: "#050505", popover_color: "#080808", sidebar_color: "#000000", secondary_color: "#141414", muted_color: "#1a1a1a", input_color: "#111111", border_color: "#262626", text_color: "#ffffff", muted_text_color: "#b8b8bf", link_color: "#a3ff12", link_hover_color: "#b57bff", sales_background_color: "#05010f", sales_surface_color: "#0d0718", sales_text_color: "#ffffff", sales_muted_text_color: "#b9b5c4", primary_button_bg: "#a3ff12", primary_button_text: "#050505", primary_button_hover_bg: "#b57bff", primary_button_hover_text: "#ffffff", secondary_button_bg: "#151515", secondary_button_text: "#ffffff", secondary_button_hover_bg: "#2a2a2a", secondary_button_hover_text: "#ffffff", neon_border_color: "#b57bff" },
  },
  {
    id: "graphite-cyan", name: "Grafite Ciano", description: "Tecnologia e clareza",
    colors: ["#070a0d", "#10161c", "#20d9d2", "#7dd3fc"],
    values: { background_color: "#070a0d", card_color: "#10161c", popover_color: "#121a21", sidebar_color: "#080c10", secondary_color: "#16212a", muted_color: "#1c2933", input_color: "#0c1319", border_color: "#29404d", text_color: "#f4fbff", muted_text_color: "#a7bac5", link_color: "#20d9d2", link_hover_color: "#7dd3fc", sales_background_color: "#070a0d", sales_surface_color: "#10161c", sales_text_color: "#f4fbff", sales_muted_text_color: "#a7bac5", primary_button_bg: "#20d9d2", primary_button_text: "#071012", primary_button_hover_bg: "#7dd3fc", primary_button_hover_text: "#071012", secondary_button_bg: "#16212a", secondary_button_text: "#f4fbff", secondary_button_hover_bg: "#29404d", secondary_button_hover_text: "#ffffff", neon_border_color: "#20d9d2" },
  },
  {
    id: "midnight-coral", name: "Meia-noite Coral", description: "Editorial e marcante",
    colors: ["#09090b", "#18181b", "#fb7185", "#fbbf24"],
    values: { background_color: "#09090b", card_color: "#18181b", popover_color: "#1f1f23", sidebar_color: "#0c0c0f", secondary_color: "#27272a", muted_color: "#303034", input_color: "#141417", border_color: "#3f3f46", text_color: "#fafafa", muted_text_color: "#b8b8c0", link_color: "#fb7185", link_hover_color: "#fbbf24", sales_background_color: "#0d090b", sales_surface_color: "#1b1417", sales_text_color: "#fafafa", sales_muted_text_color: "#c5b7bb", primary_button_bg: "#fb7185", primary_button_text: "#19080d", primary_button_hover_bg: "#fbbf24", primary_button_hover_text: "#1c1200", secondary_button_bg: "#27272a", secondary_button_text: "#fafafa", secondary_button_hover_bg: "#3f3f46", secondary_button_hover_text: "#ffffff", neon_border_color: "#fb7185" },
  },
  {
    id: "forest-gold", name: "Floresta Dourada", description: "Premium e sóbria",
    colors: ["#07110d", "#0e1d16", "#d6b85a", "#4ade80"],
    values: { background_color: "#07110d", card_color: "#0e1d16", popover_color: "#11251b", sidebar_color: "#08150f", secondary_color: "#173025", muted_color: "#1d3a2d", input_color: "#0a1811", border_color: "#315441", text_color: "#f6f7ef", muted_text_color: "#b9c4b8", link_color: "#d6b85a", link_hover_color: "#4ade80", sales_background_color: "#07110d", sales_surface_color: "#0e1d16", sales_text_color: "#f6f7ef", sales_muted_text_color: "#b9c4b8", primary_button_bg: "#d6b85a", primary_button_text: "#171203", primary_button_hover_bg: "#4ade80", primary_button_hover_text: "#06120a", secondary_button_bg: "#173025", secondary_button_text: "#f6f7ef", secondary_button_hover_bg: "#315441", secondary_button_hover_text: "#ffffff", neon_border_color: "#d6b85a" },
  },
  {
    id: "electric-berry", name: "Berry Elétrico", description: "Criativa e vibrante",
    colors: ["#0b0710", "#170f20", "#e879f9", "#60a5fa"],
    values: { background_color: "#0b0710", card_color: "#170f20", popover_color: "#1d1328", sidebar_color: "#0d0813", secondary_color: "#251832", muted_color: "#30203f", input_color: "#120b19", border_color: "#49305c", text_color: "#fdf7ff", muted_text_color: "#c7b5cf", link_color: "#e879f9", link_hover_color: "#60a5fa", sales_background_color: "#0b0710", sales_surface_color: "#170f20", sales_text_color: "#fdf7ff", sales_muted_text_color: "#c7b5cf", primary_button_bg: "#e879f9", primary_button_text: "#18051c", primary_button_hover_bg: "#60a5fa", primary_button_hover_text: "#071323", secondary_button_bg: "#251832", secondary_button_text: "#fdf7ff", secondary_button_hover_bg: "#49305c", secondary_button_hover_text: "#ffffff", neon_border_color: "#e879f9" },
  },
];

export default function BrandVisualControlPanel() {
  const { settings } = usePlatformSettings();
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BrandThemeSettings>(DEFAULT_BRAND_THEME);
  const [selectedPreset, setSelectedPreset] = useState("custom");

  useEffect(() => {
    const id = window.setInterval(() => setPathname(window.location.pathname), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    async function checkAccess() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active || !auth.user) return setAllowed(false);
      const { data } = await supabase
        .from("nexa_organization_members")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "super_admin")
        .eq("status", "active")
        .maybeSingle();
      if (active) setAllowed(!!data);
    }
    checkAccess();
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    const openEditor = () => setOpen(true);
    window.addEventListener("open-brand-visual-editor", openEditor);
    return () => window.removeEventListener("open-brand-visual-editor", openEditor);
  }, []);

  useEffect(() => {
    if (!settings.id || !["/branding", "/admin/system"].includes(pathname) || !allowed) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("theme_json")
          .eq("id", settings.id)
          .maybeSingle();
        if (active) setDraft(normalizeBrandTheme((data as any)?.theme_json));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [settings.id, pathname, allowed]);

  const visible = ["/branding", "/admin/system"].includes(pathname) && allowed;
  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(DEFAULT_BRAND_THEME), [draft]);
  if (!visible) return null;

  const set = <K extends keyof BrandThemeSettings>(key: K, value: BrandThemeSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSelectedPreset("custom");
  };

  function applyPreset(preset: Preset) {
    setDraft((current) => ({ ...current, ...preset.values, neon_border_enabled: true }));
    setSelectedPreset(preset.id);
  }

  async function save() {
    if (!settings.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ theme_json: draft as any, updated_at: new Date().toISOString() } as any)
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("theme_json")
        ? "A coluna theme_json ainda não foi aplicada no banco. Execute a migration incluída neste projeto."
        : error.message);
      return;
    }
    window.dispatchEvent(new CustomEvent("brand-theme-updated", { detail: draft }));
    toast.success("Visual global atualizado");
  }

  function restore() {
    setDraft({ ...DEFAULT_BRAND_THEME });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[120] inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-3 text-sm font-bold text-foreground shadow-2xl transition hover:border-primary"
      >
        <Palette className="h-4 w-4 text-primary" /> Controle visual completo
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] bg-black/55 backdrop-blur-sm" onMouseDown={(e) => e.currentTarget === e.target && setOpen(false)}>
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><Settings2 className="h-4 w-4" /> Marca / Vendas</div>
                <h2 className="mt-1 text-2xl font-black text-foreground">Controle total do visual</h2>
                <p className="mt-1 text-sm text-muted-foreground">Essas opções têm prioridade sobre presets antigos e hardcodes visuais do sistema.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? <div className="py-16 text-center text-muted-foreground">Carregando configurações…</div> : (
                <div className="space-y-7">
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div><h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Paletas modernas</h3><p className="mt-1 text-xs text-muted-foreground">Escolha uma base ou continue ajustando cada detalhe no modo personalizado.</p></div>
                      <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">{selectedPreset === "custom" ? "Personalizado" : "Preset selecionado"}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {COLOR_PRESETS.map((preset) => (
                        <Button key={preset.id} type="button" variant="outline" onClick={() => applyPreset(preset)} className="h-auto justify-start whitespace-normal p-3 text-left">
                          <span className="flex w-full items-center gap-3">
                            <span className="flex shrink-0 overflow-hidden rounded-md border border-border">{preset.colors.map((color) => <span key={color} className="h-9 w-3" style={{ backgroundColor: color }} />)}</span>
                            <span className="min-w-0 flex-1"><strong className="block text-sm text-foreground">{preset.name}</strong><span className="block text-xs text-muted-foreground">{preset.description}</span></span>
                            {selectedPreset === preset.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </span>
                        </Button>
                      ))}
                      <Button type="button" variant="outline" onClick={() => setSelectedPreset("custom")} className="h-auto justify-start whitespace-normal p-3 text-left">
                        <span className="flex w-full items-center gap-3"><span className="grid h-9 w-12 shrink-0 place-items-center rounded-md border border-border bg-muted"><Palette className="h-4 w-4 text-primary" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-foreground">Personalizado</strong><span className="block text-xs text-muted-foreground">Edite todas as opções abaixo</span></span>{selectedPreset === "custom" && <Check className="h-4 w-4 shrink-0 text-primary" />}</span>
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><div><h3 className="text-sm font-bold text-foreground">Bordas com hover neon</h3><p className="text-xs text-muted-foreground">Aplica brilho suave em cards e botões ao passar o mouse.</p></div></div>
                      <Button type="button" size="sm" variant={draft.neon_border_enabled ? "default" : "outline"} onClick={() => set("neon_border_enabled", !draft.neon_border_enabled)}>{draft.neon_border_enabled ? "Ativado" : "Desativado"}</Button>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <ColorField label="Cor do neon" value={draft.neon_border_color} onChange={(value) => set("neon_border_color", value)} />
                      <label><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Intensidade: {draft.neon_border_intensity}%</span><input type="range" min="10" max="100" value={draft.neon_border_intensity} onChange={(event) => set("neon_border_intensity", Number(event.target.value))} className="h-10 w-full accent-primary" /></label>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-foreground">Tipografia</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Fonte do sistema"><input value={draft.font_family_base} onChange={(e) => set("font_family_base", e.target.value)} /></Field>
                      <Field label="Fonte de títulos"><input value={draft.font_family_heading} onChange={(e) => set("font_family_heading", e.target.value)} /></Field>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Aceita pilhas CSS, por exemplo: Inter, Arial, sans-serif. O sistema não força mais Montserrat como fonte visual.</p>
                  </section>

                  <section>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-foreground">Cores globais e página de vendas</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {COLOR_FIELDS.map(([key, label]) => (
                        <ColorField key={key} label={label} value={String(draft[key])} onChange={(value) => set(key, value as never)} />
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-foreground">Formas e profundidade</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Raio de cards"><input value={draft.card_radius} onChange={(e) => set("card_radius", e.target.value)} /></Field>
                      <Field label="Raio de inputs"><input value={draft.input_radius} onChange={(e) => set("input_radius", e.target.value)} /></Field>
                      <Field label="Sombra dos painéis" className="md:col-span-2"><input value={draft.panel_shadow} onChange={(e) => set("panel_shadow", e.target.value)} /></Field>
                    </div>
                  </section>

                  <section className="rounded-xl border border-border bg-card p-4">
                    <h3 className="text-sm font-bold text-foreground">Preview de contraste</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border p-4" style={{ background: draft.card_color, borderColor: draft.border_color, color: draft.text_color }}>
                        <strong>Card do sistema</strong><p className="mt-1 text-sm" style={{ color: draft.muted_text_color }}>Texto secundário e bordas configuráveis.</p>
                      </div>
                      <div className="rounded-xl border p-4" style={{ background: draft.sales_surface_color, borderColor: draft.border_color, color: draft.sales_text_color }}>
                        <strong>Card de vendas</strong><p className="mt-1 text-sm" style={{ color: draft.sales_muted_text_color }}>Visual da landing page.</p>
                      </div>
                      <button className="rounded-lg px-4 py-3 font-bold transition" style={{ background: draft.primary_button_bg, color: draft.primary_button_text }}>Botão primário</button>
                      <button className="rounded-lg px-4 py-3 font-bold transition" style={{ background: draft.secondary_button_bg, color: draft.secondary_button_text }}>Botão secundário</button>
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-4">
              <Button variant="outline" onClick={restore}>Restaurar base neutra</Button>
              <div className="flex items-center gap-2">
                {changed && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
                <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar visual"}</Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={className}><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span><div className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-input [&_input]:bg-background [&_input]:px-3 [&_input]:text-sm [&_input]:text-foreground">{children}</div></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground" />
      </div>
    </label>
  );
}
