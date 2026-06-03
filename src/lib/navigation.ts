import {
    Users,
    ClipboardList,
    BarChart3,
    ArrowRightLeft,
    Settings,
    Calendar,
    Award,
    Gavel,
    Edit,
    BookCheck,
    BookOpen,
    FileText,
    HelpCircle,
    DollarSign,
    LayoutDashboard,
    Swords,
    Shield,
    UserPlus,
    Home,
    UserCog,
    MoonStar,
    Activity,
    MessageSquare,
    Sparkles,
    Megaphone,
    Bell,
    Database,
    Scale
} from 'lucide-react';

export interface NavItem {
    href: string;
    label: string;
    icon: any;
    primary?: boolean;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
    {
        title: 'الميدان التربوي',
        items: [
            { href: '/sessions', label: 'الحصص اليومية', icon: ClipboardList, primary: true },
            { href: '/management/penalties', label: 'إدارة العقوبات', icon: Gavel },
            { href: '/surahs', label: 'متابعة الحفظ', icon: BookCheck },
            { href: '/dashboard', label: 'إدارة الطلبة', icon: Users },
            { href: '/competition', label: 'المسابقة النهائية', icon: Award },
            { href: '/surah-eval', label: 'تقييم حفظ السور', icon: BookOpen },
            { href: '/reports/daily', label: 'التقرير اليومي', icon: Edit },
        ]
    },
    {
        title: 'بوصلة المتابعة',
        items: [
            { href: '/weekly-tracking', label: 'المتابعة الأسبوعية', icon: Calendar },
            { href: '/student-history', label: 'سجل الطالب', icon: LayoutDashboard },
            { href: '/logs', label: 'سجل النشاطات', icon: Activity },
            { href: '/yearly-performance', label: 'الأداء السنوي', icon: BarChart3 },
            { href: '/reports/student', label: 'تقارير الطلاب', icon: FileText },
            { href: '/parent-communication', label: 'قناة التواصل', icon: MessageSquare },
            { href: '/notifications', label: 'مركز الإشعارات', icon: Bell },
        ]
    },
    {
        title: 'سباق التميز',
        items: [
            { href: '/ranking', label: 'ترتيب الطلبة', icon: Award },
            { href: '/fair-evaluation', label: 'التقييم العادل والشامل', icon: Scale },
            { href: '/league', label: 'دوري التميز', icon: Shield },
            { href: '/points', label: 'نظام النقاط', icon: Gavel },
            { href: '/comparison', label: 'ساحة المقارنة', icon: Swords },
        ]
    },
    {
        title: 'النافذة الإدارية',
        items: [
            { href: '/management/monitoring', label: 'نظام المراقبة', icon: BarChart3, primary: true },
            { href: '/management/sheikh-monitoring', label: 'مراقبة المشايخ', icon: Activity },
            { href: '/admin/broadcast', label: 'مركز الإرسال', icon: Megaphone },
            { href: '/occasions', label: 'المناسبات الدينية', icon: MoonStar },
            { href: '/registrations', label: 'التسجيلات الجديدة', icon: UserPlus },
            { href: '/meetings', label: 'الاجتماعات', icon: Calendar },
            { href: '/admin/admin-docs', label: 'الأوصال الإدارية', icon: ClipboardList },
            { href: '/admin/summer-camp', label: 'مستلزمات المخيم', icon: ClipboardList },
            { href: '/admin/documents', label: 'الوثائق الإدارية', icon: FileText },
            { href: '/updates', label: 'تحديثات الموقع', icon: Sparkles },
            { href: '/data', label: 'إدارة البيانات', icon: ArrowRightLeft },
            { href: '/dues', label: 'المستحقات (فصلي)', icon: DollarSign },
            { href: '/dues/report', label: 'تقارير المستحقات', icon: BarChart3 },
            { href: '/sessions', label: 'أرشيف الحصص & النسخ', icon: Database },
            { href: '/guide', label: 'دليل المستخدم', icon: HelpCircle },

        ]
    },
    {
        title: 'النظام والإعدادات',
        items: [
            { href: '/home', label: 'البوابة الرئيسية', icon: Home },
            { href: '/', label: 'الواجهة العامة', icon: Home },
            { href: '/profile', label: 'الملف الشخصي', icon: UserCog },
            { href: '/settings', label: 'الإعدادات', icon: Settings },
            { href: '/updates', label: 'التحديثات', icon: Sparkles },
        ]
    }
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [];
