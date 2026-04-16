
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, DollarSign, CheckCircle, XCircle, Undo2, Download, Search, FileX, PlusCircle, MinusCircle, MoreHorizontal, Save, Printer } from 'lucide-react';
import { format, parseISO, getYear, getQuarter, formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Payment, PaymentStatus, Student } from '@/lib/types';
import { cn } from '@/lib/utils';
import { GroupSelector } from '@/components/management/GroupSelector';


type QuarterStatusFilter = 'all' | 'paid' | 'unpaid' | 'exempted';
type StatusFilter = 'all' | 'نشط' | 'مطرود';

const statusVariant: { [key in 'نشط' | 'مطرود']: "default" | "destructive" } = {
    "نشط": "default",
    "مطرود": "destructive",
};


export default function DuesPage() {
    const { students, payments, addPayment, updatePaymentStatus, loading, settings, saveSettings, allUsers } = useStudentContext();
    const { isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [quarterFilter, setQuarterFilter] = useState('all');
    const [quarterStatusFilter, setQuarterStatusFilter] = useState<QuarterStatusFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('نشط');
    const [isSaving, setIsSaving] = useState(false);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    // الفصل الحالي تلقائياً: 1=جانفي-مارس، 2=أفريل-جوان، 3=جويلية-سبتمبر، 4=أكتوبر-ديسمبر
    const currentQuarter = useMemo(() => getQuarter(new Date()), []);

    const [registrationFees, setRegistrationFees] = useState<Record<number, number>>({});
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (settings.registrationFees && settings.registrationFees[currentYear]) {
            setRegistrationFees(settings.registrationFees[currentYear]);
        } else {
            setRegistrationFees({});
        }
    }, [currentYear, settings.registrationFees]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const handleFeeChange = (quarter: number, value: string) => {
        const newFees = { ...registrationFees, [quarter]: Number(value) || 0 };
        setRegistrationFees(newFees);

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        debounceTimeout.current = setTimeout(() => {
            handleSaveFees(newFees, true); // Auto-save silently
        }, 1500); // 1.5 second delay
    };

    const handleSaveFees = async (feesToSave?: Record<number, number>, isSilent: boolean = false) => {
        setIsSaving(true);
        const fees = feesToSave || registrationFees;
        const newSettings = {
            ...settings,
            registrationFees: {
                ...settings.registrationFees,
                [currentYear]: fees,
            }
        };
        try {
            await saveSettings(newSettings);
            if (!isSilent) {
                toast({ title: "✅ تم الحفظ", description: "تم حفظ حقوق التسجيل بنجاح." });
            }
        } catch (e) {
            if (!isSilent) {
                toast({ title: "❌ خطأ", description: "فشل حفظ حقوق التسجيل.", variant: "destructive" });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const prices = settings?.prices?.renewal || { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 };

    const studentsWithDues = useMemo(() => {
        if (!students) return [];

        // Index payments by studentId for O(1) lookup
        const paymentsByStudent = (payments ?? []).reduce((acc, p) => {
            if (p.date && getYear(parseISO(p.date)) === currentYear) {
                if (!acc[p.studentId]) acc[p.studentId] = [];
                acc[p.studentId].push(p);
            }
            return acc;
        }, {} as Record<string, Payment[]>);

        return students.map(student => {
            const studentPayments = paymentsByStudent[student.id] || [];

            const paymentStatusByQuarter: Record<number, { status: PaymentStatus, paymentId?: string }> = {};

            for (let q = 1; q <= 4; q++) {
                const paymentForQuarter = studentPayments.find(p => p.date && getQuarter(parseISO(p.date)) === q);
                if (paymentForQuarter) {
                    paymentStatusByQuarter[q] = { status: paymentForQuarter.status, paymentId: paymentForQuarter.id };
                } else {
                    paymentStatusByQuarter[q] = { status: 'unpaid' };
                }
            }

            const totalPaid = studentPayments
                .filter(p => p.status === 'paid')
                .reduce((sum, p) => sum + p.amount, 0);

            return {
                ...student,
                paymentStatus: paymentStatusByQuarter,
                totalPaid,
            };
        });

    }, [students, payments, currentYear]);

    const filteredStudents = useMemo(() => {
        return studentsWithDues.filter(student => {
            const nameMatch = student.fullName.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const statusMatch = statusFilter === 'all' || student.status === statusFilter;

            let quarterMatch = true;
            if (quarterFilter !== 'all' && quarterStatusFilter !== 'all') {
                const q = parseInt(quarterFilter);
                if (quarterStatusFilter === 'paid') quarterMatch = student.paymentStatus[q]?.status === 'paid';
                if (quarterStatusFilter === 'unpaid') quarterMatch = student.paymentStatus[q]?.status === 'unpaid';
                if (quarterStatusFilter === 'exempted') quarterMatch = student.paymentStatus[q]?.status === 'exempted';
            }

            // Group Filter Logic
            let groupMatch = true;
            if (selectedGroup !== 'all' && (isSuperAdmin || isManagement)) {
                // Find the group name associated with the selected sheikh UID
                const selectedSheikh = allUsers.find(u => u.uid === selectedGroup);
                if (selectedSheikh?.group) {
                    groupMatch = student.groupName === selectedSheikh.group;
                } else {
                    // Fallback to strict owner matching if group name not found (unlikely)
                    groupMatch = student.ownerId === selectedGroup;
                }
            }

            return nameMatch && quarterMatch && statusMatch && groupMatch;
        });
    }, [studentsWithDues, searchTerm, quarterFilter, quarterStatusFilter, statusFilter, selectedGroup, isSuperAdmin, isManagement, allUsers]);

    const totalsByQuarter = useMemo(() => {
        const quarterTotals: Record<number, { revenue: number, paidCount: number, exemptedCount: number }> = { 1: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 2: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 3: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 4: { revenue: 0, paidCount: 0, exemptedCount: 0 } };

        filteredStudents.forEach(student => {
            for (let q = 1; q <= 4; q++) {
                const payment = student.paymentStatus[q];
                if (payment?.status === 'paid') {
                    const tier = student.subscriptionTier || 'فئة الأصاغر';
                    quarterTotals[q].revenue += prices[tier] || 0;
                    quarterTotals[q].paidCount++;
                }
                if (payment?.status === 'exempted') {
                    quarterTotals[q].exemptedCount++;
                }
            }
        });

        for (let q = 1; q <= 4; q++) {
            quarterTotals[q].revenue += registrationFees[q] || 0;
        }

        return quarterTotals;
    }, [filteredStudents, registrationFees, prices]);


    const totalRevenue = useMemo(() => {
        return Object.values(totalsByQuarter).reduce((sum, q) => sum + q.revenue, 0);
    }, [totalsByQuarter]);

    // --- التحقق إذا كان الطالب دفع أو معفى بالفعل في الفصل الحالي ---
    const isStudentPaidInCurrentQuarter = React.useCallback((studentId: string): boolean => {
        return !!(payments ?? []).find(p =>
            p.studentId === studentId &&
            p.date &&
            getQuarter(parseISO(p.date)) === currentQuarter &&
            getYear(parseISO(p.date)) === currentYear &&
            (p.status === 'paid' || p.status === 'exempted')
        );
    }, [payments, currentQuarter, currentYear]);

    // --- Bulk Usage Handlers ---
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            // يحدد فقط الطلاب الذين لم يُسجّل دفعهم في الفصل الحالي
            setSelectedStudents(filteredStudents.filter(s => !isStudentPaidInCurrentQuarter(s.id)).map(s => s.id));
        } else {
            setSelectedStudents([]);
        }
    };

    const handleSelectStudent = (studentId: string, checked: boolean) => {
        // لا يُسمح بتحديد طالب دفع بالفعل في الفصل الحالي
        if (checked && isStudentPaidInCurrentQuarter(studentId)) return;
        if (checked) {
            setSelectedStudents(prev => [...prev, studentId]);
        } else {
            setSelectedStudents(prev => prev.filter(id => id !== studentId));
        }
    };

    const handleBulkPayment = async (quarter: number, status: PaymentStatus) => {
        if (selectedStudents.length === 0) return;
        if (!confirm(`هل أنت متأكد من تحديث حالة المستحقات لـ ${selectedStudents.length} طالب للفصل ${quarter}؟`)) return;

        setIsBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const studentId of selectedStudents) {
                const student = students.find(s => s.id === studentId);
                if (!student) continue;

                const tier = student.subscriptionTier || 'فئة الأصاغر';
                const amount = prices[tier] || 0;
                const monthOfQuarter = (quarter - 1) * 3;
                const paymentDate = new Date(currentYear, monthOfQuarter, 1);

                const existingPayment = (payments ?? []).find(p => p.date && p.studentId === studentId && getQuarter(parseISO(p.date)) === quarter && getYear(parseISO(p.date)) === currentYear);

                try {
                    if (existingPayment) {
                        if (existingPayment.status === status) continue;
                        await updatePaymentStatus(existingPayment.id, status, status === 'paid' ? amount : 0);
                    } else {
                        await addPayment({
                            studentId: studentId,
                            amount: status === 'paid' ? amount : 0,
                            date: paymentDate.toISOString(),
                            status: status,
                        });
                    }
                    successCount++;
                } catch (e) {
                    failCount++;
                }
            }

            toast({
                title: "تم التنفيذ",
                description: `تم تحديث ${successCount} سجل بنجاح. ${failCount > 0 ? `فشل ${failCount}.` : ''}`,
                variant: failCount > 0 ? "destructive" : "default"
            });
            setSelectedStudents([]);

        } catch (error) {
            toast({
                title: "خطأ",
                description: "حدث خطأ أثناء المعالجة الجماعية.",
                variant: 'destructive'
            });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handlePaymentAction = React.useCallback(async (student: Student, quarter: number, status: PaymentStatus) => {
        if (isSuperAdmin) return; // Only super_admin is read-only

        const tier = student.subscriptionTier || 'فئة الأصاغر';
        const amount = prices[tier] || 0;
        const monthOfQuarter = (quarter - 1) * 3;
        const paymentDate = new Date(currentYear, monthOfQuarter, 1);

        const existingPayment = (payments ?? []).find(p => p.date && p.studentId === student.id && getQuarter(parseISO(p.date)) === quarter && getYear(parseISO(p.date)) === currentYear);

        try {
            if (existingPayment) {
                await updatePaymentStatus(existingPayment.id, status, status === 'paid' ? amount : 0);
            } else {
                await addPayment({
                    studentId: student.id,
                    amount: status === 'paid' ? amount : 0,
                    date: paymentDate.toISOString(),
                    status: status,
                });
            }
            let toastMessage = '';
            if (status === 'paid') toastMessage = `تم تسجيل دفعة الفصل ${quarter} للطالب.`;
            if (status === 'exempted') toastMessage = `تم تسجيل إعفاء للفصل ${quarter} للطالب.`;
            if (status === 'unpaid') toastMessage = `تم إلغاء دفعة الفصل ${quarter}.`;

            toast({
                title: "✅ تم تحديث الحالة",
                description: toastMessage,
            });

        } catch (error) {
            toast({
                title: "❌ خطأ",
                description: "فشل تحديث حالة الدفعة.",
                variant: 'destructive'
            });
        }
    }, [isSuperAdmin, prices, currentYear, payments, updatePaymentStatus, addPayment, toast]);

    const handleExport = () => {
        const dataToExport = filteredStudents.map(s => ({
            "اسم الطالب": s.fullName,
            "الحالة": s.status,
            "الفئة": s.subscriptionTier,
            "فصل 1": s.paymentStatus[1]?.status || 'unpaid',
            "فصل 2": s.paymentStatus[2]?.status || 'unpaid',
            "فصل 3": s.paymentStatus[3]?.status || 'unpaid',
            "فصل 4": s.paymentStatus[4]?.status || 'unpaid',
            "الإجمالي المدفوع": s.totalPaid,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `مستحقات_${currentYear}`);
        XLSX.writeFile(wb, `تقرير_المستحقات_${currentYear}.xlsx`);
    };

    const handlePrintPDF = () => {
        // تحديد الفصل المطلوب
        const selectedQ = quarterFilter === 'all' ? null : parseInt(quarterFilter);
        const quarterLabel = selectedQ
            ? { 1: 'الفصل الأول (جانفي - مارس)', 2: 'الفصل الثاني (أفريل - جوان)', 3: 'الفصل الثالث (جويلية - سبتمبر)', 4: 'الفصل الرابع (أكتوبر - ديسمبر)' }[selectedQ]
            : 'جميع الفصول';

        // تجميع الطلاب حسب الفوج
        const groupMap: Record<string, typeof filteredStudents> = {};
        filteredStudents.forEach(s => {
            const g = (s as any).groupName || 'غير محدد';
            if (!groupMap[g]) groupMap[g] = [];
            groupMap[g].push(s);
        });

        // الإحصائيات العامة
        const quarters = selectedQ ? [selectedQ] : [1, 2, 3, 4];
        const totalStudents = filteredStudents.length;
        const paidCount = filteredStudents.filter(s => quarters.some(q => s.paymentStatus[q]?.status === 'paid')).length;
        const exemptedCount = filteredStudents.filter(s => quarters.some(q => s.paymentStatus[q]?.status === 'exempted')).length;
        const unpaidCount = filteredStudents.filter(s => quarters.every(q => s.paymentStatus[q]?.status === 'unpaid' || !s.paymentStatus[q])).length;
        const totalRevenue = filteredStudents.reduce((sum, s) => {
            return sum + quarters.reduce((qSum, q) => {
                if (s.paymentStatus[q]?.status === 'paid') {
                    const tier = s.subscriptionTier || 'فئة الأصاغر';
                    return qSum + (prices[tier] || 0);
                }
                return qSum;
            }, 0);
        }, 0);
        const paidPct = totalStudents > 0 ? Math.round((paidCount / totalStudents) * 100) : 0;
        const today = new Date().toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // بناء صفوف جدول كل فوج
        const buildGroupTable = (groupName: string, students: typeof filteredStudents) => {
            const getStatus = (s: typeof filteredStudents[0]) => {
                if (selectedQ) return s.paymentStatus[selectedQ]?.status || 'unpaid';
                const statuses = quarters.map(q => s.paymentStatus[q]?.status || 'unpaid');
                if (statuses.every(st => st === 'paid')) return 'paid';
                if (statuses.every(st => st === 'exempted')) return 'exempted';
                if (statuses.some(st => st === 'paid' || st === 'exempted')) return 'partial';
                return 'unpaid';
            };

            const paid = students.filter(s => getStatus(s) === 'paid');
            const exempted = students.filter(s => getStatus(s) === 'exempted');
            const partial = students.filter(s => getStatus(s) === 'partial');
            const unpaid = students.filter(s => getStatus(s) === 'unpaid');

            const gPaidPct = students.length > 0 ? Math.round((paid.length / students.length) * 100) : 0;
            const gRevenue = paid.reduce((sum, s) => {
                return sum + quarters.reduce((qSum, q) => {
                    if (s.paymentStatus[q]?.status === 'paid') {
                        const tier = s.subscriptionTier || 'فئة الأصاغر';
                        return qSum + (prices[tier] || 0);
                    }
                    return qSum;
                }, 0);
            }, 0);

            const buildRows = (list: typeof filteredStudents, cssClass: string, icon: string, statusLabel: string) => {
                if (list.length === 0) return '';
                return list.map(s => {
                    const qCells = selectedQ
                        ? `<td class="qcell ${s.paymentStatus[selectedQ]?.status || 'unpaid'}">${cellIcon(s.paymentStatus[selectedQ]?.status || 'unpaid')}</td>`
                        : [1,2,3,4].map(q => `<td class="qcell ${s.paymentStatus[q]?.status || 'unpaid'}">${cellIcon(s.paymentStatus[q]?.status || 'unpaid')}</td>`).join('');
                    return `<tr class="row ${cssClass}">
                        <td>${s.fullName}</td>
                        <td class="tier">${s.subscriptionTier || 'فئة الأصاغر'}</td>
                        ${qCells}
                        <td class="total">${s.totalPaid.toLocaleString('ar-DZ')} د.ج</td>
                    </tr>`;
                }).join('');
            };

            const quarterHeaders = selectedQ
                ? `<th>ف${selectedQ}</th>`
                : `<th>ف1</th><th>ف2</th><th>ف3</th><th>ف4</th>`;

            return `
            <div class="group-section">
                <div class="group-header">
                    <span class="group-name">🎓 فوج: ${groupName}</span>
                    <div class="group-stats">
                        <span class="stat paid">✅ مدفوع: ${paid.length}</span>
                        ${partial.length > 0 ? `<span class="stat partial">⚡ جزئي: ${partial.length}</span>` : ''}
                        <span class="stat exempted">🔵 معفى: ${exempted.length}</span>
                        <span class="stat unpaid">❌ غير مدفوع: ${unpaid.length}</span>
                        <span class="stat revenue">💰 المحصل: ${gRevenue.toLocaleString('ar-DZ')} د.ج</span>
                        <span class="stat pct">📊 نسبة الدفع: ${gPaidPct}%</span>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr><th>الطالب</th><th>الفئة</th>${quarterHeaders}<th>الإجمالي</th></tr>
                    </thead>
                    <tbody>
                        ${buildRows(paid, 'paid', '✅', 'مدفوع')}
                        ${buildRows(partial, 'partial', '⚡', 'جزئي')}
                        ${buildRows(exempted, 'exempted', '🔵', 'معفى')}
                        ${buildRows(unpaid, 'unpaid', '❌', 'غير مدفوع')}
                        ${students.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#aaa">لا يوجد طلاب</td></tr>' : ''}
                    </tbody>
                </table>
            </div>`;
        };

        const cellIcon = (status: string) => {
            if (status === 'paid') return '✅';
            if (status === 'exempted') return '🔵';
            return '❌';
        };

        const groupSections = Object.entries(groupMap)
            .sort(([a], [b]) => a.localeCompare(b, 'ar'))
            .map(([gName, gStudents]) => buildGroupTable(gName, gStudents))
            .join('');

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير المستحقات - ${currentYear}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Tajawal', 'Arial', sans-serif; direction: rtl; color: #1a1a1a; background: #fff; padding: 20px; }

                /* الرأس */
                .report-header { background: linear-gradient(135deg, #1a5276, #2980b9); color: white; border-radius: 12px; padding: 24px 28px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .report-title { font-size: 22px; font-weight: 800; }
                .report-subtitle { font-size: 13px; opacity: 0.85; margin-top: 4px; }
                .report-meta { text-align: left; font-size: 12px; opacity: 0.85; }

                /* بطاقات الإحصائيات */
                .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
                .stat-card { border-radius: 10px; padding: 14px 10px; text-align: center; }
                .stat-card .num { font-size: 26px; font-weight: 800; }
                .stat-card .lbl { font-size: 11px; font-weight: 500; margin-top: 3px; }
                .stat-card.total { background: #f0f4f8; color: #2c3e50; }
                .stat-card.paid-c { background: #eafaf1; color: #1a7a46; }
                .stat-card.exempt-c { background: #ebf5fb; color: #1a6ea8; }
                .stat-card.unpaid-c { background: #fdedec; color: #a93226; }
                .stat-card.revenue-c { background: #fef9e7; color: #9a7d0a; }

                /* فوج */
                .group-section { border: 1px solid #dde1e7; border-radius: 10px; margin-bottom: 18px; overflow: hidden; break-inside: avoid; }
                .group-header { background: #f4f6f9; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
                .group-name { font-size: 15px; font-weight: 800; color: #1a3a5c; }
                .group-stats { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; }
                .group-stats .stat { border-radius: 20px; padding: 3px 10px; font-weight: 700; }
                .group-stats .stat.paid { background: #eafaf1; color: #1a7a46; }
                .group-stats .stat.partial { background: #fef6e4; color: #b7770d; }
                .group-stats .stat.exempted { background: #ebf5fb; color: #1a6ea8; }
                .group-stats .stat.unpaid { background: #fdedec; color: #a93226; }
                .group-stats .stat.revenue { background: #fef9e7; color: #9a7d0a; }
                .group-stats .stat.pct { background: #f0eef9; color: #5b3fa6; }

                /* جدول */
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                thead tr { background: #2c3e50; color: white; }
                thead th { padding: 9px 10px; text-align: right; font-weight: 700; }
                tbody tr:nth-child(even) { background: #f9fafb; }
                tbody td { padding: 8px 10px; border-bottom: 1px solid #eaecef; }
                td.qcell { text-align: center; font-size: 16px; }
                td.tier { font-size: 11px; color: #666; }
                td.total { font-weight: 700; color: #2c3e50; }
                tr.row.paid { background: #f2fff7 !important; }
                tr.row.exempted { background: #f0f8ff !important; }
                tr.row.partial { background: #fffbf0 !important; }
                tr.row.unpaid { background: #fff5f5 !important; }

                /* الذيل */
                .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }

                @media print {
                    body { padding: 10px; }
                    button { display: none !important; }
                    .group-section { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div>
                    <div class="report-title">📊 تقرير المستحقات المالية الفصلية</div>
                    <div class="report-subtitle">${quarterLabel} — سنة ${currentYear} | ${filteredStudents.length} طالب</div>
                </div>
                <div class="report-meta">
                    <div>تاريخ الإصدار:</div>
                    <div>${today}</div>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card total"><div class="num">${totalStudents}</div><div class="lbl">إجمالي الطلاب</div></div>
                <div class="stat-card paid-c"><div class="num">${paidCount}</div><div class="lbl">✅ مدفوع (${paidPct}%)</div></div>
                <div class="stat-card exempt-c"><div class="num">${exemptedCount}</div><div class="lbl">🔵 معفى</div></div>
                <div class="stat-card unpaid-c"><div class="num">${totalStudents - paidCount - exemptedCount}</div><div class="lbl">❌ غير مدفوع</div></div>
                <div class="stat-card revenue-c"><div class="num">${totalRevenue.toLocaleString('ar-DZ')}</div><div class="lbl">💰 المحصل (د.ج)</div></div>
            </div>

            ${groupSections}

            <div class="footer">تم إنشاء هذا التقرير تلقائياً بواسطة منصة الشافعية القرآنية — ${today}</div>

            <script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
        </body>
        </html>`;

        const win = window.open('', '_blank', 'width=1000,height=750');
        if (!win) {
            alert('يرجى السماح للمتصفح بفتح نوافذ جديدة لتتمكن من طباعة التقرير.');
            return;
        }
        win.document.write(html);
        win.document.close();
    }


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if ((students ?? []).length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض مستحقاتهم</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }

    const yearOptions = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
    const quarterNames: Record<string, string> = { '1': 'فصل 1', '2': 'فصل 2', '3': 'فصل 3', '4': 'فصل 4' };

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-headline font-bold">المستحقات المالية الفصلية</h1>
                <div className="flex items-center gap-2">
                    <Button onClick={() => handleSaveFees()} disabled={isSaving}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        حفظ
                    </Button>
                    <Select dir="rtl" value={currentYear.toString()} onValueChange={(value) => setCurrentYear(parseInt(value))}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="اختر السنة" />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Bulk Actions Floating Bar */}
            {selectedStudents.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 dark:bg-white/10 text-white backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center gap-4 z-50 border border-white/20 animate-in slide-in-from-bottom-5 w-[90%] max-w-4xl justify-between">
                    <div className="flex items-center gap-3 border-l border-white/20 pl-4 ml-2">
                        <span className="font-bold text-lg whitespace-nowrap">{selectedStudents.length} طالب محدد</span>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStudents([])} className="text-white/70 hover:text-white h-auto p-0 hover:bg-transparent">إلغاء</Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-end w-full">
                        <span className="text-sm opacity-70 hidden md:inline ml-2">إجراء جماعي:</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="secondary" disabled={isBulkProcessing} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
                                    {isBulkProcessing ? <Loader2 className="animate-spin ml-2 h-4 w-4" /> : <CheckCircle className="ml-2 h-4 w-4" />}
                                    تسجيل دافع
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {[1, 2, 3, 4].map(q => (
                                    <DropdownMenuItem key={q} onClick={() => handleBulkPayment(q, 'paid')}>فصل {q}</DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10" disabled={isBulkProcessing}>
                                    <FileX className="ml-2 h-4 w-4 text-sky-400" />
                                    تسجيل إعفاء
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {[1, 2, 3, 4].map(q => (
                                    <DropdownMenuItem key={q} onClick={() => handleBulkPayment(q, 'exempted')}>فصل {q}</DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="text-rose-300 hover:bg-rose-900/40 hover:text-rose-200" disabled={isBulkProcessing}>
                                    <Undo2 className="ml-2 h-4 w-4" />
                                    إلغاء الدفع
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {[1, 2, 3, 4].map(q => (
                                    <DropdownMenuItem key={q} onClick={() => handleBulkPayment(q, 'unpaid')} className="text-rose-600">فصل {q}</DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>أدوات الفلترة والبحث</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث باسم الطالب..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {/* Group Selector */}
                    {(isSuperAdmin || isManagement) && (
                        <div className="min-w-[200px]">
                            <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Select dir="rtl" value={quarterFilter} onValueChange={setQuarterFilter}>
                            <SelectTrigger className="w-1/2"><SelectValue placeholder="اختر الفلتر" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الفصول</SelectItem>
                                <SelectItem value="1">فصل 1</SelectItem>
                                <SelectItem value="2">فصل 2</SelectItem>
                                <SelectItem value="3">فصل 3</SelectItem>
                                <SelectItem value="4">فصل 4</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select dir="rtl" value={quarterStatusFilter} onValueChange={(v) => setQuarterStatusFilter(v as QuarterStatusFilter)} disabled={quarterFilter === 'all'}>
                            <SelectTrigger className="w-1/2"><SelectValue placeholder="حالة الفصل" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="paid">مدفوع</SelectItem>
                                <SelectItem value="unpaid">غير مدفوع</SelectItem>
                                <SelectItem value="exempted">معفى</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                        <Button variant={statusFilter === 'all' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('all')} className="h-8 px-3">الكل</Button>
                        <Button variant={statusFilter === 'نشط' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('نشط')} className="h-8 px-3">النشطون فقط</Button>
                        <Button variant={statusFilter === 'مطرود' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('مطرود')} className="h-8 px-3">المطرودون</Button>
                    </div>
                    <Button onClick={handleExport}><Download className="ml-2 h-4 w-4" /> تصدير (Excel)</Button>
                    <Button variant="outline" onClick={handlePrintPDF} className="border-primary text-primary hover:bg-primary hover:text-white">
                        <Printer className="ml-2 h-4 w-4" /> طباعة تقرير (PDF)
                    </Button>
                </CardContent>
            </Card>

            <Card className="mb-24">
                <CardHeader>
                    <CardTitle>سجل الدفعات لسنة {currentYear}</CardTitle>
                    <CardDescription>
                        أسعار الاشتراكات الفصلية ثابتة: ({prices['فئة الأكابر']} د.ج للأكابر، {prices['فئة الأصاغر']} د.ج للأصاغر).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                                            onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                            className="translate-y-[2px]"
                                        />
                                    </TableHead>
                                    <TableHead className="w-1/4">اسم الطالب</TableHead>
                                    {(isSuperAdmin || isManagement) && <TableHead>الفوج</TableHead>}
                                    <TableHead>الحالة</TableHead>
                                    <TableHead>الفئة</TableHead>
                                    {[1, 2, 3, 4].map(q => <TableHead key={q} className="text-center">{quarterNames[q.toString()]}</TableHead>)}
                                    <TableHead>الإجمالي السنوي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length > 0 ? filteredStudents.map(student => (
                                    <PaymentRow
                                        key={student.id}
                                        student={student}
                                        isSuperAdmin={isSuperAdmin}
                                        isManagement={isManagement}
                                        prices={prices}
                                        onPaymentAction={handlePaymentAction}
                                        isSelected={selectedStudents.includes(student.id)}
                                        onSelect={(checked) => handleSelectStudent(student.id, checked)}
                                        isPaidInCurrentQuarter={isStudentPaidInCurrentQuarter(student.id)}
                                        currentQuarter={currentQuarter}
                                    />
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={(isSuperAdmin || isManagement) ? 9 : 8} className="h-24 text-center">
                                            لا يوجد طلبة مطابقون لخيارات البحث الحالية.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={(isSuperAdmin || isManagement) ? 5 : 4} className="font-semibold">حقوق التسجيل الإجمالية للفصل</TableCell>
                                    {[1, 2, 3, 4].map(q => (
                                        <TableCell key={`reg-fee-${q}`} className="text-center p-1">
                                            <Input
                                                type="number"
                                                className="w-24 mx-auto text-center h-8 bg-blue-50 dark:bg-blue-900/20"
                                                placeholder="أدخل مبلغًا"
                                                value={registrationFees[q] || ''}
                                                onChange={(e) => handleFeeChange(q, e.target.value)}
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell></TableCell>
                                </TableRow>
                                <TableRow className="bg-amber-100 dark:bg-amber-800/20 font-bold text-base border-t-2 border-amber-300">
                                    <TableCell colSpan={(isSuperAdmin || isManagement) ? 5 : 4}>الإجمالي النهائي للفصل</TableCell>
                                    {[1, 2, 3, 4].map(q => (
                                        <TableCell key={`total-footer-${q}`} className="text-center text-lg text-amber-800 dark:text-amber-200 transition-colors">
                                            {totalsByQuarter[q].revenue.toLocaleString()} د.ج
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-xl text-amber-900 dark:text-amber-100 transition-colors">{totalRevenue.toLocaleString()} د.ج</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Memoized Row Component
const PaymentRow = React.memo(({
    student,
    isSuperAdmin,
    prices,
    onPaymentAction,
    isSelected,
    onSelect,
    isPaidInCurrentQuarter,
    currentQuarter,
}: {
    student: any,
    isSuperAdmin: boolean,
    isManagement: boolean,
    prices: any,
    onPaymentAction: (s: any, q: number, st: PaymentStatus) => void,
    isSelected: boolean,
    onSelect: (checked: boolean) => void,
    isPaidInCurrentQuarter: boolean,
    currentQuarter: number,
}) => {
    const quarterMonthNames: Record<number, string> = {
        1: 'جانفي - مارس',
        2: 'أفريل - جوان',
        3: 'جويلية - سبتمبر',
        4: 'أكتوبر - ديسمبر',
    };
    return (
        <TableRow className={cn(
            student.status === 'مطرود' && 'opacity-50 hover:opacity-70 transition-opacity',
            isSelected && 'bg-blue-50 dark:bg-blue-900/10',
            isPaidInCurrentQuarter && !isSelected && 'bg-emerald-50/50 dark:bg-emerald-900/10'
        )}>
            <TableCell>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={(c) => onSelect(c as boolean)}
                    className="translate-y-[2px]"
                    disabled={isPaidInCurrentQuarter}
                    title={isPaidInCurrentQuarter
                        ? `تم تسجيل دفع هذا الطالب في الفصل ${currentQuarter} (${quarterMonthNames[currentQuarter]})`
                        : undefined
                    }
                />
            </TableCell>
            <TableCell className="font-bold text-slate-700 dark:text-slate-200 py-4">
                <div className="flex items-center gap-2 flex-wrap">
                    {student.fullName}
                    {isPaidInCurrentQuarter && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-full px-2 py-0.5 whitespace-nowrap">
                            <CheckCircle className="h-2.5 w-2.5" />
                            دفع ف{currentQuarter}
                        </span>
                    )}
                </div>
            </TableCell>
            {isSuperAdmin && <TableCell><Badge variant="outline" className="font-medium">{(student as any).groupName || 'غير محدد'}</Badge></TableCell>}
            <TableCell>
                <Badge variant={statusVariant[student.status as 'نشط' | 'مطرود'] || 'secondary'} className="font-bold">
                    {student.status}
                </Badge>
                {student.status === 'مطرود' && student.expulsionDate &&
                    <p className="text-[10px] text-muted-foreground mt-1">({formatDistanceToNowStrict(parseISO(student.expulsionDate), { locale: ar, addSuffix: true })})</p>
                }
            </TableCell>
            <TableCell>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                    {student.subscriptionTier || 'فئة الأصاغر'}
                </Badge>
            </TableCell>
            {[1, 2, 3, 4].map(q => {
                const payment = student.paymentStatus[q];
                return (
                    <TableCell key={q} className="text-center">
                        {payment?.status === 'paid' && (
                            <div className="flex items-center justify-center gap-2">
                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                {!isSuperAdmin && student.status === 'نشط' && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onPaymentAction(student, q, 'unpaid')}>
                                        <Undo2 className="h-3.5 w-3.5 text-slate-400" />
                                    </Button>
                                )}
                            </div>
                        )}
                        {payment?.status === 'exempted' && (
                            <div className="flex items-center justify-center gap-2">
                                <FileX className="h-5 w-5 text-sky-500" />
                                {!isSuperAdmin && student.status === 'نشط' && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onPaymentAction(student, q, 'unpaid')}>
                                        <Undo2 className="h-3.5 w-3.5 text-slate-400" />
                                    </Button>
                                )}
                            </div>
                        )}
                        {payment?.status === 'unpaid' && (
                            !isSuperAdmin && student.status === 'نشط' ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 px-2 border-dashed border-slate-300 hover:border-primary hover:text-primary transition-all">
                                            <PlusCircle className="ml-1.5 h-3.5 w-3.5" />
                                            إضافة
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onSelect={() => onPaymentAction(student, q, 'paid')} className="cursor-pointer">
                                            <CheckCircle className="ml-2 h-4 w-4 text-emerald-500" />
                                            <span className="font-medium">تأكيد الدفع ({prices[student.subscriptionTier || 'فئة الأصاغر']} د.ج)</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onPaymentAction(student, q, 'exempted')} className="cursor-pointer">
                                            <FileX className="ml-2 h-4 w-4 text-sky-500" />
                                            <span className="font-medium">إعفاء من الدفع</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <XCircle className="mx-auto h-5 w-5 text-rose-300 dark:text-rose-900/50" />
                            )
                        )}
                    </TableCell>
                )
            })}
            <TableCell>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-slate-900 dark:text-white">{student.totalPaid.toLocaleString()} د.ج</span>
                    <div className="h-1 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min((student.totalPaid / 8000) * 100, 100)}%` }}
                        />
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
});

PaymentRow.displayName = 'PaymentRow';
