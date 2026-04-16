"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import {
    Loader2, BarChart3, CheckCircle, XCircle, FileX,
    Users, DollarSign, Printer, ChevronDown, ChevronUp,
    TrendingUp, Filter, Download
} from 'lucide-react';
import { getYear, getQuarter, parseISO } from 'date-fns';
import type { PaymentStatus } from '@/lib/types';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

// ── أسماء الفصول ──────────────────────────────────────────────
const QUARTER_NAMES: Record<number, string> = {
    1: 'الفصل الأول (جانفي - مارس)',
    2: 'الفصل الثاني (أفريل - جوان)',
    3: 'الفصل الثالث (جويلية - سبتمبر)',
    4: 'الفصل الرابع (أكتوبر - ديسمبر)',
};

// ── عرض حالة الدفع ────────────────────────────────────────────
const STATUS_CONFIG: Record<PaymentStatus, { label: string; bgClass: string; textClass: string; icon: React.ElementType }> = {
    paid: { label: 'مدفوع', bgClass: 'bg-emerald-100 dark:bg-emerald-900/30', textClass: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle },
    unpaid: { label: 'غير مدفوع', bgClass: 'bg-rose-100 dark:bg-rose-900/30', textClass: 'text-rose-700 dark:text-rose-300', icon: XCircle },
    exempted: { label: 'معفى', bgClass: 'bg-sky-100 dark:bg-sky-900/30', textClass: 'text-sky-700 dark:text-sky-300', icon: FileX },
};

// ── شريط تقدم مرئي ────────────────────────────────────────────
function ProgressBar({ paid, exempted, total }: { paid: number; exempted: number; total: number }) {
    const paidPct = total > 0 ? (paid / total) * 100 : 0;
    const exemptPct = total > 0 ? (exempted / total) * 100 : 0;

    return (
        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
            <div
                className="h-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${paidPct}%` }}
                title={`مدفوع: ${paid}`}
            />
            <div
                className="h-full bg-sky-400 transition-all duration-700"
                style={{ width: `${exemptPct}%` }}
                title={`معفى: ${exempted}`}
            />
        </div>
    );
}

