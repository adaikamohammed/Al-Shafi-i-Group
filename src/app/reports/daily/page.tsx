

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DailyReport } from '@/lib/types';
import { Input } from '@/components/ui/input';

export default function DailyReportPage() {
    const { dailyReports, saveDailyReport, loading } = useStudentContext();
    const { user, isAdmin } = useAuth();
    const { toast } = useToast();

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user && !isAdmin) {
            const todaysReport = Object.values(dailyReports).find(r => r.date === todayStr && r.authorId === user.uid);
            if (todaysReport) {
                setNote(todaysReport.note);
            }
        }
    }, [dailyReports, todayStr, user, isAdmin]);

    const handleSaveReport = () => {
        if (isAdmin) {
            toast({ title: "خطأ", description: "المدير لا يمكنه حفظ التقارير.", variant: "destructive" });
            return;
        }
        if (!user) {
            toast({ title: "خطأ", description: "يجب تسجيل الدخول لحفظ التقارير.", variant: "destructive" });
            return;
        }
        if (!note.trim()) {
            toast({ title: "خطأ", description: "لا يمكن حفظ تقرير فارغ.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        
        const report: DailyReport = {
            date: todayStr,
            note: note,
            timestamp: new Date().toISOString(),
            authorId: user.uid,
            authorName: user.displayName || "شيخ غير مسمى"
        };
        
        try {
            saveDailyReport(report);
            toast({ title: "نجاح ✅", description: "تم حفظ تقرير اليوم بنجاح." });
        } catch(error) {
             toast({ title: "خطأ ❌", description: "فشل حفظ التقرير.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const sortedReports = useMemo(() => {
        return Object.values(dailyReports)
            .filter(report => report.note.toLowerCase().includes(searchTerm.toLowerCase()) || report.authorName.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [dailyReports, searchTerm]);

    if(loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-headline font-bold">التقرير اليومي للشيخ</h1>
            
            {!isAdmin && (
              <Card>
                  <CardHeader>
                      <CardTitle>📝 تقرير اليوم: {format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar })}</CardTitle>
                      <CardDescription>اكتب هنا ملاحظاتك العامة عن هذا اليوم، مثل السلوك العام للفوج، مستوى الحفظ، اقتراحات، أو أي حالات خاصة تستدعي انتباه الإدارة.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Textarea 
                          placeholder="مثال: كان الحفظ ممتازًا اليوم، ولكن لوحظ تأخر بعض الطلبة. أقترح..."
                          rows={6}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                      />
                      <Button onClick={handleSaveReport} disabled={isSaving} className="mt-4">
                          {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                          {Object.values(dailyReports).some(r => r.date === todayStr && r.authorId === user?.uid) ? 'تحديث تقرير اليوم' : 'حفظ تقرير اليوم'}
                      </Button>
                  </CardContent>
              </Card>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>📂 سجل التقارير السابقة</CardTitle>
                    <CardDescription>هنا يمكنك تصفح جميع التقارير التي تم حفظها من قبل الشيوخ.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input 
                        placeholder="🔍 ابحث في الملاحظات أو باسم الشيخ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mb-4"
                    />
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">التاريخ</TableHead>
                                    <TableHead className="w-[150px]">الشيخ</TableHead>
                                    <TableHead>الملاحظة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedReports.length > 0 ? (
                                    sortedReports.map(report => (
                                        <TableRow key={`${report.date}-${report.authorId}`}>
                                            <TableCell className="font-medium">{format(parseISO(report.date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell>{report.authorName}</TableCell>
                                            <TableCell className="whitespace-pre-wrap">{report.note}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">
                                            {searchTerm ? "لم يتم العثور على تقارير مطابقة للبحث." : "لا توجد تقارير محفوظة بعد."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
