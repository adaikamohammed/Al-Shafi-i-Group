export type UserRole = 'sheikh' | 'super_admin' | 'management';

export interface PagePermission {
    path: string;
    label: string;
    icon: string;
    allowedRoles: UserRole[];
}

export const PAGE_PERMISSIONS: PagePermission[] = [
    { path: '/home', label: 'الرئيسية', icon: 'Home', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/data', label: 'إدارة الطلبة', icon: 'Users', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/sessions', label: 'الحصص اليومية', icon: 'Calendar', allowedRoles: ['sheikh', 'super_admin'] },
    { path: '/registrations', label: 'التسجيلات', icon: 'UserPlus', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/surahs', label: 'السور', icon: 'Book', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/points', label: 'النقاط', icon: 'Award', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/ranking', label: 'الترتيب', icon: 'TrendingUp', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/league', label: 'الدوري', icon: 'Trophy', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/comparison', label: 'المقارنة', icon: 'BarChart3', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/dues', label: 'الاشتراكات', icon: 'DollarSign', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/reports', label: 'التقارير', icon: 'FileText', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/stats', label: 'الإحصائيات', icon: 'PieChart', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/yearly-performance', label: 'الأداء السنوي', icon: 'TrendingUp', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/student-history', label: 'تاريخ الطالب', icon: 'History', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/profile', label: 'الملف الشخصي', icon: 'User', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/logs', label: 'سجل النشاطات', icon: 'Activity', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/settings', label: 'الإعدادات', icon: 'Settings', allowedRoles: ['super_admin', 'management'] },
    { path: '/management/monitoring', label: 'نظام المراقبة', icon: 'BarChart3', allowedRoles: ['super_admin', 'management'] },
    { path: '/admin/admin-docs', label: 'الأوصال الإدارية', icon: 'ClipboardList', allowedRoles: ['sheikh', 'super_admin', 'management'] },
    { path: '/guide', label: 'الدليل', icon: 'HelpCircle', allowedRoles: ['sheikh', 'super_admin', 'management'] },
];

/**
 * Check if a user with a specific role can access a page
 */
export const canAccessPage = (path: string, role: UserRole | null): boolean => {
    if (!role) return false;

    // Find the page permission that matches the path
    const page = PAGE_PERMISSIONS.find(p => path.startsWith(p.path));

    // If page is not in the list, allow access by default
    if (!page) return true;

    // Check if the role is allowed
    return page.allowedRoles.includes(role);
};

/**
 * Get all pages that a user with a specific role can access
 */
export const getAllowedPages = (role: UserRole | null): PagePermission[] => {
    if (!role) return [];
    return PAGE_PERMISSIONS.filter(page => page.allowedRoles.includes(role));
};

/**
 * Check if a role has management privileges (can see all groups)
 */
export const hasManagementPrivileges = (role: UserRole | null): boolean => {
    return role === 'super_admin' || role === 'management';
};
