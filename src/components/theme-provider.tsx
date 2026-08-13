import { createContext, useContext, useEffect, useMemo, useState } from "react"

type Theme = "dark" | "light" | "system"
type PaletteName = "lime" | "indigo" | "ocean" | "violet" | "rose" | "emerald" | "cyan" | "amber" | "graphite" | "coral" | "custom"

type Palette = {
  name: PaletteName
  label: string
  primary: string
  primaryForeground: string
  accent: string
  accentForeground: string
}

export const UI_PALETTES: Palette[] = [
  { name: "lime", label: "Lime Tech", primary: "83 100% 54%", primaryForeground: "0 0% 4%", accent: "83 100% 54%", accentForeground: "0 0% 4%" },
  { name: "indigo", label: "Indigo Pro", primary: "239 84% 67%", primaryForeground: "0 0% 100%", accent: "245 78% 72%", accentForeground: "245 35% 12%" },
  { name: "ocean", label: "Ocean Blue", primary: "211 100% 52%", primaryForeground: "0 0% 100%", accent: "198 91% 55%", accentForeground: "206 45% 10%" },
  { name: "violet", label: "Modern Violet", primary: "267 84% 61%", primaryForeground: "0 0% 100%", accent: "280 78% 65%", accentForeground: "280 42% 10%" },
  { name: "rose", label: "Rose Studio", primary: "346 77% 58%", primaryForeground: "0 0% 100%", accent: "331 78% 62%", accentForeground: "335 40% 10%" },
  { name: "emerald", label: "Emerald SaaS", primary: "158 64% 45%", primaryForeground: "0 0% 100%", accent: "151 55% 52%", accentForeground: "155 45% 9%" },
  { name: "cyan", label: "Cyan Future", primary: "188 86% 45%", primaryForeground: "190 50% 8%", accent: "181 78% 50%", accentForeground: "185 50% 8%" },
  { name: "amber", label: "Amber Premium", primary: "38 92% 50%", primaryForeground: "30 45% 8%", accent: "45 93% 58%", accentForeground: "35 48% 8%" },
  { name: "graphite", label: "Graphite", primary: "215 20% 65%", primaryForeground: "222 47% 8%", accent: "215 16% 58%", accentForeground: "222 47% 8%" },
  { name: "coral", label: "Coral Product", primary: "14 90% 62%", primaryForeground: "0 0% 100%", accent: "24 95% 60%", accentForeground: "20 45% 8%" },
]

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
  palette: PaletteName
  setPalette: (palette: PaletteName) => void
  customPrimary: string
  customAccent: string
  setCustomColors: (primary: string, accent: string) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  palette: "lime",
  setPalette: () => null,
  customPrimary: "#a3ff12",
  customAccent: "#7c3aed",
  setCustomColors: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function hexToHsl(hex: string) {
  const clean = hex.replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "83 100% 54%"
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break
      case g: h = 60 * ((b - r) / d + 2); break
      default: h = 60 * ((r - g) / d + 4)
    }
  }
  if (h < 0) h += 360
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function foregroundForHex(hex: string) {
  const clean = hex.replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "0 0% 4%"
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.58 ? "0 0% 5%" : "0 0% 100%"
}

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "a3-dashboard-theme", ...props }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(storageKey) as Theme) || defaultTheme)
  const [palette, setPaletteState] = useState<PaletteName>(() => (localStorage.getItem("a3-ui-palette") as PaletteName) || "lime")
  const [customPrimary, setCustomPrimary] = useState(() => localStorage.getItem("a3-ui-custom-primary") || "#a3ff12")
  const [customAccent, setCustomAccent] = useState(() => localStorage.getItem("a3-ui-custom-accent") || "#7c3aed")

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    if (theme === "system") {
      root.classList.add(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement
    const current = palette === "custom"
      ? { primary: hexToHsl(customPrimary), primaryForeground: foregroundForHex(customPrimary), accent: hexToHsl(customAccent), accentForeground: foregroundForHex(customAccent) }
      : UI_PALETTES.find((item) => item.name === palette) || UI_PALETTES[0]

    root.style.setProperty("--primary", current.primary)
    root.style.setProperty("--primary-foreground", current.primaryForeground)
    root.style.setProperty("--accent", current.accent)
    root.style.setProperty("--accent-foreground", current.accentForeground)
    root.style.setProperty("--ring", current.primary)
    root.style.setProperty("--sidebar-primary", current.primary)
    root.style.setProperty("--sidebar-primary-foreground", current.primaryForeground)
    root.style.setProperty("--subtitle-highlight", current.primary)
  }, [palette, customPrimary, customAccent, theme])

  const value = useMemo(() => ({
    theme,
    setTheme: (next: Theme) => {
      localStorage.setItem(storageKey, next)
      setThemeState(next)
    },
    palette,
    setPalette: (next: PaletteName) => {
      localStorage.setItem("a3-ui-palette", next)
      setPaletteState(next)
    },
    customPrimary,
    customAccent,
    setCustomColors: (primary: string, accent: string) => {
      localStorage.setItem("a3-ui-custom-primary", primary)
      localStorage.setItem("a3-ui-custom-accent", accent)
      localStorage.setItem("a3-ui-palette", "custom")
      setCustomPrimary(primary)
      setCustomAccent(accent)
      setPaletteState("custom")
    },
  }), [theme, storageKey, palette, customPrimary, customAccent])

  return <ThemeProviderContext.Provider {...props} value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = () => useContext(ThemeProviderContext)
