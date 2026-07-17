import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformSettings {
  id: string;
  brand_name: string;
  brand_short: string;
  tagline: string;
  description: string;
  logo_url: string | null;
  favicon_url: string | null;
  hero_video_url: string | null;
  primary_color: string;
  accent_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  cta_primary: string;
  cta_secondary: string;
  offer_badge: string | null;
  footer_text: string | null;
}

const DEFAULTS: PlatformSettings = {
  id: "",
  brand_name: "A3 Plataforma",
  brand_short: "A3",
  tagline: "Seu portal no piloto automático com o poder da IA",
  description:
    "Publique 3 artigos por dia, distribua em Meta/Instagram, indexe no Google e escale seu tráfego sem contratar redatores.",
  logo_url: null,
  favicon_url: null,
  hero_video_url: "https://cdn.pixabay.com/video/2023/10/26/186098-878428480_large.mp4",
  primary_color: "#a3ff12",
  accent_color: "#b57bff",
  contact_email: "contato@a3plataforma.com",
  contact_phone: null,
  cta_primary: "Começar agora — 7 dias grátis",
  cta_secondary: "Ver planos e preços",
  offer_badge: "OFERTA DE LANÇAMENTO — apenas 47 vagas restantes",
  footer_text: null,
};

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) setSettings({ ...DEFAULTS, ...(data as any) });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { settings, loading, reload: load };
}
