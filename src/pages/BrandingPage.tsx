import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Save, ExternalLink, Palette, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const BrandingPage = () => {
  const { user } = useAuth();
  const { settings, loading, reload } = usePlatformSettings();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

  useEffect(() => setForm(settings), [settings]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("nexa_organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => setIsSuper(!!data));
  }, [user]);

  const update = (k: keyof typeof form, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const handleUpload = async (file: File, kind: "logo" | "favicon") => {
    if (!user) return;
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `brand/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("article-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("article-images").getPublicUrl(path);
      update(kind === "logo" ? "logo_url" : "favicon_url", data.publicUrl);
      toast.success(`${kind === "logo" ? "Logo" : "Favicon"} enviado`);
    } catch (e: any) {
      toast.error(e.message || "Erro no upload");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!settings.id) return toast.error("Configurações não carregadas");
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        brand_name: form.brand_name,
        brand_short: form.brand_short,
        tagline: form.tagline,
        description: form.description,
        logo_url: form.logo_url,
        favicon_url: form.favicon_url,
        hero_video_url: form.hero_video_url,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        cta_primary: form.cta_primary,
        cta_secondary: form.cta_secondary,
        offer_badge: form.offer_badge,
        footer_text: form.footer_text,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    reload();
  };

  if (loading) return <div className="p-12 text-center text-white/60">Carregando...</div>;

  if (!isSuper) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <ShieldCheck className="h-12 w-12 mx-auto text-lime-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
        <p className="text-white/60 text-sm">Apenas administradores gerais podem editar a marca da plataforma.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-lime-400 font-bold">Super Admin</p>
          <h1 className="text-3xl font-black text-white">Marca e Identidade</h1>
          <p className="text-white/60 text-sm mt-1">
            Personalize nome, logo, cores e textos da página de vendas e do sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/vendas" target="_blank">
            <Button variant="outline" className="border-white/20 bg-white/5 text-white">
              <ExternalLink className="h-4 w-4 mr-2" /> Ver página
            </Button>
          </Link>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-[#a3ff12] text-[#0a1128] font-bold hover:bg-[#a3ff12] hover:shadow-[0_0_16px_rgba(163,255,18,0.7)] hover:-translate-y-0.5 transition-all"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {/* Identidade */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <ImageIcon className="h-5 w-5 text-lime-400" />
          <h2 className="text-lg font-bold text-white">Identidade Visual</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-white">Nome completo</Label>
            <Input value={form.brand_name} onChange={(e) => update("brand_name", e.target.value)}
              className="bg-slate-950 border-slate-700 text-white" />
          </div>
          <div>
            <Label className="text-white">Nome curto / abreviação</Label>
            <Input value={form.brand_short} onChange={(e) => update("brand_short", e.target.value)}
              className="bg-slate-950 border-slate-700 text-white" />
          </div>
        </div>

        <div>
          <Label className="text-white">Tagline (headline principal)</Label>
          <Input value={form.tagline} onChange={(e) => update("tagline", e.target.value)}
            className="bg-slate-950 border-slate-700 text-white" />
        </div>

        <div>
          <Label className="text-white">Descrição (subheadline)</Label>
          <Textarea value={form.description} onChange={(e) => update("description", e.target.value)}
            rows={3} className="bg-slate-950 border-slate-700 text-white" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-white flex items-center gap-2">Logo</Label>
            <div className="flex items-center gap-3 mt-2">
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-lg object-contain bg-slate-950 border border-slate-700 p-1" />
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")} />
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white cursor-pointer" disabled={uploading === "logo"}>
                  <span><Upload className="h-4 w-4 mr-2" />{uploading === "logo" ? "Enviando..." : "Enviar logo"}</span>
                </Button>
              </label>
            </div>
            <Input value={form.logo_url || ""} onChange={(e) => update("logo_url", e.target.value)}
              placeholder="ou cole uma URL"
              className="bg-slate-950 border-slate-700 text-white mt-2 text-xs" />
          </div>
          <div>
            <Label className="text-white">Favicon</Label>
            <div className="flex items-center gap-3 mt-2">
              {form.favicon_url && (
                <img src={form.favicon_url} alt="Favicon" className="h-14 w-14 rounded-lg object-contain bg-slate-950 border border-slate-700 p-1" />
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon")} />
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white cursor-pointer" disabled={uploading === "favicon"}>
                  <span><Upload className="h-4 w-4 mr-2" />{uploading === "favicon" ? "Enviando..." : "Enviar favicon"}</span>
                </Button>
              </label>
            </div>
            <Input value={form.favicon_url || ""} onChange={(e) => update("favicon_url", e.target.value)}
              placeholder="ou cole uma URL"
              className="bg-slate-950 border-slate-700 text-white mt-2 text-xs" />
          </div>
        </div>

        <div>
          <Label className="text-white">Vídeo do hero (URL .mp4)</Label>
          <Input value={form.hero_video_url || ""} onChange={(e) => update("hero_video_url", e.target.value)}
            placeholder="https://..." className="bg-slate-950 border-slate-700 text-white" />
        </div>
      </Card>

      {/* Cores */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Palette className="h-5 w-5 text-lime-400" />
          <h2 className="text-lg font-bold text-white">Cores da Marca</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-white">Cor primária</Label>
            <div className="flex gap-2 mt-1">
              <input type="color" value={form.primary_color}
                onChange={(e) => update("primary_color", e.target.value)}
                className="h-10 w-16 rounded cursor-pointer bg-transparent" />
              <Input value={form.primary_color} onChange={(e) => update("primary_color", e.target.value)}
                className="bg-slate-950 border-slate-700 text-white" />
            </div>
          </div>
          <div>
            <Label className="text-white">Cor de destaque</Label>
            <div className="flex gap-2 mt-1">
              <input type="color" value={form.accent_color}
                onChange={(e) => update("accent_color", e.target.value)}
                className="h-10 w-16 rounded cursor-pointer bg-transparent" />
              <Input value={form.accent_color} onChange={(e) => update("accent_color", e.target.value)}
                className="bg-slate-950 border-slate-700 text-white" />
            </div>
          </div>
        </div>
      </Card>

      {/* Textos de vendas */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white pb-2 border-b border-slate-800">Textos da Página de Vendas</h2>
        <div>
          <Label className="text-white">Selo de oferta</Label>
          <Input value={form.offer_badge || ""} onChange={(e) => update("offer_badge", e.target.value)}
            className="bg-slate-950 border-slate-700 text-white" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-white">Botão primário (CTA)</Label>
            <Input value={form.cta_primary} onChange={(e) => update("cta_primary", e.target.value)}
              className="bg-slate-950 border-slate-700 text-white" />
          </div>
          <div>
            <Label className="text-white">Botão secundário</Label>
            <Input value={form.cta_secondary} onChange={(e) => update("cta_secondary", e.target.value)}
              className="bg-slate-950 border-slate-700 text-white" />
          </div>
        </div>
        <div>
          <Label className="text-white">Texto do rodapé (opcional)</Label>
          <Input value={form.footer_text || ""} onChange={(e) => update("footer_text", e.target.value)}
            className="bg-slate-950 border-slate-700 text-white" />
        </div>
      </Card>

      {/* Contato */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white pb-2 border-b border-slate-800">Contato</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-white">E-mail</Label>
            <Input type="email" value={form.contact_email || ""}
              onChange={(e) => update("contact_email", e.target.value)}
              className="bg-slate-950 border-slate-700 text-white" />
          </div>
          <div>
            <Label className="text-white">Telefone / WhatsApp</Label>
            <Input value={form.contact_phone || ""}
              onChange={(e) => update("contact_phone", e.target.value)}
              className="bg-slate-950 border-slate-700 text-white" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end pt-4">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-[#a3ff12] text-[#0a1128] font-bold hover:bg-[#a3ff12] hover:shadow-[0_0_16px_rgba(163,255,18,0.7)] hover:-translate-y-0.5 transition-all"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default BrandingPage;
