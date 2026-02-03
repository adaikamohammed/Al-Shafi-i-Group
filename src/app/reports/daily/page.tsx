"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, getMonth, getYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, MoreVertical, Edit, Trash2, Eye, CheckCircle, Pin, PinOff, Calendar, Shield, Send } from 'lucide-react';
import type { DailyReport } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';


const defaultCategories = ["اقتراح", "شكوى", "ملاحظة عامة", "شكر", "طلب", "إذن غياب", "طلب صيانة", "إنجاز استثنائي", "حالة طارئة"];

const categoryColors: { [key: string]: string } = {
    "حالة طارئة": "border-red-500 bg-red-50 dark:bg-red-900/30",
    "شكوى": "border-red-500 bg-red-50 dark:bg-red-900/30",
    "إنجاز استثنائي": "border-green-500 bg-green-50 dark:bg-green-900/30",
    "شكر": "border-green-500 bg-green-50 dark:bg-green-900/30",
    "إذن غياب": "border-blue-500 bg-blue-50 dark:bg-blue-900/30",
    "طلب صيانة": "border-blue-500 bg-blue-50 dark:bg-blue-900/30",
    "طلب": "border-blue-500 bg-blue-50 dark:bg-blue-900/30",
    "اقتراح": "border-gray-300 bg-gray-50 dark:bg-gray-800/30",
    "ملاحظة عامة": "border-gray-300 bg-gray-50 dark:bg-gray-800/30",
};

const priorityConfig = {
    urgent: { label: "عاجل جداً", color: "bg-red-600 text-white animate-pulse" },
    important: { label: "هام", color: "bg-orange-500 text-white" },
    normal: { label: "عادي", color: "bg-slate-500 text-white" },
};

type FilterStatus = 'all' | 'pending' | 'reviewed' | 'in_progress' | 'pinned';

