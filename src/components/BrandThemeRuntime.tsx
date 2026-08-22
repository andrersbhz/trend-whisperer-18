import { useEffect } from "react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

function hexToHsl(hex: string, fallback: string) {
  const normalized = hex?.trim();
  if (!/^#([0-9a-f]{6})$/i.test(normalized || "")) return fallback;
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function contrastForeground(hex: string, light = "0 0% 100%", dark = "222 47% 9%") {
  if (!/^#([0-9a-f]{6})$/i.test(hex || "")) return light;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? dark : light;
}

export default function BrandThemeRuntime() {
  const { settings } = usePlatformSettings();

  useEffect(() => {
    const root = document.documentElement;
    const primary = settings.primary_color || "#a3ff12";
    const accent = settings.accent_color || "#b57bff";

    root.style.setProperty("--primary", hexToHsl(primary, "83 100% 54%"));
    root.style.setProperty("--primary-foreground", contrastForeground(primary));
    root.style.setProperty("--accent", hexToHsl(accent, "266 100% 74%"));
    root.style.setProperty("--accent-foreground", contrastForeground(accent));
    root.style.setProperty("--ring", hexToHsl(primary, "83 100% 54%"));
    root.style.setProperty("--brand-button-radius", settings.button_radius || "0.5rem");
    root.style.setProperty("--brand-font-color-base", settings.font_color_base || "#ffffff");
    root.style.setProperty("--brand-font-color-muted", settings.font_color_muted || "rgba(255,255,255,0.6)");

    const hoverShadow = settings.button_hover_style === "glow"
      ? `0 0 18px ${primary}66`
      : settings.button_hover_style === "outline"
        ? "none"
        : settings.button_hover_style === "scale"
          ? "0 10px 24px rgba(0,0,0,.18)"
          : "0 8px 20px rgba(0,0,0,.16)";
    root.style.setProperty("--brand-button-hover-shadow", hoverShadow);

    document.body.dataset.buttonHoverStyle = settings.button_hover_style || "standard";
  }, [settings]);

  return null;
}
