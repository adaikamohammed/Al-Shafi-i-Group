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
        name: "ليلة النجوم (أزرق)",
        gradient: "from-slate-950 via-slate-900 to-slate-950",
        accent: "indigo",
        preview: "bg-slate-900"
    },
    emerald: {
        id: "emerald",
        name: "الواحة الخضراء",
        gradient: "from-emerald-950 via-slate-900 to-slate-950",
        accent: "emerald",
        preview: "bg-emerald-900"
    },
    ruby: {
        id: "ruby",
        name: "الياقوت الملكي (أحمر)",
        gradient: "from-rose-950 via-slate-900 to-slate-950",
        accent: "rose",
        preview: "bg-rose-900"
    },
    amber: {
        id: "amber",
        name: "شمس الضحى (ذهبي)",
        gradient: "from-amber-950 via-slate-900 to-slate-950",
        accent: "amber",
        preview: "bg-amber-900"
    },
    aurora: {
        id: "aurora",
        name: "أورورا (متدرج)",
        gradient: "from-indigo-950 via-purple-900 to-rose-900",
        accent: "purple",
        preview: "bg-gradient-to-r from-indigo-500 to-purple-500"
    },
    deep_ocean: {
        id: "deep_ocean",
        name: "أعماق المحيط",
        gradient: "from-cyan-950 via-slate-900 to-slate-950",
        accent: "cyan",
        preview: "bg-cyan-900"
    },
    classic: {
        id: "classic",
        name: "الأصالة الكلاسيكية (أبيض × ذهبي)",
        gradient: "from-slate-100 via-slate-50 to-slate-100",
        accent: "amber",
        preview: "bg-white",
        isLight: true
    }
};
