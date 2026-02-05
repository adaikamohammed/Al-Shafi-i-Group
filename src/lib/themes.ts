export interface PortalTheme {
    id: string;
    name: string;
    gradient: string;
    accent: string;
    preview: string;
    isLight?: boolean;
}

export const PORTAL_THEMES: Record<string, PortalTheme> = {
    midnight: {
        id: "midnight",
        name: "ليلة النجوم",
        gradient: "from-slate-950 via-slate-900 to-indigo-950",
        accent: "indigo",
        preview: "bg-slate-900"
    },
    emerald: {
        id: "emerald",
        name: "الواحة الخضراء",
        gradient: "from-emerald-950 via-teal-950 to-slate-900",
        accent: "emerald",
        preview: "bg-emerald-900"
    },
    sakura: {
        id: "sakura",
        name: "أزهار الكرز",
        gradient: "from-pink-100 via-rose-50 to-white",
        accent: "rose",
        preview: "bg-gradient-to-r from-pink-400 to-rose-400",
        isLight: true
    },
    golden_luxe: {
        id: "golden_luxe",
        name: "الفخامة الذهبية",
        gradient: "from-slate-950 via-neutral-900 to-amber-950",
        accent: "amber",
        preview: "bg-gradient-to-r from-amber-600 to-yellow-600"
    }
};