const ReportCard = ({ report, isSuperAdmin, isAdmin, currentUserId, onEdit, onDelete, onTogglePin, onReview, onSetStatus, onMarkRead }: {
    report: DailyReport;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    currentUserId?: string;
    onEdit: (report: DailyReport) => void;
    onDelete: (reportId: string, date: string) => void;
    onTogglePin: (report: DailyReport) => void;
    onReview: (report: DailyReport, adminReply: string) => void;
    onSetStatus: (report: DailyReport, status: DailyReport['status']) => void;
    onMarkRead?: (report: DailyReport) => void;
}) => {
    const [adminReply, setAdminReply] = useState(report.adminNotes || '');
    const [isEditingReply, setIsEditingReply] = useState(false);
    const priority = report.priority || 'normal';

    return (
        <Card key={report.id} className={cn(
            "overflow-hidden border-l-4 transition-all duration-300",
            report.isManagementMessage ?
                (report.isReadByRecipient ? 'border-purple-400 bg-purple-50/30' : 'border-purple-600 bg-gradient-to-r from-purple-50 to-white dark:from-purple-950/20 dark:to-background shadow-md ring-1 ring-purple-600/20') :
                report.isPinned ? 'border-yellow-400 ring-2 ring-yellow-400/20' : (categoryColors[report.category] || 'border-gray-300')
        )}>
            {report.isManagementMessage && (
                <div className={cn(
                    "text-white text-[10px] uppercase font-black px-3 py-1.5 text-center tracking-widest flex items-center justify-center gap-2",
                    report.isReadByRecipient ? "bg-purple-400" : "bg-purple-600"
                )}>
                    <Shield className="h-3 w-3" />
                    {report.isReadByRecipient ? 'توجيه إداري (تم الاطلاع)' : 'توجيه إداري هام جداً'}
                </div>
            )}
            <CardHeader className="p-4 flex-row justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {report.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                        {report.isManagementMessage && <Shield className="h-4 w-4 text-purple-600" />}
                        <p><span className="font-semibold">{report.isManagementMessage ? 'نوع الرسالة:' : 'التصنيف:'}</span> {report.category}</p>
                        {report.priority && report.priority !== 'normal' && (
                            <Badge className={priorityConfig[report.priority].color}>
                                {priorityConfig[report.priority].label}
                            </Badge>
                        )}
                        {report.hasNewReply && !isAdmin && (
                            <Badge className="bg-blue-600 animate-bounce">رد جديد 🔥</Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {report.authorName} - {format(parseISO(report.timestamp), 'd MMM yyyy, h:mm a', { locale: ar })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={report.isManagementMessage ? 'default' : (report.status === 'reviewed' ? 'default' : report.status === 'in_progress' ? 'secondary' : 'outline')}
                        className={cn(
                            (report.isManagementMessage || report.status === 'reviewed') && "bg-green-100 text-green-800 border border-green-300",
                            report.isManagementMessage && (report.isReadByRecipient ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-purple-100 text-purple-800 border-purple-300"),
                            report.status === 'in_progress' && "bg-blue-100 text-blue-800 border border-blue-300"
                        )}>
                        {report.isManagementMessage ? (report.isReadByRecipient ? <CheckCircle className="ml-1 h-3 w-3" /> : <Shield className="ml-1 h-3 w-3" />) : (report.status === 'reviewed' ? <CheckCircle className="ml-1 h-3 w-3" /> : <Eye className="ml-1 h-3 w-3" />)}
                        {report.isManagementMessage ? (report.isReadByRecipient ? 'تم التأكيد' : 'توجيه رسمي') : (report.status === 'reviewed' ? 'تمت المراجعة' : report.status === 'in_progress' ? 'قيد المعالجة' : 'لم يراجع بعد')}
                    </Badge>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onTogglePin(report)}>
                                {report.isPinned ? <PinOff className="ml-2 h-4 w-4" /> : <Pin className="ml-2 h-4 w-4" />}
                                <span>{report.isPinned ? 'إلغاء تثبيت' : 'تثبيت للمتابعة'}</span>
                            </DropdownMenuItem>
                            {isAdmin && (
                                <>
                                    <DropdownMenuItem onClick={() => onSetStatus(report, report.status === 'in_progress' ? 'pending' : 'in_progress')}>
                                        <Loader2 className="ml-2 h-4 w-4" />
                                        <span>{report.status === 'in_progress' ? 'إلغاء قيد المعالجة' : 'التحويل لقيد المعالجة'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsEditingReply(true)}>
                                        <Edit className="ml-2 h-4 w-4" />
                                        <span>تعديل الرد</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                            {!isSuperAdmin && (
                                <>
                                    <DropdownMenuItem onClick={() => onEdit(report)}>
                                        <Edit className="ml-2 h-4 w-4" />
                                        <span>تعديل</span>
                                    </DropdownMenuItem>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                                <Trash2 className="ml-2 h-4 w-4" />
                                                <span>حذف</span>
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                                                <AlertDialogDescription>سيؤدي هذا إلى حذف التقرير نهائيًا. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onDelete(report.id, report.date)}>تأكيد الحذف</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <p className="mt-2 whitespace-pre-wrap border-t pt-2">{report.note}</p>



                {isAdmin && (report.status !== 'reviewed' || isEditingReply) && (
                    <div className="mt-4 pt-4 border-t border-dashed space-y-2">
                        <Label htmlFor={`admin-reply-${report.id}`}>{isEditingReply ? 'تعديل الرد الإداري' : 'إضافة رد إداري (اختياري)'}</Label>
                        <Textarea
                            id={`admin-reply-${report.id}`}
                            placeholder="مثال: بارك الله فيك، تم اتخاذ الإجراء..."
                            value={adminReply}
                            onChange={(e) => setAdminReply(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <Button onClick={() => { onReview(report, adminReply); setIsEditingReply(false); }}>
                                <CheckCircle className="ml-2 h-4 w-4" /> {isEditingReply ? 'حفظ التعديل' : 'إرسال الرد وتأكيد المراجعة'}
                            </Button>
                            {isEditingReply && (
                                <Button variant="ghost" onClick={() => setIsEditingReply(false)}>إلغاء</Button>
                            )}
                        </div>
                    </div>
                )}

                {report.status === 'reviewed' && report.adminNotes && !isEditingReply && (
                    <div className="mt-4 pt-4 border-t bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md relative">
                        <p className="font-semibold text-blue-800 dark:text-blue-200">رد الإدارة:</p>
                        <p className="text-sm whitespace-pre-wrap">{report.adminNotes}</p>
                    </div>
                )}

                {report.isManagementMessage && !report.isReadByRecipient && report.authorId !== currentUserId && (
                    <div className="mt-4 pt-4 border-t flex justify-center">
                        <Button
                            onClick={() => onMarkRead?.(report)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-8 shadow-lg shadow-purple-200 dark:shadow-purple-900/20"
                        >
                            <CheckCircle className="ml-2 h-4 w-4" /> تم الاطلاع والموافقة
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default function DailyReportPage() {
    const { dailyReports, saveDailyReport, deleteDailyReport, sendManagementMessage, markManagementMessageAsRead, allUsers, loading } = useStudentContext();
    const { user, isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();

    const [note, setNote] = useState('');
    const [category, setCategory] = useState(defaultCategories[0]);
    const [priority, setPriority] = useState<DailyReport['priority']>('normal');
    const [isSaving, setIsSaving] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [editingReport, setEditingReport] = useState<DailyReport | null>(null);

    // Admin Messaging State
    const [targetSheikhIds, setTargetSheikhIds] = useState<string[]>([]);
    const [adminMsgNote, setAdminMsgNote] = useState("");
    const [isAdminSending, setIsAdminSending] = useState(false);

    const sheikhs = useMemo(() => {
        const filtered = allUsers.filter(u => u.role === 'sheikh' && u.group);
        const groupsMap = new Map();

        for (const u of filtered) {
            const groupKey = u.group?.trim();
            if (!groupKey) continue;
            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, {
                    ...u,
                    group: groupKey,
                    uids: [u.uid]
                });
            } else {
                groupsMap.get(groupKey).uids.push(u.uid);
            }
        }

        return Array.from(groupsMap.values()).sort((a, b) => {
            const numA = parseInt(a.group?.replace(/[^0-9]/g, '') || '0');
            const numB = parseInt(b.group?.replace(/[^0-9]/g, '') || '0');
            return numA - numB;
        });
    }, [allUsers]);

    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');



    const isAdmin = isSuperAdmin || isManagement;



    const monthlyReports = useMemo(() => {
        return Object.values(dailyReports || {})
            .flatMap(dayReports => Object.values(dayReports || {}))
            .filter(report => {
                if (!report || !report.date) return false;
                try {
                    const reportDate = parseISO(report.date);
                    return getMonth(reportDate) === selectedMonth && getYear(reportDate) === selectedYear;
                } catch (e) { return false; }
            })
            .sort((a, b) =>
                (b.isManagementMessage && !b.isReadByRecipient ? 1 : 0) - (a.isManagementMessage && !a.isReadByRecipient ? 1 : 0) ||
                (b.isManagementMessage ? 1 : 0) - (a.isManagementMessage ? 1 : 0) ||
                (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
                b.id.localeCompare(a.id)
            );
    }, [dailyReports, selectedMonth, selectedYear]);

    const filteredReports = useMemo(() => {
        if (filterStatus === 'all') return monthlyReports;
        if (filterStatus === 'pinned') return monthlyReports.filter(r => r.isPinned);
        return monthlyReports.filter(r => r.status === filterStatus);
    }, [monthlyReports, filterStatus]);

    const pinnedReports = useMemo(() => monthlyReports.filter(r => r.isPinned), [monthlyReports]);
    const unpinnedReports = useMemo(() => {
        if (filterStatus === 'all') return monthlyReports.filter(r => !r.isPinned);
        if (filterStatus === 'pinned') return [];
        return monthlyReports.filter(r => !r.isPinned && (filterStatus === 'all' || (r.status as string) === filterStatus));
    }, [monthlyReports, filterStatus]);

    const resetForm = () => {
        setNote('');
        setCategory(defaultCategories[0]);
        setPriority('normal');
        setEditingReport(null);
        setUploadStatus(null);
    };

    const handleSaveReport = async () => {
        if (!user) {
            toast({ title: "خطأ", description: "يجب تسجيل الدخول لحفظ التقارير.", variant: "destructive" });
            return;
        }
        if (!note.trim()) {
            toast({ title: "خطأ", description: "لا يمكن حفظ تقرير فارغ تماماً. يرجى كتابة ملاحظة.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        setUploadStatus("جاري البدء...");

        try {
            const reportId = editingReport?.id || Date.now().toString();

            setUploadStatus("جاري حفظ البيانات...");
            const reportData: Partial<DailyReport> = {
                note: note,
                category: category,
                priority: priority
            };

            await saveDailyReport(reportData, reportId);

            toast({ title: "نجاح ✅", description: editingReport ? "تم تحديث التقرير بنجاح." : "تم حفظ التقرير بنجاح." });
            resetForm();

        } catch (error: any) {
            console.error("Save Report Error:", error);
            const errorCode = error.code || 'unknown-error';
            const errorMessage = error.message || "فشل حفظ التقرير.";
            toast({
                title: "خطأ ❌",
                description: (
                    <div className="space-y-2">
                        <p>{errorMessage}</p>
                        <p className="text-[10px] bg-red-100 p-1 rounded font-mono break-all font-bold">Error Code: {errorCode}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">انسخ هذا الكود وأرسله للمطور.</p>
                    </div>
                ),
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendAdminMessage = async () => {
        if (targetSheikhIds.length === 0) {
            toast({ title: "تنبيه", description: "يرجى اختيار المشايخ المستلمون.", variant: "destructive" });
            return;
        }
        if (!adminMsgNote.trim()) {
            toast({ title: "تنبيه", description: "يرجى كتابة نص الرسالة الإدارية.", variant: "destructive" });
            return;
        }

        setIsAdminSending(true);
        try {
            // Send sequentially to simplify error handling
            for (const sheikhUid of targetSheikhIds) {
                const targetSheikh = sheikhs.find(s => s.uid === sheikhUid);
                const alternateUids = targetSheikh?.uids?.filter((id: string) => id !== sheikhUid) || [];

                await sendManagementMessage(sheikhUid, {
                    note: adminMsgNote,
                    priority: 'important',
                    category: 'توجيه إداري'
                }, alternateUids);
            }

            toast({
                title: "✅ تمت العملية بنجاح",
                description: `تم إرسال الرسالة إلى (${targetSheikhIds.length}) من المشايخ بنجاح.`
            });

            setAdminMsgNote("");
            setTargetSheikhIds([]);
        } catch (error: any) {
            console.error("Batch Message Error:", error);
            toast({
                title: "خطأ في الإرسال",
                description: `حدثت مشكلة أثناء إرسال الرسائل: ${error.message || 'مشكلة في الصلاحيات'}`,
                variant: "destructive"
            });
        } finally {
            setIsAdminSending(false);
        }
    };

    const handleEditClick = (report: DailyReport) => {
        setEditingReport(report);
        setNote(report.note);
        setCategory(report.category);
        setPriority(report.priority || 'normal');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const handleDeleteClick = async (reportId: string, date: string) => {
        try {
            await deleteDailyReport(reportId, date);
            toast({ title: "✅ تم الحذف", description: "تم حذف التقرير بنجاح." });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "فشل حذف التقرير.";
            toast({ title: "خطأ ❌", description: errorMessage, variant: "destructive" });
        }
    }

    const handleTogglePin = async (report: DailyReport) => {
        try {
            await saveDailyReport({ isPinned: !report.isPinned }, report.id);
            toast({ title: "✅ تم التحديث", description: report.isPinned ? "تم إلغاء تثبيت التقرير." : "تم تثبيت التقرير للمتابعة." });
        } catch (error) {
            toast({ title: "خطأ", description: "فشل تحديث حالة التثبيت.", variant: "destructive" });
        }
    }

    const handleReview = async (report: DailyReport, adminReply: string) => {
        const updatedReport: Partial<DailyReport> = {
            status: 'reviewed',
            adminNotes: adminReply || report.adminNotes || 'تمت المراجعة.',
            hasNewReply: true,
        };
        try {
            await saveDailyReport(updatedReport, report.id);
            toast({ title: "✅ تم إرسال الرد", description: "تم تحديث التقرير وتنبيه صاحب التقرير." });
        } catch (error) {
            toast({ title: "خطأ", description: "فشل تحديث حالة التقرير.", variant: "destructive" });
        }
    };

    const handleSetStatus = async (report: DailyReport, status: DailyReport['status']) => {
        try {
            await saveDailyReport({ status }, report.id);
            toast({ title: "✅ تم التحديث", description: "تم تغيير حالة التقرير بنجاح." });
        } catch (error) {
            toast({ title: "خطأ", description: "فشل تحديث حالة التقرير.", variant: "destructive" });
        }
    }

    const markAsRead = async (report: DailyReport) => {
        if (!isSuperAdmin) {
            if (report.hasNewReply) {
                await saveDailyReport({ hasNewReply: false }, report.id);
            }
        }
    }

    const { meetings, addMeetingSuggestion } = useStudentContext();
    const [meetingSuggestion, setMeetingSuggestion] = useState("");
    const upcomingMeeting = useMemo(() => meetings.find(m => m.status === 'upcoming'), [meetings]);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            {isAdmin && (
                <Card className="border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent border-r-4 border-r-purple-600 overflow-hidden shadow-lg animate-in slide-in-from-top-4 duration-500">
                    <CardHeader className="py-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
                            <Shield className="h-5 w-5" /> إرسال رسالة رسمية إلى شيخ
                        </CardTitle>
                        <CardDescription>هذه الرسالة ستظهر للشيخ في أعلى صفحته الخاصة بالتقارير اليومية وبشكل مميز.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-6">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-purple-700 font-bold">🎯 اختيار المشايخ المستهدفين:</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (targetSheikhIds.length === sheikhs.length) {
                                            setTargetSheikhIds([]);
                                        } else {
                                            setTargetSheikhIds(sheikhs.map(s => s.uid));
                                        }
                                    }}
                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-xs font-bold"
                                >
                                    {targetSheikhIds.length === sheikhs.length ? 'إلغاء تحديد الكل' : 'تحديد جميع المشايخ'}
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-100 max-h-48 overflow-y-auto">
                                {sheikhs.map(s => (
                                    <div key={s.uid} className="flex items-center space-x-2 space-x-reverse bg-white p-2 rounded-xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                                        <Checkbox
                                            id={`sheikh-${s.uid}`}
                                            checked={targetSheikhIds.includes(s.uid)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setTargetSheikhIds(prev => [...prev, s.uid]);
                                                } else {
                                                    setTargetSheikhIds(prev => prev.filter(id => id !== s.uid));
                                                }
                                            }}
                                            className="border-purple-300 data-[state=checked]:bg-purple-600"
                                        />
                                        <Label
                                            htmlFor={`sheikh-${s.uid}`}
                                            className="text-xs font-semibold cursor-pointer truncate flex-1"
                                            title={s.displayName}
                                        >
                                            {s.displayName} <span className="text-[10px] text-purple-400 block">{s.group}</span>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            {targetSheikhIds.length > 0 && (
                                <p className="text-[11px] text-purple-600 font-bold">
                                    تم تحديد ({targetSheikhIds.length}) من المشايخ حالياً.
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="admin-msg" className="text-purple-700 font-bold">📝 نص التوجيه الإداري:</Label>
                            <div className="relative">
                                <Textarea
                                    id="admin-msg"
                                    placeholder="اكتب توجيهك الإداري هنا... سيتم إرساله كرسالة رسمية لجميع المحددين."
                                    value={adminMsgNote}
                                    onChange={(e) => setAdminMsgNote(e.target.value)}
                                    className="bg-white rounded-2xl border-purple-200 focus:ring-purple-500 min-h-[120px] pb-12 shadow-inner"
                                />
                                <div className="absolute left-3 bottom-3 flex gap-2">
                                    <Button
                                        onClick={handleSendAdminMessage}
                                        disabled={isAdminSending || targetSheikhIds.length === 0 || !adminMsgNote.trim()}
                                        className="rounded-xl gap-2 font-black px-8 bg-purple-600 hover:bg-purple-700 h-11 shadow-lg shadow-purple-200"
                                    >
                                        {isAdminSending ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <Send className="h-5 w-5" />
                                        )}
                                        إرسال التوجيه لـ ({targetSheikhIds.length}) مشايخ
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {upcomingMeeting && !isSuperAdmin && (
                <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent border-r-4 border-r-primary overflow-hidden shadow-lg animate-in slide-in-from-top-4 duration-500">
                    <CardHeader className="py-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-primary">
                            <Calendar className="h-5 w-5" /> مقترحات الاجتماع القادم ({upcomingMeeting.date})
                        </CardTitle>
                        <CardDescription>ساهم في إثراء جدول أعمال الاجتماع القادم بمقترحاتك أو النقاط التي ترغب في طرحها.</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="اكتب اقتراحك هنا..."
                                value={meetingSuggestion}
                                onChange={(e) => setMeetingSuggestion(e.target.value)}
                                className="bg-white rounded-xl"
                            />
                            <Button
                                onClick={async () => {
                                    if (!meetingSuggestion.trim()) return;
                                    await addMeetingSuggestion(upcomingMeeting.id, {
                                        authorName: user?.displayName || 'Unknown',
                                        authorId: user?.uid || '',
                                        text: meetingSuggestion
                                    });
                                    setMeetingSuggestion("");
                                }}
                                className="rounded-xl gap-2 font-bold px-6"
                            >
                                <SendIcon className="h-4 w-4" /> إرسال المقترح
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
            {!isSuperAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle>➕ {editingReport ? 'تعديل التقرير' : `إضافة تقرير جديد ليوم: ${format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar })}`}</CardTitle>
                        <CardDescription>اكتب هنا ملاحظاتك العامة عن هذا اليوم، مثل السلوك العام للفوج، مستوى الحفظ، اقتراحات، أو أي حالات خاصة تستدعي انتباه الإدارة.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">🏷️ التصنيف</Label>
                                <Select dir="rtl" value={category} onValueChange={setCategory}>
                                    <SelectTrigger id="category">
                                        <SelectValue placeholder="اختر تصنيفًا" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {defaultCategories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="priority">⚡ درجة الأهمية</Label>
                                <Select dir="rtl" value={priority} onValueChange={(val: any) => setPriority(val)}>
                                    <SelectTrigger id="priority">
                                        <SelectValue placeholder="اختر الأهمية" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="normal">عادي</SelectItem>
                                        <SelectItem value="important">هام</SelectItem>
                                        <SelectItem value="urgent">عاجل جداً</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="report-note">✏️ نص التقرير</Label>
                            <Textarea
                                id="report-note"
                                placeholder="مثال: كان الحفظ ممتازًا اليوم، ولكن لوحظ تأخر بعض الطلبة. أقترح..."
                                rows={4}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>



                        <div className="flex items-center gap-2 pt-2">
                            <Button onClick={handleSaveReport} disabled={isSaving} className="w-full md:w-auto h-12 px-10 font-black text-lg gap-2 shadow-xl hover:scale-105 transition-transform">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                        <span>{uploadStatus || 'انتظر...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="ml-2 h-5 w-5" />
                                        <span>{editingReport ? 'حفظ التعديلات' : 'إرسال التقرير'}</span>
                                    </>
                                )}
                            </Button>
                            {editingReport && (
                                <Button variant="outline" onClick={resetForm} className="h-12 font-bold px-6">
                                    إلغاء التعديل
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-2xl border-none bg-white/60 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">📂 سجل تقارير الفوج <Badge variant="secondary">{monthlyReports.length}</Badge></CardTitle>
                    <CardDescription>هنا يمكنك تصفح جميع التقارير المحفوظة حسب الشهر والسنة وحالتها.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between bg-slate-100/50 dark:bg-slate-800/50 p-4 rounded-2xl">
                        <div className="flex gap-2">
                            <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[150px] bg-white"><SelectValue placeholder="الشهر" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', { locale: ar })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[100px] bg-white"><SelectValue placeholder="السنة" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center space-x-1 rounded-xl bg-white p-1 overflow-x-auto shadow-sm">
                            <Button variant={filterStatus === 'all' ? 'default' : 'ghost'} onClick={() => setFilterStatus('all')} className="h-9 px-4 rounded-lg">الكل</Button>
                            <Button variant={filterStatus === 'pending' ? 'default' : 'ghost'} onClick={() => setFilterStatus('pending')} className="h-9 px-4 rounded-lg">لم يراجع</Button>
                            <Button variant={filterStatus === 'in_progress' ? 'default' : 'ghost'} onClick={() => setFilterStatus('in_progress')} className="h-9 px-4 rounded-lg">قيد المعالجة</Button>
                            <Button variant={filterStatus === 'reviewed' ? 'default' : 'ghost'} onClick={() => setFilterStatus('reviewed')} className="h-9 px-4 rounded-lg">تمت المراجعة</Button>
                            <Button variant={filterStatus === 'pinned' ? 'default' : 'ghost'} onClick={() => setFilterStatus('pinned')} className="h-9 px-4 rounded-lg">المثبتة</Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {pinnedReports.length > 0 && filterStatus !== 'pending' && filterStatus !== 'reviewed' && (
                            <>
                                <Separator />
                                <h3 className="font-semibold text-primary/80 flex items-center gap-2">
                                    <Pin className="h-4 w-4" /> تقارير هامة قيد المتابعة ({pinnedReports.length})
                                </h3>
                                <div className="space-y-4">
                                    {pinnedReports.map(report => (
                                        <div key={`${report.recipientId || report.authorId || 'admin'}_${report.id}`} onMouseEnter={() => markAsRead(report)}>
                                            <ReportCard
                                                report={report}
                                                isSuperAdmin={isSuperAdmin}
                                                isAdmin={isAdmin}
                                                currentUserId={user?.uid}
                                                onEdit={handleEditClick}
                                                onDelete={handleDeleteClick}
                                                onTogglePin={handleTogglePin}
                                                onReview={handleReview}
                                                onSetStatus={handleSetStatus}
                                                onMarkRead={(r) => markManagementMessageAsRead(r.id, r.date)}
                                            />
                                            {report.hasNewReply && !isSuperAdmin && report.status === 'reviewed' && (
                                                <div className="flex justify-center -mt-2 mb-4">
                                                    <Button variant="outline" size="sm" onClick={() => markAsRead(report)} className="rounded-full bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 transition-colors">
                                                        تمت رؤية الرد
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {unpinnedReports.length > 0 && (
                            <>
                                {pinnedReports.length > 0 && filterStatus === 'all' && (
                                    <>
                                        <Separator />
                                        <h3 className="font-semibold pt-4 text-muted-foreground">التقارير الأخرى</h3>
                                    </>
                                )}
                                <div className="space-y-4">
                                    {unpinnedReports.map(report => (
                                        <div key={`${report.recipientId || report.authorId || 'admin'}_${report.id}`} onMouseEnter={() => markAsRead(report)}>
                                            <ReportCard
                                                report={report}
                                                isSuperAdmin={isSuperAdmin}
                                                isAdmin={isAdmin}
                                                currentUserId={user?.uid}
                                                onEdit={handleEditClick}
                                                onDelete={handleDeleteClick}
                                                onTogglePin={handleTogglePin}
                                                onReview={handleReview}
                                                onSetStatus={handleSetStatus}
                                                onMarkRead={(r) => markManagementMessageAsRead(r.id, r.date)}
                                            />
                                            {report.hasNewReply && !isSuperAdmin && report.status === 'reviewed' && (
                                                <div className="flex justify-center -mt-2 mb-4">
                                                    <Button variant="outline" size="sm" onClick={() => markAsRead(report)} className="rounded-full bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 transition-colors">
                                                        تمت رؤية الرد
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {filteredReports.length === 0 && (
                            <div className="text-center text-muted-foreground p-12 bg-slate-50/50 rounded-3xl border-2 border-dashed">
                                <p className="text-lg">
                                    {monthlyReports.length > 0 ? 'لا توجد تقارير تطابق هذا الفلتر.' : 'لا توجد تقارير محفوظة لهذا الشهر.'}
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function SendIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </svg>
    )
}
