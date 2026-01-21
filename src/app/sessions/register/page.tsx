"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, subDays, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AttendanceStatus, PerformanceLevel, BehaviorLevel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Save, FileText, UserCheck, AlertTriangle, ArrowRight, Trash2, BookOpen, Smile, RotateCcw, TimerOff, MessageSquare, CheckCircle, Copy, Trophy } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';
import { surahs } from '@/lib/surahs';

function RegisterSessionContent() {
    const { user, isSuperAdmin } = useAuth();
    const { students, dailySessions, loading, getSessionsForDay, addDailySession, deleteDailySession, getSessionById } = useStudentContext();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const isAdmin5 = user?.email === 'admin5@gmail.com';

    const dateParam = searchParams.get('date');
    const sessionNumParam = searchParams.get('session');

    const [selectedDay] = useState<Date>(dateParam ? parseISO(dateParam) : new Date());
    const [sessionToOpen] = useState<1 | 2>(sessionNumParam === '2' ? 2 : 1);

    const [sessionType, setSessionType] = useState<'حصة أساسية' | 'حصة تعويضية' | 'يوم عطلة' | 'غياب الشيخ' | 'حصة أنشطة'>('حصة أساسية');
    const [teacherAbsenceReason, setTeacherAbsenceReason] = useState('');
    const [substituteTeacher, setSubstituteTeacher] = useState('');
    const [activityType, setActivityType] = useState('');
    const [activityDescription, setActivityDescription] = useState('');
    const [surahId, setSurahId] = useState<number>(26); // Default Search (الشعراء)
    const [fromVerse, setFromVerse] = useState<number>(1);
    const [toVerse, setToVerse] = useState<number>(1);
    const [isReview, setIsReview] = useState(false);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
    const [isSaving, setIsSaving] = useState(false);

    const activeStudents = useMemo(() =>
        (students ?? []).filter(s => {
            const isGroupMatch = isSuperAdmin ? true : s.groupName === user?.group;
            return s.status === "نشط" && isGroupMatch;
        }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
        [students, isSuperAdmin, user]);

    useEffect(() => {
        if (!loading && selectedDay) {
            const dateStr = format(selectedDay, 'yyyy-MM-dd');
            const daySessions = getSessionsForDay(dateStr);
            const existingSession = daySessions.find(s => s.sessionNumber === sessionToOpen);

            if (existingSession) {
                setSessionType(existingSession.sessionType as any);
                setTeacherAbsenceReason(existingSession.teacherAbsenceReason || '');
                setSubstituteTeacher(existingSession.substituteTeacher || '');
                setActivityType(existingSession.activityType || '');
                setActivityDescription(existingSession.activityDescription || '');
                if (existingSession.surahId) setSurahId(existingSession.surahId);
                if (existingSession.fromVerse) setFromVerse(existingSession.fromVerse);
                if (existingSession.toVerse) setToVerse(existingSession.toVerse);
                if (existingSession.isReview) setIsReview(existingSession.isReview);

                const records: any = {};
                existingSession.records?.forEach((record: any) => {
                    records[record.studentId] = {
                        attendance: record.attendance,
                        memorization: record.memorization,
                        behavior: record.behavior,
                        notes: record.notes,
                        review: record.review,
                        surahId: record.surahId,
                        fromVerse: record.fromVerse,
                        toVerse: record.toVerse
                    };
                });
                setAttendanceRecords(records);
            } else {
                setSessionType(sessionToOpen === 1 ? 'حصة أساسية' : 'حصة تعويضية');

                // Logic for admin5 auto-increment
                if (isAdmin5 && sessionToOpen === 1) {
                    const allSessions = Object.values(dailySessions || {}).flatMap(day => Object.values(day as Record<string, any>));
                    const sortedSessions = allSessions
                        .filter(s => s.sessionType === 'حصة أساسية' && s.surahId && !s.isReview)
                        .sort((a, b) => b.date.localeCompare(a.date));

                    const latestSession = sortedSessions[0];
                    if (latestSession) {
                        const currentSurah = surahs.find(s => s.id === latestSession.surahId);
                        if (latestSession.toVerse && currentSurah && latestSession.toVerse < currentSurah.verses) {
                            setSurahId(latestSession.surahId);
                            setFromVerse(latestSession.toVerse + 1);
                            setToVerse(latestSession.toVerse + 1);
                        } else {
                            // Finish surah -> next surah
                            setSurahId((latestSession.surahId % 114) + 1);
                            setFromVerse(1);
                            setToVerse(1);
                        }
                    } else {
                        setSurahId(26); // Initial
                        setFromVerse(1);
                        setToVerse(1);
                    }
                }
            }
        }
    }, [loading, selectedDay, sessionToOpen, getSessionsForDay, dailySessions, isAdmin5]);

    const handleUpdateRecord = (studentId: string, field: keyof AttendanceRecord, value: any) => {
        setAttendanceRecords(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { studentId, attendance: '' as AttendanceStatus, memorization: '' as PerformanceLevel, behavior: '' as BehaviorLevel, notes: '', review: false }),
                [field]: value,
                attendance: field === 'attendance' ? value : (prev[studentId]?.attendance || 'حاضر')
            }
        }));
    };

    const handleMarkAllPresent = () => {
        setAttendanceRecords(prev => {
            const newRecords = { ...prev };
            activeStudents.forEach(student => {
                newRecords[student.id] = {
                    ...(newRecords[student.id] || { memorization: '' as PerformanceLevel, behavior: '' as BehaviorLevel, notes: '', review: false }),
                    studentId: student.id,
                    attendance: 'حاضر'
                };
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم تحضير جميع الطلاب كـ 'حاضر'" });
    };

    const handleMarkAllQuiet = () => {
        setAttendanceRecords(prev => {
            const newRecords = { ...prev };
            activeStudents.forEach(student => {
                const existing = newRecords[student.id] || { studentId: student.id, attendance: 'حاضر' as AttendanceStatus, memorization: '' as PerformanceLevel, behavior: '' as BehaviorLevel, notes: '', review: false };
                if (existing.attendance === 'حاضر' || existing.attendance === 'متأخر') {
                    newRecords[student.id] = { ...existing, behavior: 'هادئ' };
                }
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم ضبط سلوك جميع الحاضرين كـ 'هادئ'" });
    };

    const handleMarkAllReview = () => {
        setAttendanceRecords(prev => {
            const newRecords = { ...prev };
            activeStudents.forEach(student => {
                const existing = newRecords[student.id] || { studentId: student.id, attendance: 'حاضر' as AttendanceStatus, memorization: '' as PerformanceLevel, behavior: '' as BehaviorLevel, notes: '', review: false };
                if (existing.attendance === 'حاضر' || existing.attendance === 'متأخر') {
                    newRecords[student.id] = { ...existing, review: true };
                }
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم تفعيل 'مراجعة' لجميع الحاضرين" });
    };

    const handleSaveSession = async () => {
        setIsSaving(true);
        try {
            const dateStr = format(selectedDay, 'yyyy-MM-dd');
            const existingSessions = getSessionsForDay(dateStr);
            const existingSession = existingSessions.find(s => s.sessionNumber === sessionToOpen);
            const id = existingSession ? existingSession.id : `${dateStr}-s${sessionToOpen}-${Date.now()}`;

            const recordsArray = Object.entries(attendanceRecords).map(([studentId, data]) => ({
                ...data,
                sessionId: id,
                surahId: isAdmin5 ? surahId : (data.surahId || null),
                fromVerse: isAdmin5 ? fromVerse : (data.fromVerse || null),
                toVerse: isAdmin5 ? toVerse : (data.toVerse || null),
            })).filter(r => r.attendance);

            const sessionData: any = {
                id,
                date: dateStr,
                sessionNumber: sessionToOpen,
                sessionType,
                teacherAbsenceReason: sessionType === 'غياب الشيخ' ? teacherAbsenceReason : null,
                substituteTeacher: (sessionType === 'غياب الشيخ' && substituteTeacher) ? substituteTeacher : null,
                activityType: (sessionType === 'حصة أنشطة' && activityType) ? activityType : null,
                activityDescription: (sessionType === 'حصة أنشطة' && activityDescription) ? activityDescription : null,
                surahId: isAdmin5 ? surahId : null,
                fromVerse: isAdmin5 ? fromVerse : null,
                toVerse: isAdmin5 ? toVerse : null,
                isReview: isAdmin5 ? isReview : false,
                records: recordsArray
            };

            await addDailySession(sessionData);
            toast({
                title: "تم الحفظ بنجاح",
                description: `تم تسجيل بيانات الحصة ${sessionToOpen} ليوم ${format(selectedDay, 'dd/MM/yyyy')}`,
            });
            router.push('/sessions');
        } catch (error) {
            console.error("Error saving session:", error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ البيانات.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const [copiedDaily, setCopiedDaily] = useState(false);
    const [copiedHarvest, setCopiedHarvest] = useState(false);

    const messages = useMemo(() => {
        if (!isAdmin5 || (sessionType !== 'حصة أساسية' && sessionType !== 'حصة تعويضية')) return { daily: "", harvest: "" };

        const dateStr = format(selectedDay, 'EEEE dd-MM-yyyy', { locale: ar });
        const dayOfWeek = format(selectedDay, 'EEEE', { locale: ar });
        const isSaturday = dayOfWeek === "السبت";
        const currentSurah = surahs.find(s => s.id === surahId);
        const isCompletion = toVerse === currentSurah?.verses;
        const pad = (num: number) => num < 10 ? `0${num}` : num.toString();

        const getRecitedList = () => activeStudents
            .filter(s => {
                const record = attendanceRecords[s.id];
                return record && record.memorization && record.memorization !== "لم يحفظ" && record.memorization !== "لا يوجد" && (record.attendance === 'حاضر' || record.attendance === 'متأخر');
            })
            .map(s => `${s.fullName} : ${attendanceRecords[s.id].memorization || ''}`);

        const header = "السلام عليكم ورحمة الله وبركاته";
        const dateLine = `اليوم ${dateStr}`;
        const recitedStudents = getRecitedList();

        // Message 1: Daily Progress
        let dailyContent = "";
        if (isCompletion) {
            dailyContent = `قائمة الطلبة الذين إستظهروا سورة ${currentSurah?.name || ''} :\n`;
        } else {
            dailyContent = `قائمة الطلبة الذين إستظهروا من الآية (${pad(fromVerse)}) إلى الآية (${pad(toVerse)}) من سورة ${currentSurah?.name || ''} :\n`;
        }
        dailyContent += recitedStudents.length > 0 ? recitedStudents.join('\n') : "لا يوجد";
        const dailyMessage = `${header}\n${dateLine}\n${dailyContent}`;

        // Message 2: Weekly Harvest (Only on Saturday)
        let harvestMessage = "";
        if (isSaturday) {
            // Find Historical Range: last Sat to last Wed
            const lastSatDate = subDays(selectedDay, 7);
            const lastWedDate = subDays(selectedDay, 3);

            let harvestFrom = 0;
            let harvestTo = 0;
            let harvestSurah = currentSurah?.name || "";

            const allSessions = Object.values(dailySessions || {}).flatMap(day => Object.values(day as Record<string, any>));
            const weekSessions = allSessions.filter(s => {
                const sDate = parseISO(s.date);
                return sDate >= lastSatDate && sDate <= lastWedDate && s.sessionType === 'حصة أساسية' && s.surahId;
            }).sort((a, b) => a.date.localeCompare(b.date));

            if (weekSessions.length > 0) {
                harvestFrom = weekSessions[0].fromVerse || 0;
                harvestTo = weekSessions[weekSessions.length - 1].toVerse || 0;
                const hSurah = surahs.find(s => s.id === weekSessions[0].surahId);
                harvestSurah = hSurah ? hSurah.name : harvestSurah;
            }

            let harvestContent = `قائمة الطلاب الذين إستظهروا الحصيلة الأسبوعية / سورة ${harvestSurah} من الآية (${pad(harvestFrom)}) إلى (${pad(harvestTo)}) :\n`;
            harvestContent += recitedStudents.length > 0 ? recitedStudents.join('\n') : "لا يوجد";

            const notRecitedStudents = activeStudents
                .filter(s => {
                    const record = attendanceRecords[s.id];
                    const isPresent = record && (record.attendance === 'حاضر' || record.attendance === 'متأخر');
                    const hasRecited = record && record.memorization && record.memorization !== "لم يحفظ" && record.memorization !== "لا يوجد";
                    return isPresent && !hasRecited;
                })
                .map(s => s.fullName);

            if (notRecitedStudents.length > 0) {
                harvestContent += `\n\nقائمة الطلاب الذين لم يستظهروا الحصيلة الأسبوعية :\n`;
                harvestContent += notRecitedStudents.join('\n');
            }
            harvestMessage = `${header}\n${dateLine}\n${harvestContent}`;
        }

        return { daily: dailyMessage, harvest: harvestMessage };
    }, [isAdmin5, sessionType, selectedDay, surahId, fromVerse, toVerse, activeStudents, attendanceRecords, dailySessions]);

    const handleCopyMessage = () => {
        navigator.clipboard.writeText(whatsappMessage);
        setCopied(true);
        toast({ title: "تم النسخ", description: "تم نسخ رسالة الواتساب إلى الحافظة." });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDelete = async () => {
        if (confirm('هل أنت متأكد من حذف بيانات هذه الحصة؟')) {
            const dateStr = format(selectedDay, 'yyyy-MM-dd');
            const session = getSessionsForDay(dateStr).find(s => s.sessionNumber === sessionToOpen);
            if (session) {
                await deleteDailySession(session.id);
                toast({ title: "تم الحذف", description: "تم حذف بيانات الحصة بنجاح." });
                router.push('/sessions');
            }
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto p-4 max-w-4xl space-y-6 pb-24 rtl" dir="rtl">
            <header className="flex items-center justify-between gap-4 bg-card p-4 rounded-2xl shadow-sm border">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/sessions')} className="rounded-xl">
                        <ArrowRight className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-headline font-bold flex items-center gap-2">
                            <FileText className="h-6 w-6 text-primary" />
                            تسجيل حصة: {format(selectedDay, 'd MMMM yyyy', { locale: ar })}
                        </h1>
                        <p className="text-xs text-muted-foreground font-body">
                            رقم الحصة: <span className="font-bold text-primary">{sessionToOpen}</span> (يوم {format(selectedDay, 'EEEE', { locale: ar })})
                        </p>
                    </div>
                </div>
            </header>

            <section className="bg-card p-4 rounded-2xl shadow-sm border space-y-4">
                {(sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية') && (
                    <SessionStatsWidget students={activeStudents} records={attendanceRecords} />
                )}

                <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                    <div className="space-y-1 flex-1 w-full">
                        <Label className="text-xs text-muted-foreground font-bold">نوع الحصة</Label>
                        <Select value={sessionType} onValueChange={(val: any) => setSessionType(val)} dir="rtl">
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="حصة أساسية">حصة أساسية</SelectItem>
                                <SelectItem value="حصة أنشطة">حصة أنشطة 🏃‍♂️</SelectItem>
                                {sessionToOpen === 2 && <SelectItem value="حصة تعويضية">حصة تعويضية</SelectItem>}
                                <SelectItem value="يوم عطلة">يوم عطلة</SelectItem>
                                <SelectItem value="غياب الشيخ">غياب الشيخ</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية' || sessionType === 'حصة أنشطة' || (sessionType === 'غياب الشيخ' && substituteTeacher)) && (
                        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                            <Button onClick={handleMarkAllPresent} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 h-10 rounded-xl flex-1 md:flex-none font-bold text-xs">
                                <UserCheck className="ml-2 h-4 w-4" /> تحضير الجميع
                            </Button>
                            <Button onClick={handleMarkAllQuiet} variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 h-10 rounded-xl flex-1 md:flex-none font-bold text-xs">
                                <Smile className="ml-2 h-4 w-4" /> هدوء الجميع
                            </Button>
                            <Button onClick={handleMarkAllReview} variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 h-10 rounded-xl flex-1 md:flex-none font-bold text-xs">
                                <RotateCcw className="ml-2 h-4 w-4" /> مراجعة الجميع
                            </Button>
                        </div>
                    )}
                </div>

                {isAdmin5 && (sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية') && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-800 font-bold">
                                <BookOpen className="h-5 w-5" />
                                <span>بيانات الحفظ الجماعية لسورة {surahs.find(s => s.id === surahId)?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => setIsReview(!isReview)}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-8 rounded-lg font-bold text-[10px] transition-all",
                                        isReview
                                            ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                                            : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-sm"
                                    )}
                                >
                                    {isReview ? <RotateCcw className="ml-1 h-3 w-3 animate-spin-slow" /> : <TimerOff className="ml-1 h-3 w-3" />}
                                    {isReview ? "وضع المراجعة (العداد متوقف)" : "توقيف العداد (مراجعة)"}
                                </Button>
                                <div className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full text-emerald-700 font-bold">
                                    خاص بـ {user?.displayName || 'الشيخ'}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-1 col-span-1 md:col-span-2">
                                <Label className="text-[11px] font-bold text-emerald-700">السورة</Label>
                                <Select value={surahId.toString()} onValueChange={(val) => setSurahId(parseInt(val))} dir="rtl">
                                    <SelectTrigger className="h-10 bg-white border-emerald-200 focus:ring-emerald-500">
                                        <SelectValue placeholder="اختر السورة" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {surahs.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.id}. {s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-4">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-[11px] font-bold text-emerald-700">من آية</Label>
                                    <Input
                                        type="number"
                                        value={fromVerse}
                                        onChange={(e) => setFromVerse(parseInt(e.target.value))}
                                        className="h-10 bg-white border-emerald-200 focus:border-emerald-500"
                                        min={1}
                                    />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <Label className="text-[11px] font-bold text-emerald-700">إلى آية</Label>
                                    <Input
                                        type="number"
                                        value={toVerse}
                                        onChange={(e) => setToVerse(parseInt(e.target.value))}
                                        className="h-10 bg-white border-emerald-200 focus:border-emerald-500"
                                        min={fromVerse}
                                        max={surahs.find(s => s.id === surahId)?.verses || 286}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {sessionType === 'غياب الشيخ' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">سبب الغياب</Label>
                            <Input value={teacherAbsenceReason} onChange={(e) => setTeacherAbsenceReason(e.target.value)} placeholder="السبب..." className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">المستخلف (اختياري)</Label>
                            <Input value={substituteTeacher} onChange={(e) => setSubstituteTeacher(e.target.value)} placeholder="اسم البديل" className="h-10 rounded-xl" />
                        </div>
                    </div>
                )}

                {sessionType === 'حصة أنشطة' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">نوع النشاط</Label>
                            <Input value={activityType} onChange={(e) => setActivityType(e.target.value)} placeholder="مثال: كرة قدم..." className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">نبذة مختصرة</Label>
                            <Input value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} placeholder="وصف للنشاط..." className="h-10 rounded-xl" />
                        </div>
                    </div>
                )}
            </section>

            <main className="bg-card rounded-2xl shadow-sm border min-h-[400px]">
                {(sessionType === 'يوم عطلة' || (sessionType === 'غياب الشيخ' && !substituteTeacher)) ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                        <div className="p-6 bg-amber-100 rounded-full text-amber-600">
                            <AlertTriangle className="h-12 w-12" />
                        </div>
                        <h3 className="text-xl font-bold font-headline">لا يوجد تسجيل حضور</h3>
                        <p className="text-muted-foreground font-body max-w-sm text-sm">
                            {sessionType === 'يوم عطلة' ? 'هذا اليوم عطلة رسمية.' : 'يرجى تسجيل سبب الغياب أعلاه.'}
                        </p>
                    </div>
                ) : (
                    <div className="p-4">
                        <AttendanceList
                            students={activeStudents}
                            records={attendanceRecords}
                            onUpdateRecord={handleUpdateRecord}
                            sessionType={sessionType}
                        />
                    </div>
                )}
            </main>

            {isAdmin5 && messages.daily && (
                <div className="space-y-4">
                    <section className="bg-card p-4 rounded-2xl shadow-sm border space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <MessageSquare className="h-5 w-5" />
                                <span>رسالة الورد اليومي (WhatsApp)</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyDaily}
                                className={cn(
                                    "h-9 rounded-xl font-bold transition-all",
                                    copiedDaily ? "bg-green-50 text-green-700 border-green-200" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
                                )}
                            >
                                {copiedDaily ? <CheckCircle className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
                                {copiedDaily ? "تم النسخ" : "نسخ الرسالة"}
                            </Button>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl text-sm font-body whitespace-pre-wrap leading-relaxed border border-dashed text-right" dir="rtl">
                            {messages.daily}
                        </div>
                    </section>

                    {messages.harvest && (
                        <section className="bg-emerald-50/50 p-4 rounded-2xl shadow-sm border border-emerald-100 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                                    <Trophy className="h-5 w-5 text-emerald-600" />
                                    <span>رسالة الحصيلة الأسبوعية (WhatsApp)</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyHarvest}
                                    className={cn(
                                        "h-9 rounded-xl font-bold transition-all",
                                        copiedHarvest ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-emerald-100/50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-100"
                                    )}
                                >
                                    {copiedHarvest ? <CheckCircle className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
                                    {copiedHarvest ? "تم النسخ" : "نسخ الحصيلة"}
                                </Button>
                            </div>
                            <div className="bg-white/60 p-4 rounded-xl text-sm font-body whitespace-pre-wrap leading-relaxed border border-emerald-100 text-right text-emerald-900" dir="rtl">
                                {messages.harvest}
                            </div>
                            <p className="text-[10px] text-emerald-600/70 text-center italic">
                                ظهرت هذه الرسالة لأن اليوم هو السبت، وهي تلخص عمل الأسبوع الماضي (السبت-الأربعاء).
                            </p>
                        </section>
                    )}
                </div>
            )}

            <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t p-4 z-50">
                <div className="container mx-auto max-w-4xl flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push('/sessions')} className="h-11 rounded-xl px-6">إلغاء</Button>
                        <Button variant="destructive" onClick={handleDelete} className="h-11 rounded-xl px-4 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button onClick={handleSaveSession} disabled={isSaving} className="min-w-[160px] h-11 rounded-xl font-bold shadow-lg shadow-primary/20">
                        {isSaving ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : <Save className="ml-2 h-5 w-5" />}
                        حفظ بيانات الحصة
                    </Button>
                </div>
            </footer>
        </div>
    );
}

export default function RegisterSessionPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <RegisterSessionContent />
        </Suspense>
    );
}
