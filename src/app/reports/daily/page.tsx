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
import { Loader2, Save, MoreVertical, Edit, Trash2, Eye, CheckCircle, Pin, PinOff, Mic, Square, ImagePlus, FileAudio, X, Volume2 } from 'lucide-react';
import type { DailyReport } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

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

const ReportCard = ({ report, isSuperAdmin, isAdmin, onEdit, onDelete, onTogglePin, onReview, onSetStatus }: {
    report: DailyReport;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    onEdit: (report: DailyReport) => void;
    onDelete: (reportId: string, date: string) => void;
    onTogglePin: (report: DailyReport) => void;
    onReview: (report: DailyReport, adminReply: string) => void;
    onSetStatus: (report: DailyReport, status: DailyReport['status']) => void;
}) => {
    const [adminReply, setAdminReply] = useState(report.adminNotes || '');
    const [isEditingReply, setIsEditingReply] = useState(false);
    const priority = report.priority || 'normal';

    return (
        <Card key={report.id} className={cn(
            "overflow-hidden border-l-4",
            report.isPinned ? 'border-yellow-400 ring-2 ring-yellow-400/20' : (categoryColors[report.category] || 'border-gray-300')
        )}>
            <CardHeader className="p-4 flex-row justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {report.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                        <p><span className="font-semibold">التصنيف:</span> {report.category}</p>
                        {report.priority && report.priority !== 'normal' && (
                            <Badge className={priorityConfig[report.priority].color}>
                                {priorityConfig[report.priority].label}
                            </Badge>
                        )}
                        {report.hasNewReply && !isSuperAdmin && (
                            <Badge className="bg-blue-600 animate-bounce">رد جديد 🔥</Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {report.authorName} - {format(parseISO(report.timestamp), 'd MMM yyyy, h:mm a', { locale: ar })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={report.status === 'reviewed' ? 'default' : report.status === 'in_progress' ? 'secondary' : 'outline'}
                        className={cn(
                            report.status === 'reviewed' && "bg-green-100 text-green-800 border border-green-300",
                            report.status === 'in_progress' && "bg-blue-100 text-blue-800 border border-blue-300"
                        )}>
                        {report.status === 'reviewed' ? <CheckCircle className="ml-1 h-3 w-3" /> : <Eye className="ml-1 h-3 w-3" />}
                        {report.status === 'reviewed' ? 'تمت المراجعة' : report.status === 'in_progress' ? 'قيد المعالجة' : 'لم يراجع بعد'}
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

                {report.imageURL && (
                    <div className="mt-4 rounded-lg overflow-hidden border">
                        <img
                            src={report.imageURL}
                            alt="Report detail"
                            className="max-h-[300px] w-auto mx-auto object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(report.imageURL, '_blank')}
                        />
                    </div>
                )}

                {report.audioURL && (
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <Volume2 className="h-4 w-4 text-primary" />
                        </div>
                        <audio controls src={report.audioURL} className="h-8 flex-1" />
                    </div>
                )}

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
            </CardContent>
        </Card>
    );
};

export default function DailyReportPage() {
    const { dailyReports, saveDailyReport, deleteDailyReport, loading } = useStudentContext();
    const { user, isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();

    const [note, setNote] = useState('');
    const [category, setCategory] = useState(defaultCategories[0]);
    const [priority, setPriority] = useState<DailyReport['priority']>('normal');
    const [isSaving, setIsSaving] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [editingReport, setEditingReport] = useState<DailyReport | null>(null);

    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    // Media states
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const isAdmin = isSuperAdmin || isManagement;

    // Reset media when resetting form
    const resetMedia = () => {
        setImageFile(null);
        setImagePreview(null);
        setAudioBlob(null);
        setIsRecording(false);
        setRecordingTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                setAudioBlob(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            toast({
                title: "خطأ في الميكروفون",
                description: "يرجى التأكد من إعطاء صلاحية الوصول للميكروفون.",
                variant: "destructive"
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const monthlyReports = useMemo(() => {
        return Object.values(dailyReports)
            .flatMap(dayReports => Object.values(dayReports))
            .filter(report => {
                if (!report || !report.date) return false;
                try {
                    const reportDate = parseISO(report.date);
                    return getMonth(reportDate) === selectedMonth && getYear(reportDate) === selectedYear;
                } catch (e) { return false; }
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
        setPriority('normal');
        setEditingReport(null);
        setUploadStatus(null);
        resetMedia();
    };

    const handleSaveReport = async () => {
        if (!user) {
            toast({ title: "خطأ", description: "يجب تسجيل الدخول لحفظ التقارير.", variant: "destructive" });
            return;
        }
        if (!note.trim() && !audioBlob && !imageFile) {
            toast({ title: "خطأ", description: "لا يمكن حفظ تقرير فارغ تماماً. يرجى كتابة ملاحظة أو تسجيل صوت أو رفع صورة.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        setUploadStatus("جاري البدء...");

        try {
            const reportId = editingReport?.id || Date.now().toString();
            let audioURL = editingReport?.audioURL;
            let imageURL = editingReport?.imageURL;

            const uploadTasks: Promise<any>[] = [];

            // Parallel upload Audio if exists
            if (audioBlob) {
                const aRef = storageRef(storage, `reports/audio/${reportId}`);
                uploadTasks.push(
                    (async () => {
                        setUploadStatus("جاري رفع الصوت...");
                        await uploadBytes(aRef, audioBlob);
                        audioURL = await getDownloadURL(aRef);
                    })()
                );
            }

            // Parallel upload Image if exists
            if (imageFile) {
                const iRef = storageRef(storage, `reports/images/${reportId}`);
                uploadTasks.push(
                    (async () => {
                        setUploadStatus("جاري رفع الصورة...");
                        await uploadBytes(iRef, imageFile);
                        imageURL = await getDownloadURL(iRef);
                    })()
                );
            }

            if (uploadTasks.length > 0) {
                setUploadStatus(uploadTasks.length === 2 ? "جاري رفع الملفات..." : "جاري رفع المرفق...");
                await Promise.all(uploadTasks);
            }

            setUploadStatus("جاري حفظ البيانات...");
            const reportData: Partial<DailyReport> = {
                note: note,
                category: category,
                priority: priority,
                audioURL,
                imageURL
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
        if (!isSuperAdmin && report.hasNewReply) {
            await saveDailyReport({ hasNewReply: false }, report.id);
        }
    }

    if (loading) {
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

                        {/* Media Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Voice Recording */}
                            <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/40 space-y-3">
                                <Label className="flex items-center gap-2">
                                    <Mic className="h-4 w-4 text-primary" />
                                    تسجيل صوتي
                                </Label>
                                <div className="flex items-center gap-3">
                                    {!audioBlob ? (
                                        <Button
                                            type="button"
                                            variant={isRecording ? "destructive" : "outline"}
                                            className={cn("rounded-full h-12 w-12 p-0 shadow-lg", isRecording && "animate-pulse")}
                                            onClick={isRecording ? stopRecording : startRecording}
                                        >
                                            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                                        </Button>
                                    ) : (
                                        <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-right-1">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                                <FileAudio className="h-5 w-5 text-primary" />
                                            </div>
                                            <audio controls src={URL.createObjectURL(audioBlob)} className="h-8 flex-1" />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                                                onClick={() => setAudioBlob(null)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    {isRecording && (
                                        <span className="font-mono text-destructive font-bold animate-pulse text-lg">
                                            {formatTime(recordingTime)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Image Upload */}
                            <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/40 space-y-3">
                                <Label className="flex items-center gap-2">
                                    <ImagePlus className="h-4 w-4 text-primary" />
                                    إرفاق صورة
                                </Label>
                                <div className="flex items-center gap-3">
                                    {!imagePreview ? (
                                        <div className="relative">
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                id="image-upload"
                                                onChange={handleImageSelect}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-full h-12 w-12 p-0 border-dashed border-primary/40 hover:border-primary transition-colors shadow-sm"
                                                onClick={() => document.getElementById('image-upload')?.click()}
                                            >
                                                <ImagePlus className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="relative group animate-in zoom-in-95">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="h-14 w-14 rounded-lg object-cover border-2 border-primary shadow-md"
                                            />
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 border-2 border-white shadow-sm"
                                                onClick={() => {
                                                    setImageFile(null);
                                                    setImagePreview(null);
                                                }}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                    <span className="text-xs text-muted-foreground bg-white/50 dark:bg-black/20 p-1 rounded px-2">أقصى حجم: 2MB</span>
                                </div>
                            </div>
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
                                        <div key={report.id} onMouseEnter={() => markAsRead(report)}>
                                            <ReportCard
                                                report={report}
                                                isSuperAdmin={isSuperAdmin}
                                                isAdmin={isAdmin}
                                                onEdit={handleEditClick}
                                                onDelete={handleDeleteClick}
                                                onTogglePin={handleTogglePin}
                                                onReview={handleReview}
                                                onSetStatus={handleSetStatus}
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
                                        <div key={report.id} onMouseEnter={() => markAsRead(report)}>
                                            <ReportCard
                                                report={report}
                                                isSuperAdmin={isSuperAdmin}
                                                isAdmin={isAdmin}
                                                onEdit={handleEditClick}
                                                onDelete={handleDeleteClick}
                                                onTogglePin={handleTogglePin}
                                                onReview={handleReview}
                                                onSetStatus={handleSetStatus}
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