// ── بطاقة فوج ────────────────────────────────────────────────
function GroupCard({
    groupName, students, selectedQuarter, prices, isSelected, onToggle
}: {
    groupName: string;
    students: any[];
    selectedQuarter: number;
    prices: Record<string, number>;
    isSelected: boolean;
    onToggle: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const paid = students.filter(s => s.paymentStatus[selectedQuarter]?.status === 'paid');
    const exempted = students.filter(s => s.paymentStatus[selectedQuarter]?.status === 'exempted');
    const unpaid = students.filter(s => {
        const st = s.paymentStatus[selectedQuarter]?.status;
        return !st || st === 'unpaid';
    });

    const revenue = paid.reduce((sum: number, s: any) => {
        const tier = s.subscriptionTier || 'فئة الأصاغر';
        return sum + (prices[tier] || 0);
    }, 0);

    const paidPct = students.length > 0 ? Math.round((paid.length / students.length) * 100) : 0;

    return (
        <div
            className={cn(
                "rounded-2xl border-2 overflow-hidden transition-all duration-300",
                isSelected
                    ? "border-primary shadow-lg shadow-primary/10"
                    : "border-slate-200 dark:border-white/10"
            )}
        >
            {/* رأس البطاقة - قابل للنقر للتحديد */}
            <div
                className={cn(
                    "p-4 cursor-pointer flex items-center gap-3",
                    isSelected ? "bg-primary/5" : "bg-card"
                )}
                onClick={onToggle}
            >
                {/* مؤشر التحديد */}
                <div className={cn(
                    "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                    isSelected ? "border-primary bg-primary" : "border-slate-300 dark:border-white/20"
                )}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-bold text-sm">{groupName}</h3>
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                ✅ {paid.length}
                            </span>
                            <span className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 font-bold px-2 py-0.5 rounded-full">
                                🔵 {exempted.length}
                            </span>
                            <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 font-bold px-2 py-0.5 rounded-full">
                                ❌ {unpaid.length}
                            </span>
                        </div>
                    </div>
                    <div className="mt-2">
                        <ProgressBar paid={paid.length} exempted={exempted.length} total={students.length} />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>نسبة السداد: <strong className="text-emerald-600">{paidPct}%</strong></span>
                            <span>المحصّل: <strong className="text-amber-600">{revenue.toLocaleString('ar-DZ')} د.ج</strong></span>
                        </div>
                    </div>
                </div>

                {/* زر التوسع */}
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
            </div>

            {/* قائمة الطلاب */}
            {expanded && (
                <div className="border-t border-slate-200 dark:border-white/10 bg-background">
                    {/* القسم المدفوع */}
                    {paid.length > 0 && (
                        <StudentSection title={`مدفوع (${paid.length})`} students={paid} status="paid" quarter={selectedQuarter} />
                    )}
                    {/* المعفى */}
                    {exempted.length > 0 && (
                        <StudentSection title={`معفى (${exempted.length})`} students={exempted} status="exempted" quarter={selectedQuarter} />
                    )}
                    {/* غير مدفوع */}
                    {unpaid.length > 0 && (
                        <StudentSection title={`غير مدفوع (${unpaid.length})`} students={unpaid} status="unpaid" quarter={selectedQuarter} />
                    )}
                </div>
            )}
        </div>
    );
}

function StudentSection({ title, students, status, quarter }: {
    title: string;
    students: any[];
    status: PaymentStatus;
    quarter: number;
}) {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
        <div className={cn("border-b border-slate-100 dark:border-white/5 last:border-0", cfg.bgClass)}>
            <div className={cn("px-4 py-2 text-xs font-bold flex items-center gap-1.5", cfg.textClass)}>
                <Icon className="h-3.5 w-3.5" />
                {title}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
                {students.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-2 bg-white/50 dark:bg-white/3 text-xs">
                        <span className="font-medium">{s.fullName}</span>
                        <Badge variant="secondary" className="text-[10px]">{s.subscriptionTier || 'فئة الأصاغر'}</Badge>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────
export default function DuesReportPage() {
    const { students, payments, loading, settings } = useStudentContext();
    const { isSuperAdmin, isManagement } = useAuth();

    const currentYear = getYear(new Date());
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedQuarter, setSelectedQuarter] = useState(getQuarter(new Date()));
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    const prices = settings?.prices?.renewal || { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 };

    // ── جمع بيانات الفصل المحدد لكل طالب ────────────────────
    const studentsWithStatus = useMemo(() => {
        if (!students) return [];
        return students
            .filter(s => s.status === 'نشط')
            .map(s => {
                const payment = (payments ?? []).find(p =>
                    p.studentId === s.id &&
                    p.date &&
                    getQuarter(parseISO(p.date)) === selectedQuarter &&
                    getYear(parseISO(p.date)) === selectedYear
                );
                return {
                    ...s,
                    paymentStatus: {
                        [selectedQuarter]: { status: (payment?.status ?? 'unpaid') as PaymentStatus }
                    },
                    subscriptionTier: s.subscriptionTier,
                };
            });
    }, [students, payments, selectedQuarter, selectedYear]);

    // ── استخراج الأفواج الفريدة ────────────────────────────
    const allGroups: string[] = useMemo(() => {
        const set = new Set<string>();
        studentsWithStatus.forEach(s => {
            if ((s as any).groupName) set.add((s as any).groupName);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
    }, [studentsWithStatus]);

    // ── تبديل تحديد الفوج ─────────────────────────────────
    const toggleGroup = (g: string) => {
        setSelectedGroups(prev =>
            prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
        );
    };

    const selectAll = () => setSelectedGroups([...allGroups]);
    const clearAll = () => setSelectedGroups([]);

    // ── الطلاب المعروضون (المختارون فقط، أو الكل إذا لا شيء محدد) ──
    const visibleGroups = selectedGroups.length > 0 ? selectedGroups : allGroups;

    const groupedStudents: Record<string, typeof studentsWithStatus> = useMemo(() => {
        const map: Record<string, typeof studentsWithStatus> = {};
        studentsWithStatus.forEach(s => {
            const g = (s as any).groupName || 'غير محدد';
            if (!map[g]) map[g] = [];
            map[g].push(s);
        });
        return map;
    }, [studentsWithStatus]);

    // ── الإحصائيات الإجمالية للمحددين ─────────────────────
    const summary = useMemo(() => {
        const selected = studentsWithStatus.filter(s => visibleGroups.includes((s as any).groupName || 'غير محدد'));
        const paid = selected.filter(s => s.paymentStatus[selectedQuarter]?.status === 'paid');
        const exempted = selected.filter(s => s.paymentStatus[selectedQuarter]?.status === 'exempted');
        const unpaid = selected.filter(s => {
            const st = s.paymentStatus[selectedQuarter]?.status;
            return !st || st === 'unpaid';
        });
        const revenue = paid.reduce((sum, s) => {
            const tier = (s as any).subscriptionTier || 'فئة الأصاغر';
            return sum + (prices[tier] || 0);
        }, 0);
        const paidPct = selected.length > 0 ? Math.round((paid.length / selected.length) * 100) : 0;
        return { total: selected.length, paid: paid.length, exempted: exempted.length, unpaid: unpaid.length, revenue, paidPct };
    }, [studentsWithStatus, visibleGroups, selectedQuarter, prices]);

    // ── طباعة PDF ─────────────────────────────────────────
    const handlePrintPDF = () => {
        const today = new Date().toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const quarterLabel = QUARTER_NAMES[selectedQuarter];

        const groupSections = visibleGroups.map(gName => {
            const gs = groupedStudents[gName] || [];
            const paid = gs.filter(s => s.paymentStatus[selectedQuarter]?.status === 'paid');
            const exempted = gs.filter(s => s.paymentStatus[selectedQuarter]?.status === 'exempted');
            const unpaid = gs.filter(s => {
                const st = s.paymentStatus[selectedQuarter]?.status;
                return !st || st === 'unpaid';
            });
            const gRevenue = paid.reduce((sum, s) => {
                const tier = (s as any).subscriptionTier || 'فئة الأصاغر';
                return sum + (prices[tier] || 0);
            }, 0);
            const paidPct = gs.length > 0 ? Math.round((paid.length / gs.length) * 100) : 0;

            const buildRows = (list: typeof gs, icon: string) =>
                list.map(s => `<tr>
                    <td>${icon} ${(s as any).fullName}</td>
                    <td style="text-align:center;font-size:11px;color:#666">${(s as any).subscriptionTier || 'فئة الأصاغر'}</td>
                </tr>`).join('');

            return `
            <div class="group-section">
                <div class="group-header">
                    <span class="group-name">🎓 فوج: ${gName}</span>
                    <div class="group-stats">
                        <span class="stat paid">✅ مدفوع: ${paid.length}</span>
                        <span class="stat exempted">🔵 معفى: ${exempted.length}</span>
                        <span class="stat unpaid">❌ غير مدفوع: ${unpaid.length}</span>
                        <span class="stat revenue">💰 المحصل: ${gRevenue.toLocaleString('ar-DZ')} د.ج</span>
                        <span class="stat pct">📊 السداد: ${paidPct}%</span>
                    </div>
                </div>
                <table>
                    <thead><tr><th>اسم الطالب</th><th>الفئة</th></tr></thead>
                    <tbody>
                        ${buildRows(paid, '✅')}
                        ${buildRows(exempted, '🔵')}
                        ${buildRows(unpaid, '❌')}
                        ${gs.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:#aaa">لا يوجد طلاب</td></tr>' : ''}
                    </tbody>
                </table>
            </div>`;
        }).join('');

        const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير المستحقات - ${quarterLabel} ${selectedYear}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; color: #1a1a1a; background: #fff; padding: 20px; }
                .report-header { background: linear-gradient(135deg, #1a5276, #2980b9); color: white; border-radius: 12px; padding: 24px 28px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .report-title { font-size: 22px; font-weight: 800; }
                .report-subtitle { font-size: 13px; opacity: 0.85; margin-top: 4px; }
                .report-meta { text-align: left; font-size: 12px; opacity: 0.85; }
                .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
                .stat-card { border-radius: 10px; padding: 14px 10px; text-align: center; }
                .stat-card .num { font-size: 26px; font-weight: 800; }
                .stat-card .lbl { font-size: 11px; font-weight: 500; margin-top: 3px; }
                .stat-card.total { background: #f0f4f8; color: #2c3e50; }
                .stat-card.paid-c { background: #eafaf1; color: #1a7a46; }
                .stat-card.exempt-c { background: #ebf5fb; color: #1a6ea8; }
                .stat-card.unpaid-c { background: #fdedec; color: #a93226; }
                .stat-card.revenue-c { background: #fef9e7; color: #9a7d0a; }
                .group-section { border: 1px solid #dde1e7; border-radius: 10px; margin-bottom: 18px; overflow: hidden; break-inside: avoid; }
                .group-header { background: #f4f6f9; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
                .group-name { font-size: 15px; font-weight: 800; color: #1a3a5c; }
                .group-stats { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; }
                .group-stats .stat { border-radius: 20px; padding: 3px 10px; font-weight: 700; }
                .group-stats .stat.paid { background: #eafaf1; color: #1a7a46; }
                .group-stats .stat.exempted { background: #ebf5fb; color: #1a6ea8; }
                .group-stats .stat.unpaid { background: #fdedec; color: #a93226; }
                .group-stats .stat.revenue { background: #fef9e7; color: #9a7d0a; }
                .group-stats .stat.pct { background: #f0eef9; color: #5b3fa6; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                thead tr { background: #2c3e50; color: white; }
                thead th { padding: 9px 10px; text-align: right; font-weight: 700; }
                tbody tr:nth-child(even) { background: #f9fafb; }
                tbody td { padding: 8px 10px; border-bottom: 1px solid #eaecef; }
                .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
                @media print { body { padding: 10px; } .group-section { break-inside: avoid; } }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div>
                    <div class="report-title">📊 تقرير المستحقات المالية</div>
                    <div class="report-subtitle">${quarterLabel} — سنة ${selectedYear} | ${summary.total} طالب | ${visibleGroups.length} فوج</div>
                </div>
                <div class="report-meta">
                    <div>تاريخ الإصدار:</div>
                    <div>${today}</div>
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card total"><div class="num">${summary.total}</div><div class="lbl">إجمالي الطلاب</div></div>
                <div class="stat-card paid-c"><div class="num">${summary.paid}</div><div class="lbl">✅ مدفوع (${summary.paidPct}%)</div></div>
                <div class="stat-card exempt-c"><div class="num">${summary.exempted}</div><div class="lbl">🔵 معفى</div></div>
                <div class="stat-card unpaid-c"><div class="num">${summary.unpaid}</div><div class="lbl">❌ غير مدفوع</div></div>
                <div class="stat-card revenue-c"><div class="num">${summary.revenue.toLocaleString('ar-DZ')}</div><div class="lbl">💰 المحصل (د.ج)</div></div>
            </div>
            ${groupSections}
            <div class="footer">تم إنشاء هذا التقرير تلقائياً بواسطة منصة الشافعية القرآنية — ${today}</div>
            <script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
        </body>
        </html>`;

        const win = window.open('', '_blank', 'width=1000,height=750');
        if (!win) { alert('يرجى السماح للمتصفح بفتح نوافذ جديدة.'); return; }
        win.document.write(html);
        win.document.close();
    };

    // ── تصدير Excel ──────────────────────────────────────
    const handleExportExcel = () => {
        const rows: any[] = [];
        visibleGroups.forEach(gName => {
            const gs = groupedStudents[gName] || [];
            gs.forEach(s => {
                rows.push({
                    'الفوج': gName,
                    'اسم الطالب': (s as any).fullName,
                    'الفئة': (s as any).subscriptionTier || 'فئة الأصاغر',
                    'حالة الدفع': s.paymentStatus[selectedQuarter]?.status === 'paid' ? 'مدفوع' :
                        s.paymentStatus[selectedQuarter]?.status === 'exempted' ? 'معفى' : 'غير مدفوع',
                });
            });
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `ف${selectedQuarter}_${selectedYear}`);
        XLSX.writeFile(wb, `تقرير_ف${selectedQuarter}_${selectedYear}.xlsx`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
            {/* العنوان */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <BarChart3 className="h-7 w-7 text-primary" />
                        تقارير المستحقات
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        اختر الفصل والأفواج لعرض إحصائيات السداد التفصيلية
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={handleExportExcel}>
                        <Download className="ml-2 h-4 w-4" /> Excel
                    </Button>
                    <Button onClick={handlePrintPDF} className="gap-2">
                        <Printer className="h-4 w-4" /> طباعة PDF
                    </Button>
                </div>
            </div>

            {/* أدوات الفلترة */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        الفلاتر
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">السنة</label>
                        <Select dir="rtl" value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">الفصل</label>
                        <Select dir="rtl" value={selectedQuarter.toString()} onValueChange={v => setSelectedQuarter(parseInt(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[1, 2, 3, 4].map(q => (
                                    <SelectItem key={q} value={q.toString()}>{QUARTER_NAMES[q]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                            الأفواج المحددة: {selectedGroups.length === 0 ? 'الكل' : selectedGroups.length}
                        </label>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={selectAll} className="flex-1 h-10">تحديد الكل</Button>
                            <Button variant="ghost" size="sm" onClick={clearAll} className="flex-1 h-10">إلغاء الكل</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* الإحصائيات الإجمالية */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'إجمالي الطلاب', value: summary.total, icon: Users, bgClass: 'bg-slate-100 dark:bg-white/10', textClass: 'text-slate-700 dark:text-slate-200' },
                    { label: `✅ مدفوع (${summary.paidPct}%)`, value: summary.paid, icon: CheckCircle, bgClass: 'bg-emerald-50 dark:bg-emerald-900/20', textClass: 'text-emerald-700 dark:text-emerald-300' },
                    { label: '🔵 معفى', value: summary.exempted, icon: FileX, bgClass: 'bg-sky-50 dark:bg-sky-900/20', textClass: 'text-sky-700 dark:text-sky-300' },
                    { label: '❌ غير مدفوع', value: summary.unpaid, icon: XCircle, bgClass: 'bg-rose-50 dark:bg-rose-900/20', textClass: 'text-rose-700 dark:text-rose-300' },
                    { label: '💰 المحصّل (د.ج)', value: summary.revenue.toLocaleString('ar-DZ'), icon: DollarSign, bgClass: 'bg-amber-50 dark:bg-amber-900/20', textClass: 'text-amber-700 dark:text-amber-300' },
                ].map(({ label, value, bgClass, textClass }) => (
                    <div key={label} className={cn('rounded-2xl p-4 text-center', bgClass)}>
                        <p className={cn('text-2xl font-black font-headline', textClass)}>{value}</p>
                        <p className={cn('text-[11px] font-medium mt-1', textClass)}>{label}</p>
                    </div>
                ))}
            </div>

            {/* شريط اختيار الأفواج */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">اختيار الأفواج</CardTitle>
                    <CardDescription>انقر على فوج لإضافته أو إزالته من التقرير</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {allGroups.map(g => {
                            const gs = groupedStudents[g] || [];
                            const paid = gs.filter(s => s.paymentStatus[selectedQuarter]?.status === 'paid').length;
                            const pct = gs.length > 0 ? Math.round((paid / gs.length) * 100) : 0;
                            const isSelected = selectedGroups.length === 0 || selectedGroups.includes(g);

                            return (
                                <button
                                    key={g}
                                    onClick={() => toggleGroup(g)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all",
                                        selectedGroups.includes(g)
                                            ? "bg-primary text-white border-primary shadow-md"
                                            : selectedGroups.length === 0
                                                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                                : "bg-muted text-muted-foreground border-transparent hover:border-primary/30"
                                    )}
                                >
                                    <span>{g}</span>
                                    <span className={cn(
                                        "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                                        selectedGroups.includes(g) ? "bg-white/20" : "bg-emerald-100 text-emerald-700"
                                    )}>
                                        {pct}%
                                    </span>
                                    <span className="text-[10px] opacity-70">({gs.length})</span>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* بطاقات الأفواج */}
            <div className="space-y-3">
                <h2 className="text-lg font-headline font-bold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    تفاصيل الأفواج
                    <span className="text-xs font-normal text-muted-foreground">
                        ({visibleGroups.length} فوج معروض)
                    </span>
                </h2>

                {visibleGroups.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">لا يوجد أفواج للعرض</div>
                ) : (
                    // ترتيب تنازلي حسب نسبة السداد
                    [...visibleGroups]
                        .sort((a, b) => {
                            const gsA = groupedStudents[a] || [];
                            const gsB = groupedStudents[b] || [];
                            const pctA = gsA.length > 0 ? gsA.filter(s => s.paymentStatus[selectedQuarter]?.status === 'paid').length / gsA.length : 0;
                            const pctB = gsB.length > 0 ? gsB.filter(s => s.paymentStatus[selectedQuarter]?.status === 'paid').length / gsB.length : 0;
                            return pctB - pctA;
                        })
                        .map(gName => (
                            <GroupCard
                                key={gName}
                                groupName={gName}
                                students={groupedStudents[gName] || []}
                                selectedQuarter={selectedQuarter}
                                prices={prices}
                                isSelected={selectedGroups.includes(gName)}
                                onToggle={() => toggleGroup(gName)}
                            />
                        ))
                )}
            </div>
        </div>
    );
}
