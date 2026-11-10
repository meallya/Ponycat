// Urutan menu rapi: media → waktu → info → produktivitas → file
export const ALL_SLIDES = [
  { id: "music", label: "Musik" },
  { id: "timer", label: "Timer" },
  { id: "prayer", label: "Prayer" },
  { id: "clock", label: "Waktu" },
  { id: "notif", label: "Notifikasi" },
  { id: "list", label: "List" },
  { id: "notes", label: "Notes" },
  { id: "temp", label: "Drop File" },
  { id: "convert", label: "Convert" },
  { id: "search", label: "Cari aplikasi" },
];

export const SLIDES = ALL_SLIDES;
export const SLIDE = Object.fromEntries(ALL_SLIDES.map((s, i) => [s.id, i]));

export const BASE_EXPANDED = { w: 580, h: 200 };
export const BASE_COMPACT = { w: 128, h: 34 };
// Notch tertutup saat lirik tampil: lebih lebar supaya satu baris lirik muat
export const BASE_COMPACT_LYRIC = { w: 300, h: 34 };

export const MENU_H = 36;
export const SLIDE_H = 152;

export const DEFAULT_SETTINGS = {
  size: "m",
  scale: 1,
  accent: "#0a84ff",
  menus: ALL_SLIDES.map((s) => s.id),
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem("island-settings");
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    // paksa semua menu aktif (settings UI dihapus)
    return {
      ...DEFAULT_SETTINGS,
      scale: parsed.scale || 1,
      size: parsed.size || "m",
      accent: parsed.accent || DEFAULT_SETTINGS.accent,
      menus: DEFAULT_SETTINGS.menus,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem("island-settings", JSON.stringify(s));
  } catch {
    // ignore
  }
}
