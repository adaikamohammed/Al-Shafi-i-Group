

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
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, MoreVertical, Edit, Trash2 } from 'lucide-react';
import type { DailyReport } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const defaultCategories = ["اقتراح", "شكوى", "ملاحظة عامة", "شكر", "طلب"];

export default function DailyReportPage() {
    const { dailyReports, saveDailyReport, deleteDailyReport, loading } = useStudentContext();
    const { user } = useAuth();
    const { toast } = useToast();

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const [note, setNote] = useState('');
    const [category, setCategory] = useState(defaultCategories[0]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
    

    const todaysReports = useMemo(() => {
        const reportsForToday = dailyReports?.[todayStr];
        if (!reportsForToday) return [];
        return Object.values(reportsForToday)
            .filter(report => report && typeof report === 'object' && report.id) 
            .sort((a, b) => b.id.localeCompare(a.id));
    }, [dailyReports, todayStr]);

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
            const reportData: Omit<DailyReport, 'id'> = {
                date: todayStr,
                note: note,
                timestamp: editingReport?.timestamp || new Date().toISOString(),
                authorId: user.uid,
                authorName: user.displayName || "شيخ غير مسمى",
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
    
    if(loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-headline font-bold">التقرير اليومي للشيخ</h1>
            
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
                            {editingReport ? 'حفظ التعديلات' : 'حفظ التقرير'}
                        </Button>
                         {editingReport && (
                            <Button variant="outline" onClick={resetForm}>
                                إلغاء التعديل
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>📂 التقارير المسجلة لهذا اليوم ({todaysReports.length})</CardTitle>
                    <CardDescription>هنا يمكنك تصفح جميع التقارير التي تم حفظها لهذا اليوم وتعديلها أو حذفها.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {todaysReports.length > 0 ? (
                        todaysReports.map(report => (
                            <Card key={report.id} className="p-4">
                               <div className="flex justify-between items-start">
                                 <div>
                                    <p><span className="font-semibold">التصنيف:</span> {report.category}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {report.authorName} - {format(parseISO(report.timestamp), 'h:mm a', { locale: ar })}
                                    </p>
                                 </div>
                                 <div className="flex items-center gap-2">
                                  <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleEditClick(report)}>
                                                <Edit className="ml-2 h-4 w-4" />
                                                <span>تعديل</span>
                                            </DropdownMenuItem>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                                    <Trash2 className="ml-2 h-4 w-4" />
                                                    <span>حذف</span>
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                     <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                سيؤدي هذا إلى حذف التقرير نهائيًا. لا يمكن التراجع عن هذا الإجراء.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteClick(report.id, report.date)}>تأكيد الحذف</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                 </div>
                               </div>
                                <p className="mt-2 whitespace-pre-wrap border-t pt-2">{report.note}</p>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground p-8">لا توجد تقارير محفوظة لهذا اليوم بعد.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
