"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Save, FileText, UserCheck, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';

function RegisterSessionContent() {
    const { user, isSuperAdmin } = useAuth();
    const { students, loading, getSessionsForDay, addDailySession, deleteDailySession, getSessionById } = useStudentContext();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const dateParam = searchParams.get('date');
    const sessionNumParam = searchParams.get('session');

    const [selectedDay] = useState<Date>(dateParam ? parseISO(dateParam) : new Date());
    const [sessionToOpen] = useState<1 | 2>(sessionNumParam === '2' ? 2 : 1);

    const [sessionType, setSessionType] = useState<'حصة أساسية' | 'حصة تعويضية' | 'يوم عطلة' | 'غياب الشيخ' | 'حصة أنشطة'>('حصة أساسية');
    const [teacherAbsenceReason, setTeacherAbsenceReason] = useState('');
    const [substituteTeacher, setSubstituteTeacher] = useState('');
    const [activityType, setActivityType] = useState('');
    const [activityDescription, setActivityDescription] = useState('');
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

                const records: any = {};
                existingSession.records?.forEach((record: any) => {
                    records[record.studentId] = {
                        attendance: record.attendance,
                        memorization: record.memorization,
                        behavior: record.behavior,
                        notes: record.notes,
                        review: record.review
                    };
                });
                setAttendanceRecords(records);
            } else {
                setSessionType(sessionToOpen === 1 ? 'حصة أساسية' : 'حصة تعويضية');
            }
        }
    }, [loading, selectedDay, sessionToOpen, getSessionsForDay]);

    const handleUpdateRecord = (studentId: string, field: keyof AttendanceRecord, value: any) => {
        setAttendanceRecords(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { studentId, attendance: '', memorization: '', behavior: '', notes: '', review: false }),
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
                    ...(newRecords[student.id] || { memorization: '', behavior: '', notes: '', review: false }),
                    studentId: student.id,
                    attendance: 'حاضر'
                };
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم تحضير جميع الطلاب كـ 'حاضر'" });
    };

    const handleSaveSession = async () => {
        setIsSaving(true);
        try {
            const dateStr = format(selectedDay, 'yyyy-MM-dd');
            const existingSessions = getSessionsForDay(dateStr);
            const existingSession = existingSessions.find(s => s.sessionNumber === sessionToOpen);
            const id = existingSession ? existingSession.id : `${dateStr}-s${sessionToOpen}-${Date.now()}`;

            const recordsArray = Object.entries(attendanceRecords).map(([studentId, data]) => ({
                studentId,
                ...data
            })).filter(r => r.attendance);

            const sessionData = {
                id,
                date: dateStr,
                sessionNumber: sessionToOpen,
                sessionType,
                teacherAbsenceReason: sessionType === 'غياب الشيخ' ? teacherAbsenceReason : null,
                substituteTeacher: (sessionType === 'غياب الشيخ' && substituteTeacher) ? substituteTeacher : null,
                activityType: sessionType === 'حصة أنشطة' ? activityType : null,
                activityDescription: sessionType === 'حصة أنشطة' ? activityDescription : null,
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
                        <Button onClick={handleMarkAllPresent} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 h-10 rounded-xl w-full md:w-auto font-bold">
                            <UserCheck className="ml-2 h-4 w-4" /> تحضير الجميع
                        </Button>
                    )}
                </div>

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
