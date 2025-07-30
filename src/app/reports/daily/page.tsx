

"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Loader2, Save, Upload, PlusCircle, Image as ImageIcon, ExternalLink } from 'lucide-react';
import type { DailyReport } from '@/lib/types';
import Image from 'next/image';

const defaultCategories = ["اقتراح", "شكوى", "ملاحظة عامة", "شكر", "طلب"];

export default function DailyReportPage() {
    const { dailyReports, saveDailyReport, loading } = useStudentContext();
    const { user } = useAuth();
    const { toast } = useToast();

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const [note, setNote] = useState('');
    const [category, setCategory] = useState(defaultCategories[0]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const imageInputRef = useRef<HTMLInputElement>(null);

    const todaysReports = useMemo(() => {
        const reportsForToday = dailyReports?.[todayStr];
        if (!reportsForToday) return [];
        return Object.values(reportsForToday)
            .filter(report => report && typeof report === 'object') // Defensive filter
            .sort((a, b) => {
                if (a?.id && b?.id) {
                    return b.id.localeCompare(a.id);
                }
                return 0;
            });
    }, [dailyReports, todayStr]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

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
        
        const reportData: Omit<DailyReport, 'id'> = {
            date: todayStr,
            note: note,
            timestamp: new Date().toISOString(),
            authorId: user.uid,
            authorName: user.displayName || "شيخ غير مسمى",
            category: category,
        };
        
        try {
            await saveDailyReport(reportData, imageFile);
            toast({ title: "نجاح ✅", description: "تم حفظ التقرير بنجاح." });
            // Reset form
            setNote('');
            setCategory(defaultCategories[0]);
            setImageFile(null);
            setImagePreview(null);
            if (imageInputRef.current) {
                imageInputRef.current.value = '';
            }
        } catch(error) {
             toast({ title: "خطأ ❌", description: "فشل حفظ التقرير.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    if(loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-headline font-bold">التقرير اليومي للشيخ</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>➕ إضافة تقرير جديد ليوم: {format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar })}</CardTitle>
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
                            <Label htmlFor="image-upload">📷 صورة (اختياري)</Label>
                            <Input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} ref={imageInputRef} />
                        </div>
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
                    
                    {imagePreview && (
                        <div className="mt-4">
                            <p className="text-sm font-medium mb-2">معاينة الصورة:</p>
                            <Image src={imagePreview} alt="معاينة الصورة" width={200} height={200} className="rounded-md border" />
                        </div>
                    )}

                    <Button onClick={handleSaveReport} disabled={isSaving}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        حفظ التقرير
                    </Button>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>📂 التقارير المسجلة لهذا اليوم ({todaysReports.length})</CardTitle>
                    <CardDescription>هنا يمكنك تصفح جميع التقارير التي تم حفظها لهذا اليوم.</CardDescription>
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
                                  {report.imageUrl && (
                                     <a href={report.imageUrl} target="_blank" rel="noopener noreferrer">
                                        <Button variant="ghost" size="sm">
                                            <ExternalLink className="ml-2 h-4 w-4"/>
                                            فتح الصورة
                                        </Button>
                                     </a>
                                 )}
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
