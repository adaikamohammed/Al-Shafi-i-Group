

"use client";

import React, { useState, useMemo } from 'react';
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
import { Loader2, Save, MoreVertical, Edit, Trash2, Eye, CheckCircle, Pin, PinOff } from 'lucide-react';
import type { DailyReport } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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

type FilterStatus = 'all' | 'pending' | 'reviewed' | 'pinned';

const ReportCard = ({ report, isSuperAdmin, onEdit, onDelete, onTogglePin, onReview }: {
    report: DailyReport;
    isSuperAdmin: boolean;
    onEdit: (report: DailyReport) => void;
    onDelete: (reportId: string, date: string) => void;
    onTogglePin: (report: DailyReport) => void;
    onReview: (report: DailyReport, adminReply: string) => void;
}) => {
    const [adminReply, setAdminReply] = useState('');

    return (
        <Card key={report.id} className={cn(
            "overflow-hidden border-l-4",
            report.isPinned ? 'border-yellow-400 ring-2 ring-yellow-400/20' : (categoryColors[report.category] || 'border-gray-300')
        )}>
           <CardHeader className="p-4 flex-row justify-between items-start">
             <div>
                <div className="flex items-center gap-2">
                    {report.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                    <p><span className="font-semibold">التصنيف:</span> {report.category}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                    {report.authorName} - {format(parseISO(report.timestamp), 'd MMM yyyy, h:mm a', { locale: ar })}
                </p>
             </div>
             <div className="flex items-center gap-2">
              <Badge variant={report.status === 'reviewed' ? 'default' : 'secondary'} className={cn(report.status === 'reviewed' && "bg-green-100 text-green-800 border border-green-300")}>
                <Eye className="ml-1 h-3 w-3" /> {report.status === 'reviewed' ? 'شوهد من الإدارة' : 'لم يراجع بعد'}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onTogglePin(report)}>
                        {report.isPinned ? <PinOff className="ml-2 h-4 w-4"/> : <Pin className="ml-2 h-4 w-4"/>}
                        <span>{report.isPinned ? 'إلغاء تثبيت' : 'تثبيت للمتابعة'}</span>
                    </DropdownMenuItem>
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
            
            {isSuperAdmin && report.status !== 'reviewed' && (
                 <div className="mt-4 pt-4 border-t border-dashed space-y-2">
                    <Label htmlFor={`admin-reply-${report.id}`}>إضافة رد إداري (اختياري)</Label>
                    <Textarea
                        id={`admin-reply-${report.id}`}
                        placeholder="مثال: بارك الله فيك، تم اتخاذ الإجراء..."
                        value={adminReply}
                        onChange={(e) => setAdminReply(e.target.value)}
                    />
                    <Button onClick={() => onReview(report, adminReply)}>
                        <CheckCircle className="ml-2 h-4 w-4" /> تأكيد المراجعة
                    </Button>
                </div>
            )}
            
            {report.status === 'reviewed' && report.adminNotes && (
                 <div className="mt-4 pt-4 border-t bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                    <p className="font-semibold text-blue-800 dark:text-blue-200">رد الإدارة:</p>
                    <p className="text-sm whitespace-pre-wrap">{report.adminNotes}</p>
                </div>
            )}
            </CardContent>
        </Card>
    );
};


