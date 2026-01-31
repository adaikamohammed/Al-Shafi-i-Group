"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, KeyRound, Edit, Save, Users, CheckCircle, BookCopy, BookHeart, Lock, UserX, CalendarX, Mail, MapPin, Info, Image as ImageIcon, Briefcase, Heart, Award, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EducationEvent } from '@/lib/types';
import { ProfileTimeline } from '@/components/profile/ProfileTimeline';
import { DailyBriefing } from '@/components/profile/DailyBriefing';

export default function ProfilePage() {
    const { user, loading: authLoading, isSuperAdmin, updateUserProfile } = useAuth();
    const { students, dailySessions, surahProgress } = useStudentContext();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backgroundInputRef = useRef<HTMLInputElement>(null);

    const [isUnlockModalOpen, setUnlockModalOpen] = useState(false);
    const [adminCode, setAdminCode] = useState('');
    const [isAdminViewUnlocked, setIsAdminViewUnlocked] = useState(false);

    // Consolidated Form Data
    const [formData, setFormData] = useState({
        displayName: '',
        address: '',
        maritalStatus: 'أعزب' as 'أعزب' | 'متزوج',
        phone: '',
        secondaryPhone: '',
        certifications: '',
        achievements: '',
        futurePlans: '',
        bio: '',
        joinDate: '',
        birthDate: '',
        quranCompletedDate: ''
    });

    const [educationTimeline, setEducationTimeline] = useState<EducationEvent[]>([]);

    // Admin-specific fields state
    const [adminNotes, setAdminNotes] = useState('');
    const [adminAwards, setAdminAwards] = useState('');


    const performanceStats = useMemo(() => {
        if (!user || !students || !dailySessions) {
            return { studentCount: 0, attendanceRate: 0, khatmeenCount: 0, totalMasteredSurahs: 0, expelledStudentsCount: 0, sheikhAbsenceDays: 0 };
        }

        const groupName = isSuperAdmin ? undefined : user.group;
        const groupStudents = students.filter(s => groupName ? s.groupName === groupName : true);
        const activeStudents = groupStudents.filter(s => s.status === 'نشط');
        const expelledStudentsCount = groupStudents.filter(s => s.status === 'مطرود').length;
        const studentCount = activeStudents.length;

        let totalMasteredSurahs = 0;
        const khatmeenCount = activeStudents.filter(student => {
            const studentProgress = surahProgress ? (surahProgress[student.id] || {}) : {};
            const masteredCount = Object.values(studentProgress).filter(status => status === 2).length;
            totalMasteredSurahs += masteredCount;
            return (student.memorizedSurahsCount || 0) >= 114;
        }).length;

        const currentMonthStart = startOfMonth(new Date());
        const currentMonthEnd = endOfMonth(new Date());

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(day => Object.values(day)).filter(session => {
            if (!session.date) return false;
            try {
                const sessionDate = parseISO(session.date);
                return isWithinInterval(sessionDate, { start: currentMonthStart, end: currentMonthEnd });
            } catch (e) { return false; }
        });

        let sheikhAbsenceDays = 0;
        const uniqueAbsenceDates = new Set();
        sessionsInMonth.forEach(session => {
            if (session.sessionType === 'غياب الشيخ') {
                if (!uniqueAbsenceDates.has(session.date)) {
                    sheikhAbsenceDays++;
                    uniqueAbsenceDates.add(session.date);
                }
            }
        });

        let totalPresent = 0;
        let totalHeld = 0;
        const scheduledSessions = sessionsInMonth.filter(s => s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة تعويضية' || (s.sessionType === 'غياب الشيخ' && s.substituteTeacher));
        totalHeld = activeStudents.length * scheduledSessions.length;

        activeStudents.forEach(student => {
            scheduledSessions.forEach(session => {
                const record = (session.records ?? []).find(r => r.studentId === student.id);
                if (record && (record.attendance === 'حاضر' || record.attendance === 'متأخر')) {
                    totalPresent++;
                }
            });
        });

        const attendanceRate = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;
        return { studentCount, attendanceRate, khatmeenCount, totalMasteredSurahs, expelledStudentsCount, sheikhAbsenceDays };

    }, [user, students, dailySessions, isSuperAdmin, surahProgress]);

    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                address: user.address || '',
                maritalStatus: user.maritalStatus || 'أعزب',
                phone: user.phone || '',
                secondaryPhone: user.secondaryPhone || '',
                certifications: user.certifications || '',
                achievements: user.achievements || '',
                futurePlans: user.futurePlans || '',
                bio: user.bio || '',
                joinDate: user.joinDate || '',
                birthDate: user.birthDate || '',
                quranCompletedDate: user.quranCompletedDate || ''
            });
            setEducationTimeline(user.educationTimeline || []);
            setAdminNotes(user.adminNotes || '');
            setAdminAwards(user.adminAwards || '');

            if (!photoFile) setPhotoPreview(user.photoURL || null);
            if (!backgroundFile) setBackgroundPreview(user.backgroundURL || null);
            if (isSuperAdmin) setIsAdminViewUnlocked(true);
        }
    }, [user, isSuperAdmin, photoFile, backgroundFile]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string, field: keyof typeof formData) => {
        if (typeof e === 'string') {
            setFormData(prev => ({ ...prev, [field]: e }));
        } else {
            const { value } = e.target;
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            toast({ title: 'خطأ', description: 'صيغة الملف غير مدعومة.', variant: 'destructive' });
            return;
        }
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const img = new Image();
            img.src = loadEvent.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500; const MAX_HEIGHT = 500;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                        setPhotoFile(compressedFile);
                        setPhotoPreview(URL.createObjectURL(compressedFile));
                    }
                }, 'image/jpeg', 0.7);
            };
        };
        reader.readAsDataURL(file);
    };

    const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const img = new Image();
            img.src = loadEvent.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200; const MAX_HEIGHT = 400;
                let width = img.width; let height = img.height;
                if (width / height > MAX_WIDTH / MAX_HEIGHT) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                        setBackgroundFile(compressedFile);
                        setBackgroundPreview(URL.createObjectURL(compressedFile));
                    }
                }, 'image/jpeg', 0.6);
            };
        };
        reader.readAsDataURL(file);
    };

    const handleSaveChanges = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateUserProfile({
                ...formData,
                educationTimeline,
                photoFile,
                backgroundFile
            });
            setPhotoFile(null);
            setBackgroundFile(null);
            toast({ title: '✅ تم الحفظ', description: 'تم تحديث الملف الشخصي بنجاح.' });
        } catch (error) {
            console.error("Save error:", error);
        } finally {
            setIsSaving(false);
        }
    }

    const handleSaveAdminChanges = async () => {
        if (!user || !isAdminViewUnlocked) return;
        setIsSaving(true);
        try {
            await updateUserProfile({ joinDate: formData.joinDate, adminNotes, adminAwards });
            toast({ title: '✅ تم الحفظ', description: 'تم تحديث السجل الإداري بنجاح.' });
        } catch (error) {
            console.error("Admin save error:", error);
        } finally {
            setIsSaving(false);
        }
    }

    const handleUnlock = () => {
        if (adminCode === 'admin8888') {
            setIsAdminViewUnlocked(true);
            setUnlockModalOpen(false);
            setAdminCode('');
            toast({ title: '✅ تم فتح الوصول', description: 'يمكنك الآن عرض وتعديل السجل الإداري.' });
        } else {
            toast({ title: '❌ خطأ', description: 'كود الإدارة غير صحيح.', variant: 'destructive' });
        }
    };

    if (authLoading || !user) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground font-body animate-pulse">جاري تحميل الملف الشخصي الآمن...</p>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 1. Assistant Greeting */}
            <DailyBriefing students={students} dailySessions={dailySessions} sheikhName={user.displayName || 'الشيخ الكريم'} />

            {/* 2. Premium Header */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/20 shadow-2xl bg-gradient-to-br from-primary/20 via-background to-primary/5 p-8 md:p-12">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full -ml-32 -mb-32 blur-3xl" />

                <div className="relative flex flex-col md:flex-row items-center gap-8">
                    {/* Avatar */}
                    <div className="relative group">
                        <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg" className="hidden" />
                        <motion.div whileHover={{ scale: 1.05 }} className="relative w-32 h-32 md:w-40 md:h-40">
                            <Avatar className="w-full h-full border-4 border-background shadow-2xl ring-4 ring-primary/20 bg-muted">
                                <AvatarImage src={photoPreview || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} className="object-cover" />
                                <AvatarFallback className="text-4xl bg-primary text-white">{user.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
                                <Edit className="h-6 w-6" />
                            </button>
                        </motion.div>
                        {photoFile && (<Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 whitespace-nowrap bg-emerald-500 animate-pulse">جاهز للحفظ</Badge>)}
                    </div>

                    <div className="flex-1 text-center md:text-start space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-body mb-2">
                            <Award className="h-3 w-3" />
                            {user.role === 'super_admin' ? 'المدير العام' : 'شيخ الفوج المعتمد'}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-headline font-bold text-gray-900 leading-tight">
                            {user.displayName}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-muted-foreground font-body">
                            {formData.address && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {formData.address}</span>}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 min-w-[180px]">
                        <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full rounded-xl py-6 font-bold font-headline shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                            حفظ التعديلات
                        </Button>
                    </div>
                </div>
            </div>

            {/* 3. Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'الطلبة النشطين', value: performanceStats.studentCount, icon: Users, color: 'bg-blue-50 text-blue-600' },
                    { label: 'نسبة الحضور', value: `${performanceStats.attendanceRate.toFixed(1)}%`, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
                    { label: 'عدد الخاتمين', value: performanceStats.khatmeenCount, icon: Heart, color: 'bg-pink-50 text-pink-600' },
                    { label: 'السور المتقنة', value: performanceStats.totalMasteredSurahs, icon: BookHeart, color: 'bg-purple-50 text-purple-600' },
                    { label: 'الطلبة المطرودين', value: performanceStats.expelledStudentsCount, icon: UserX, color: 'bg-orange-50 text-orange-600' },
                    { label: 'أيام غياب الشيخ', value: performanceStats.sheikhAbsenceDays, icon: CalendarX, color: 'bg-slate-100 text-slate-600' },
                ].map((stat, idx) => (
                    <div key={idx} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                        <Card className="border-none shadow-sm hover:shadow-md transition-shadow h-full">
                            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                                <div className={cn("p-2 rounded-xl", stat.color)}>
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <div className="space-y-0.5 w-full">
                                    <p className="text-[10px] text-muted-foreground font-body font-bold uppercase tracking-wider">{stat.label}</p>
                                    <p className="text-xl font-headline font-bold">{stat.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6 w-full max-w-md mx-auto grid grid-cols-2 lg:max-w-xl">
                    <TabsTrigger value="overview" className="rounded-xl font-headline font-bold py-3">
                        <User className="ml-2 h-4 w-4" /> الملف والسيرة
                    </TabsTrigger>
                    <TabsTrigger value="official" onClick={(e) => { if (!isAdminViewUnlocked && !isSuperAdmin) { e.preventDefault(); setUnlockModalOpen(true); } }} className="rounded-xl font-headline font-bold py-3">
                        <Briefcase className="ml-2 h-4 w-4" /> السجل والوثائق
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column: Timeline & Impact */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Living CV & Timeline */}
                                <ProfileTimeline
                                    educationTimeline={educationTimeline}
                                    onChange={setEducationTimeline}
                                    birthDate={formData.birthDate}
                                    onBirthDateChange={(date) => setFormData(prev => ({ ...prev, birthDate: date }))}
                                    quranCompletedDate={formData.quranCompletedDate}
                                    onQuranCompletedDateChange={(date) => setFormData(prev => ({ ...prev, quranCompletedDate: date }))}
                                    editable={true}
                                />
                            </div>

                            {/* Right Column: Personal Details & Bio */}
                            <div className="lg:col-span-1 space-y-6">
                                <Card className="rounded-[1.5rem] border-none shadow-sm overflow-hidden">
                                    <CardHeader>
                                        <CardTitle className="text-xl font-headline">البيانات الشخصية</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">الاسم الكامل</Label>
                                            <Input className="rounded-xl border-muted bg-muted/20" value={formData.displayName} onChange={(e) => handleInputChange(e, 'displayName')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">الحالة الاجتماعية</Label>
                                            <Select dir="rtl" value={formData.maritalStatus} onValueChange={(value) => handleInputChange(value, 'maritalStatus')}>
                                                <SelectTrigger className="rounded-xl bg-muted/20"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="أعزب">أعزب</SelectItem>
                                                    <SelectItem value="متزوج">متزوج</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">رقم الهاتف</Label>
                                            <Input className="rounded-xl bg-muted/20" type="tel" value={formData.phone} onChange={(e) => handleInputChange(e, 'phone')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">السكن</Label>
                                            <Input className="rounded-xl bg-muted/20" value={formData.address} onChange={(e) => handleInputChange(e, 'address')} />
                                        </div>
                                        <Separator />
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">إنجازات الشيخ (قائمة)</Label>
                                            <Textarea className="rounded-xl bg-muted/20 min-h-[100px]" value={formData.achievements} onChange={(e) => handleInputChange(e, 'achievements')} placeholder="أهم الإنجازات التي تفتخر بها..." />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">الخطط المستقبيلة</Label>
                                            <Textarea className="rounded-xl bg-muted/20 min-h-[100px]" value={formData.futurePlans} onChange={(e) => handleInputChange(e, 'futurePlans')} placeholder="ما الذي تطمح لتحقيقه..." />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">نبذة تعريفية سريعة</Label>
                                            <Textarea className="rounded-xl bg-muted/20 min-h-[120px]" value={formData.bio} onChange={(e) => handleInputChange(e, 'bio')} placeholder="اكتب نبذة عنك..." />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold text-xs">الإجازات العلمية</Label>
                                            <Textarea className="rounded-xl bg-muted/20 min-h-[100px]" value={formData.certifications} onChange={(e) => handleInputChange(e, 'certifications')} placeholder="قائمة الإجازات..." />
                                        </div>
                                    </CardContent>
                                </Card>

                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="official">
                    {/* Admin/Official Record Section (Kept mostly similar to keep token usage low, just essential logic) */}
                    <div className="animate-in fade-in slide-in-from-left-4">
                        <Card className="rounded-[1.5rem] border-none shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-900 text-white p-8">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                        <Briefcase className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-2xl font-headline font-bold">السجل الوظيفي والإداري</CardTitle>
                                        <CardDescription className="text-white/60 font-body">محفوظات الإدارة والتقييمات المعتمدة.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                {isAdminViewUnlocked || isSuperAdmin ? (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                                <Label className="text-slate-900 font-bold flex items-center gap-2">
                                                    <CalendarX className="h-4 w-4 text-slate-500" /> تاريخ الانضمام للمدرسة
                                                </Label>
                                                <Input type="date" value={formData.joinDate} onChange={(e) => handleInputChange(e, 'joinDate')} className="bg-white border-slate-300 rounded-xl" />
                                            </div>
                                            <div className="space-y-3 bg-amber-50 p-6 rounded-2xl border border-amber-200">
                                                <Label className="text-amber-900 font-bold flex items-center gap-2">
                                                    <ImageIcon className="h-4 w-4 text-amber-500" /> خلفية الملف المخصصة
                                                </Label>
                                                <input type="file" ref={backgroundInputRef} onChange={handleBackgroundChange} accept="image/png, image/jpeg" className="hidden" />
                                                <Button variant="outline" className="w-full bg-white border-amber-300 rounded-xl" onClick={() => backgroundInputRef.current?.click()}>
                                                    {backgroundFile ? "✅ جاهزة" : "تغيير الخلفية"}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold flex items-center gap-2">
                                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> تقييم الإدارة العام
                                            </Label>
                                            <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="min-h-[150px] rounded-2xl border-slate-200 bg-slate-50/50" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold flex items-center gap-2 text-indigo-700">
                                                <Award className="h-4 w-4" /> سجل الجوائز والمكافآت
                                            </Label>
                                            <Textarea value={adminAwards} onChange={(e) => setAdminAwards(e.target.value)} className="min-h-[150px] rounded-2xl border-indigo-100 bg-indigo-50/30" />
                                        </div>
                                        <Button onClick={handleSaveAdminChanges} disabled={isSaving} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8 py-6 h-auto font-headline font-bold">
                                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                                            حفظ السجل الإداري نهائياً
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                                        <Lock className="h-12 w-12 text-slate-400" />
                                        <h3 className="text-2xl font-headline font-bold text-slate-900">الوصول مقيد</h3>
                                        <Button className="bg-slate-900" onClick={() => setUnlockModalOpen(true)}>فتح السجل</Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isUnlockModalOpen} onOpenChange={setUnlockModalOpen}>
                <DialogContent className="rounded-[2rem] p-8 border-none shadow-2xl max-w-sm">
                    <DialogHeader className="items-center text-center pb-4">
                        <DialogTitle className="text-2xl font-headline font-bold">بوابة الإدارة</DialogTitle>
                        <DialogDescription className="font-body">أدخل الرمز السري.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input type="password" className="rounded-xl h-12 text-center text-xl tracking-[1em]" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} autoFocus />
                        <Button onClick={handleUnlock} className="w-full rounded-xl py-6 font-bold shadow-lg">تأكيد الدخول</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
