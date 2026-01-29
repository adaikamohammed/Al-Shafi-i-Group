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
    Activity
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
            { href: '/surahs', label: 'متابعة الحفظ', icon: BookCheck },
            { href: '/', label: 'إدارة الطلبة', icon: Users },
            { href: '/reports/daily', label: 'التقرير اليومي', icon: Edit },
        ]
    },
    {
        title: 'بوصلة المتابعة',
        items: [
            { href: '/stats', label: 'المتابعة الأسبوعية', icon: Calendar },
            { href: '/student-history', label: 'سجل الطالب', icon: LayoutDashboard },
            { href: '/logs', label: 'سجل النشاطات', icon: Activity },
            { href: '/yearly-performance', label: 'الأداء السنوي', icon: BarChart3 },
            { href: '/reports/student', label: 'تقارير الطلاب', icon: FileText },
        ]
    },
    {
        title: 'سباق التميز',
        items: [
            { href: '/ranking', label: 'ترتيب الطلبة', icon: Award },
            { href: '/league', label: 'دوري التميز', icon: Shield },
            { href: '/points', label: 'نظام النقاط', icon: Gavel },
            { href: '/comparison', label: 'ساحة المقارنة', icon: Swords },
        ]
    },
    {
        title: 'النافذة الإدارية',
        items: [
            { href: '/management/monitoring', label: 'نظام المراقبة', icon: BarChart3, primary: true },
            { href: '/occasions', label: 'المناسبات الدينية', icon: MoonStar },
            { href: '/registrations', label: 'التسجيلات الجديدة', icon: UserPlus },
            { href: '/meetings', label: 'الاجتماعات', icon: Calendar },
            { href: '/admin/admin-docs', label: 'الأوصال الإدارية', icon: ClipboardList },
            { href: '/data', label: 'إدارة البيانات', icon: ArrowRightLeft },
            { href: '/dues', label: 'المستحقات (فصلي)', icon: DollarSign },
            { href: '/guide', label: 'دليل المستخدم', icon: HelpCircle },
        ]
    }
];

export const BOTTOM_NAV_ITEMS = [
    { href: '/home', label: 'البوابة الرئيسية', icon: Home },
    { href: '/profile', label: 'الملف الشخصي', icon: UserCog },
    { href: '/settings', label: 'الإعدادات', icon: Settings },
];