export default function DailyReportPage() {
    const { dailyReports, saveDailyReport, deleteDailyReport, loading } = useStudentContext();
    const { user, isSuperAdmin } = useAuth();
    const { toast } = useToast();

    const [note, setNote] = useState('');
    const [category, setCategory] = useState(defaultCategories[0]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
    
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    const monthlyReports = useMemo(() => {
        return Object.values(dailyReports)
            .flatMap(dayReports => Object.values(dayReports))
            .filter(report => {
                if (!report || !report.date) return false;
                try {
                    const reportDate = parseISO(report.date);
                    return getMonth(reportDate) === selectedMonth && getYear(reportDate) === selectedYear;
                } catch(e) { return false; }
            })
            .sort((a, b) => (b.isPinned ? 1 : -1) - (a.isPinned ? 1 : -1) || b.id.localeCompare(a.id));
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
        return monthlyReports.filter(r => !r.isPinned && (filterStatus === 'all' || r.status === filterStatus));
    }, [monthlyReports, filterStatus]);


    const resetForm = () => {
        setNote('');
        setCategory(defaultCategories[0]);
        setEditingReport(null);
    }

    const handleSaveReport = async () => {
        if (!user) {
            toast({ title: "خطأ", description: "يجب تسجيل الدخول لحفظ التقارير.", variant: "destructive" });
            return;
        }
        if (!note.trim()) {
            toast({ title: "خطأ", description: "لا يمكن حفظ تقرير فارغ.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        
        try {
            const reportData: Partial<DailyReport> = {
                note: note,
                category: category,
            };

            await saveDailyReport(reportData, editingReport?.id);
            
            toast({ title: "نجاح ✅", description: editingReport ? "تم تحديث التقرير بنجاح." : "تم حفظ التقرير بنجاح." });
            resetForm();

        } catch(error) {
             const errorMessage = error instanceof Error ? error.message : "فشل حفظ التقرير.";
             toast({ title: "خطأ ❌", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleEditClick = (report: DailyReport) => {
        setEditingReport(report);
        setNote(report.note);
        setCategory(report.category);
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
            adminNotes: adminReply || report.adminNotes || 'تمت المراجعة.', // Keep old notes if new reply is empty, default to seen
        };
        try {
            await saveDailyReport(updatedReport, report.id);
            toast({ title: "✅ تم تأكيد المراجعة", description: "تم تحديث حالة التقرير بنجاح." });
        } catch (error) {
            toast({ title: "خطأ", description: "فشل تحديث حالة التقرير.", variant: "destructive" });
        }
    };
    
    if(loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            {!isSuperAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle>➕ {editingReport ? 'تعديل التقرير' : `إضافة تقرير جديد ليوم: ${format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar })}`}</CardTitle>
                        <CardDescription>اكتب هنا ملاحظاتك العامة عن هذا اليوم، مثل السلوك العام للفوج، مستوى الحفظ، اقتراحات، أو أي حالات خاصة تستدعي انتباه الإدارة.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                            <Label htmlFor="report-note">✏️ نص التقرير</Label>
                            <Textarea 
                                id="report-note"
                                placeholder="مثال: كان الحفظ ممتازًا اليوم، ولكن لوحظ تأخر بعض الطلبة. أقترح..."
                                rows={6}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Button onClick={handleSaveReport} disabled={isSaving}>
                                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                                {editingReport ? 'حفظ التعديلات' : 'إضافة تقرير'}
                            </Button>
                            {editingReport && (
                                <Button variant="outline" onClick={resetForm}>
                                    إلغاء التعديل
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>📂 سجل تقارير الفوج ({monthlyReports.length})</CardTitle>
                    <CardDescription>هنا يمكنك تصفح جميع التقارير المحفوظة حسب الشهر والسنة وحالتها.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex flex-col md:flex-row gap-2 justify-between">
                         <div className="flex gap-2">
                             <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({length: 12}, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', {locale: ar})}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="السنة" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                           <Button variant={filterStatus === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilterStatus('all')} className="h-8 px-2">الكل</Button>
                           <Button variant={filterStatus === 'pending' ? 'secondary' : 'ghost'} onClick={() => setFilterStatus('pending')} className="h-8 px-2">لم يراجع</Button>
                           <Button variant={filterStatus === 'reviewed' ? 'secondary' : 'ghost'} onClick={() => setFilterStatus('reviewed')} className="h-8 px-2">تمت المراجعة</Button>
                           <Button variant={filterStatus === 'pinned' ? 'secondary' : 'ghost'} onClick={() => setFilterStatus('pinned')} className="h-8 px-2">المثبتة</Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                         {pinnedReports.length > 0 && filterStatus !== 'pending' && filterStatus !== 'reviewed' && (
                             <>
                                <Separator />
                                <h3 className="font-semibold">تقارير هامة قيد المتابعة ({pinnedReports.length})</h3>
                                <div className="space-y-4">
                                     {pinnedReports.map(report => (
                                        <ReportCard 
                                            key={report.id}
                                            report={report}
                                            isSuperAdmin={isSuperAdmin}
                                            onEdit={handleEditClick}
                                            onDelete={handleDeleteClick}
                                            onTogglePin={handleTogglePin}
                                            onReview={handleReview}
                                        />
                                    ))}
                                </div>
                             </>
                         )}
                         
                         {unpinnedReports.length > 0 && (
                             <>
                               {pinnedReports.length > 0 && filterStatus === 'all' && (
                                    <>
                                        <Separator />
                                        <h3 className="font-semibold pt-4">التقارير الأخرى</h3>
                                    </>
                                )}
                                <div className="space-y-4">
                                     {unpinnedReports.map(report => (
                                        <ReportCard 
                                            key={report.id}
                                            report={report}
                                            isSuperAdmin={isSuperAdmin}
                                            onEdit={handleEditClick}
                                            onDelete={handleDeleteClick}
                                            onTogglePin={handleTogglePin}
                                            onReview={handleReview}
                                        />
                                    ))}
                                </div>
                             </>
                         )}

                         {filteredReports.length === 0 && (
                            <p className="text-center text-muted-foreground p-8">
                                {monthlyReports.length > 0 ? 'لا توجد تقارير تطابق هذا الفلتر.' : 'لا توجد تقارير محفوظة لهذا الشهر.'}
                            </p>
                         )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    

  
