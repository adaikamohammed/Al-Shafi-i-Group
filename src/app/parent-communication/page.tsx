"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import {
    MessageSquare,
    Send,
    Users,
    Calendar,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Smartphone,
    UserCircle,
    Copy,
    Share2,
    Clock,
    BookOpen,
    ArrowRight
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO, startOfWeek, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

type MessageTemplate = "weekly_summary" | "absence_warning" | "memorization_alert" | "behavior_note" | "encouragement" | "meeting_invite";

export default function ParentCommunicationPage() {
    const { students, dailySessions, loading, shareStudentRecord } = useStudentContext();
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [template, setTemplate] = useState<MessageTemplate>('weekly_summary');
    const [messageContent, setMessageContent] = useState('');

    // Time Filtering States
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

    const activeStudents = useMemo(() =>
        (students ?? [])
            .filter(s => s.status === 'نشط')
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
        [students]);

    const studentOptions: SearchableSelectOption[] = useMemo(() =>
        activeStudents.map(s => ({ value: s.id, label: s.fullName })),
        [activeStudents]);

    const selectedStudent = useMemo(() =>
        activeStudents.find(s => s.id === selectedStudentId),
        [activeStudents, selectedStudentId]);

    // Generate List of Weeks for the selected month/year
    const weeksInMonth = useMemo(() => {
        const weeks = [];
        const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEnd = endOfMonth(monthStart);

        let current = startOfWeek(monthStart, { weekStartsOn: 6 }); // Saturday

        while (current <= monthEnd) {
            const sat = startOfDay(current);
            const fri = endOfDay(addDays(sat, 6)); // Sat to Fri (7 days)
            weeks.push({ sat, fri });
            current = addDays(current, 7);
        }
        return weeks;
    }, [selectedMonth, selectedYear]);

    // Set default week to current week if possible
    useEffect(() => {
        const now = new Date();
        const currentSat = startOfWeek(now, { weekStartsOn: 6 });
        const index = weeksInMonth.findIndex(w => format(w.sat, 'yyyy-MM-dd') === format(currentSat, 'yyyy-MM-dd'));
        if (index !== -1) setSelectedWeekIndex(index);
        else setSelectedWeekIndex(0);
    }, [weeksInMonth]);

    // Calculate Week Range (Saturday to Wednesday for study summary)
    const weekStats = useMemo(() => {
        if (!selectedStudentId || !weeksInMonth[selectedWeekIndex]) return null;

        const { sat } = weeksInMonth[selectedWeekIndex];
        const wed = addDays(sat, 4); // Sat+4 = Wed

        const startDate = startOfDay(sat);
        const endDate = endOfDay(addDays(sat, 6)); // Full week Sat-Fri

        const sessionsInRange = Object.values(dailySessions ?? {}).flatMap(day => Object.values(day)).filter(session => {
            if (!session.date) return false;
            const d = parseISO(session.date);
            return isWithinInterval(d, { start: startDate, end: endDate });
        });

        const stats = {
            present: 0,
            absent: 0,
            late: 0,
            memorizationDays: 0,
            totalSessions: 0,
            evalScore: 0,
            evalCount: 0,
        };

        sessionsInRange.forEach(session => {
            const record = (session.records ?? []).find(r => r.studentId === selectedStudentId);
            if (record) {
                stats.totalSessions++;
                if (record.attendance === 'حاضر') stats.present++;
                if (record.attendance === 'غائب' || record.attendance === 'غياب') stats.absent++;
                if (record.attendance === 'متأخر') stats.late++;

                if (record.memorization && record.memorization !== 'لم يحفظ' && record.memorization !== 'لا يوجد') {
                    stats.memorizationDays++;
                    const scores: any = { 'ممتاز': 10, 'جيد جداً': 8, 'جيد': 6, 'متوسط': 4, 'ضعيف': 2 };
                    if (scores[record.memorization]) {
                        stats.evalScore += scores[record.memorization];
                        stats.evalCount++;
                    }
                }
            }
        });

        const avgScore = stats.evalCount > 0 ? stats.evalScore / stats.evalCount : 0;
        let generalEval = "لم يتم التقييم";
        if (avgScore >= 9) generalEval = "ممتاز جداً 🌟";
        else if (avgScore >= 7) generalEval = "جيد جداً 👍";
        else if (avgScore >= 5) generalEval = "جيد";
        else if (avgScore >= 3) generalEval = "يحتاج اهتمام";
        else if (avgScore > 0) generalEval = "ضعيف";

        return {
            sat,
            fri: weeksInMonth[selectedWeekIndex].fri,
            wed,
            ...stats,
            generalEval
        };
    }, [selectedStudentId, dailySessions, weeksInMonth, selectedWeekIndex]);

    useEffect(() => {
        if (!selectedStudent) {
            setMessageContent('');
            return;
        }

        const sName = selectedStudent.fullName;
        const gName = selectedStudent.guardianName || "ولي الأمر";
        const teacher = user?.displayName || "الشيخ";
        const recordLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/record/${selectedStudent.id}`;

        let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
        msg += `السيد ${gName} المحترم،\n\n`;

        switch (template) {
            case 'weekly_summary':
                if (weekStats) {
                    msg += `نحيطكم علماً بملخص أداء ابنكم/ابنتكم (${sName}) للأسبوع (من ${format(weekStats.sat, 'dd MMM')} إلى ${format(weekStats.fri, 'dd MMM')}):\n`;
                    msg += `📍 الحضور: حضر ${weekStats.present} حصص، وتغيب ${weekStats.absent}.\n`;
                    msg += `📍 الحفظ: قام بالتسميع في ${weekStats.memorizationDays} أيام خلال الأسبوع.\n`;
                    msg += `📍 التقييم العام لهذا الأسبوع: ${weekStats.generalEval}.\n\n`;
                }
                break;
            case 'absence_warning':
                msg += `نحيطكم علماً بأن الطالب (${sName}) قد تغيب مؤخراً دون عذر مسبق. نرجو منكم المتابعة والحرص على انتظامه في الحلقة لضمان عدم تأخر مستواه.\n\n`;
                break;
            case 'memorization_alert':
                msg += `نود لفت انتباهكم إلى أن مستوى حفظ الطالب (${sName}) في الحصص الأخيرة يحتاج إلى مزيد من المراجعة والتركيز في المنزل. نرجو التعاون معنا لتحقيق أفضل النتائج.\n\n`;
                break;
            case 'encouragement':
                msg += `مبارك لكم! نود أن نبشركم بالتقدم الملحوظ والأداء المتميز للطالب (${sName}) في حفظ كتاب الله خلال الفترة الأخيرة. نرجو الاستمرار في تشجيعه.\n\n`;
                break;
            case 'behavior_note':
                msg += `نحيطكم علماً بحاجة الطالب (${sName}) لمزيد من الانضباط داخل الحلقة. نرجو منكم توجيهه لأهمية الهدوء والتركيز أثناء الدرس.\n\n`;
                break;
            case 'meeting_invite':
                msg += `يرجى منكم الحضور لمقر مدرسة الشافعي لمقابلة الشيخ المسؤول عن حلقة الطالب (${sName}) في أقرب فرصة ممكنة لأمر يخص مساره التعليمي.\n\n`;
                break;
        }

        msg += `🔗 لمراجعة السجل الكامل للطالب ورؤية تفاصيل الأداء: \n${recordLink}\n\n`;
        msg += `نسأل الله له التوفيق والثبات.\n`;
        msg += `تحياتنا،\n${teacher}`;
        setMessageContent(msg);
    }, [template, selectedStudent, user, weekStats]);

    const handleSendWhatsApp = async () => {
        if (!messageContent || !selectedStudent?.phone1) {
            toast({
                title: "بيانات ناقصة",
                description: "يرجى اختيار طالب والتأكد من وجود رقم هاتفه.",
                variant: "destructive",
            });
            return;
        }

        // Auto-sync public record to ensure the link works and has latest data
        try {
            const fullHistory: any = {};
            Object.keys(dailySessions || {}).forEach(date => {
                const sessions = dailySessions[date];
                const studentSessions = Object.values(sessions).filter(s =>
                    s.records?.some(r => r.studentId === selectedStudentId)
                );
                if (studentSessions.length > 0) {
                    fullHistory[date] = {
                        records: studentSessions.flatMap(s => (s.records || []).filter(r => r.studentId === selectedStudentId)),
                        isHoliday: studentSessions.some(s => s.isHoliday),
                        isSheikhAbsentNoSub: studentSessions.some(s => s.isSheikhAbsentNoSub),
                        isSheikhAbsentWithSub: studentSessions.some(s => s.isSheikhAbsentWithSub),
                    };
                }
            });

            const snapshot = {
                student: {
                    ...selectedStudent,
                    sheikhName: user?.displayName || 'غير محدد',
                },
                studentData: fullHistory,
                generatedAt: new Date().toISOString()
            };
            await shareStudentRecord(selectedStudent.id, snapshot);
        } catch (e) {
            console.error("Failed to sync record before sending", e);
        }

        let phone = selectedStudent.phone1.replace(/\D/g, '');
        // Default to Algeria if starts with 0
        if (phone.startsWith('0')) {
            phone = '213' + phone.substring(1);
        }
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageContent)}`;
        window.open(url, '_blank');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(messageContent);
        toast({ title: "تم النسخ", description: "تم نسخ محتوى الرسالة إلى الحافظة" });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-primary animate-pulse">جاري تحضير قناة التواصل...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20" dir="rtl">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-5">
                    <div className="bg-primary/10 p-4 rounded-[1.5rem] shrink-0">
                        <MessageSquare className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-1">قناة التواصل مع ولي الأمر</h1>
                        <p className="text-slate-500 text-sm">تواصل ذكي وسريع مع أولياء الأمور عبر واتساب.</p>
                    </div>
                </div>
                <Button variant="outline" className="rounded-2xl gap-2 h-12 px-6 font-bold border-slate-200" onClick={() => router.push('/reports/student')}>
                    <ArrowRight className="h-4 w-4" />
                    العودة للتقارير
                </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Right: Controls */}
                <div className="xl:col-span-5 space-y-6">
                    <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 p-6">
                            <CardTitle className="text-lg font-black flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" /> إعدادات الإرسال
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 mr-2">اختر الطالب</label>
                                <SearchableSelect
                                    options={studentOptions}
                                    value={selectedStudentId}
                                    onValueChange={setSelectedStudentId}
                                    placeholder="ابحث عن طالب..."
                                    className="rounded-2xl h-11"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-400 mr-2">نوع الرسالة / القالب</label>
                                <Select value={template} onValueChange={(v: any) => setTemplate(v)}>
                                    <SelectTrigger className="rounded-2xl h-11 bg-slate-50 dark:bg-slate-800/50 border-none font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl font-bold">
                                        <SelectItem value="weekly_summary" className="rounded-xl">📝 التلخيص الأسبوعي الذكي</SelectItem>
                                        <SelectItem value="absence_warning" className="rounded-xl">⚠️ تنبيه غياب</SelectItem>
                                        <SelectItem value="memorization_alert" className="rounded-xl">📖 ملاحظة حول الحفظ</SelectItem>
                                        <SelectItem value="behavior_note" className="rounded-xl">🚫 ملاحظة سلوكية</SelectItem>
                                        <SelectItem value="encouragement" className="rounded-xl">🎉 تشجيع وتقدير</SelectItem>
                                        <SelectItem value="meeting_invite" className="rounded-xl">🤝 طلب مقابلة</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {template === 'weekly_summary' && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                    <h4 className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-wider">تحديد الفترة الزمنية</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                            <SelectTrigger className="rounded-xl h-10 bg-white dark:bg-slate-900 border-none font-bold text-xs">
                                                <SelectValue placeholder="الشهر" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl font-bold">
                                                {Array.from({ length: 12 }).map((_, i) => (
                                                    <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM', { locale: ar })}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                            <SelectTrigger className="rounded-xl h-10 bg-white dark:bg-slate-900 border-none font-bold text-xs">
                                                <SelectValue placeholder="السنة" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl font-bold">
                                                {[2024, 2025, 2026].map(y => (
                                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 mr-2">اختر الأسبوع (السبت - الجمعة)</label>
                                        <Select value={selectedWeekIndex.toString()} onValueChange={(v) => setSelectedWeekIndex(parseInt(v))}>
                                            <SelectTrigger className="rounded-xl h-10 bg-white dark:bg-slate-900 border-none font-bold text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl font-bold">
                                                {weeksInMonth.map((w, i) => (
                                                    <SelectItem key={i} value={i.toString()}>
                                                        الأسبوع {i + 1} ({format(w.sat, 'dd MMM')} - {format(w.fri, 'dd MMM')})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {selectedStudent && (
                                <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10 space-y-3">
                                    <div className="flex justify-between items-center text-xs font-black text-primary border-b border-primary/10 pb-2">
                                        <span>معلومات التواصل</span>
                                        <Badge variant="secondary" className="bg-white border-primary/20">{selectedStudent.phone1}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold">ولي الأمر</p>
                                            <p className="text-sm font-black">{selectedStudent.guardianName || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold">الحلقة</p>
                                            <p className="text-sm font-black">{selectedStudent.groupName || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {template === 'weekly_summary' && weekStats && (
                        <Card className="rounded-[2.5rem] border-none shadow-xl bg-slate-900 text-white overflow-hidden p-6 space-y-5 animate-in slide-in-from-bottom-4">
                            <div className="flex flex-col border-b border-white/10 pb-3 gap-1">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    <h3 className="font-black text-sm uppercase tracking-widest">إحصائيات الأسبوع المختارة</h3>
                                </div>
                                <p className="text-[10px] text-white/40 font-bold mr-6">
                                    من {format(weekStats.sat, 'EEEE dd MMMM', { locale: ar })} إلى {format(weekStats.fri, 'EEEE dd MMMM', { locale: ar })}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-white/50 mb-1">الحضور</p>
                                    <p className="text-lg font-black text-emerald-400">{weekStats.present} حصص</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-white/50 mb-1">الغياب</p>
                                    <p className="text-lg font-black text-rose-400">{weekStats.absent} أيام</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-white/50 mb-1">أيام الحفظ</p>
                                    <p className="text-lg font-black text-blue-400">{weekStats.memorizationDays} أيام</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-white/50 mb-1">التقييم</p>
                                    <p className="text-xs font-black text-primary">{weekStats.generalEval}</p>
                                </div>
                            </div>
                            <p className="text-[9px] text-white/30 text-center font-bold">يتم جلب البيانات تلقائياً من سجلات الحصص اليومية.</p>
                        </Card>
                    )}
                </div>

                {/* Left: Editor */}
                <div className="xl:col-span-7 flex flex-col h-full">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col flex-grow">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 p-6 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <Smartphone className="h-5 w-5 text-primary" /> معاينة الرسالة
                                </CardTitle>
                                <CardDescription className="text-xs">راجع النص وقم بالتعديل اللازم قبل الإرسال.</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={handleCopy} title="نسخ">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 flex-grow relative">
                            <Textarea
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                className="w-full h-full min-h-[350px] border-none rounded-none p-8 text-lg font-medium leading-relaxed bg-transparent focus-visible:ring-0 resize-none"
                                placeholder="اختر طالباً وقالب رسالة..."
                                disabled={!selectedStudent}
                            />
                            {!selectedStudent && (
                                <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/40 flex items-center justify-center backdrop-blur-[2px]">
                                    <p className="font-bold text-slate-400">يرجى اختيار طالب أولاً لإعداد الرسالة</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t">
                            <Button
                                onClick={handleSendWhatsApp}
                                className="w-full h-14 rounded-2xl text-lg font-black gap-3 shadow-xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 transition-all text-white"
                                disabled={!selectedStudent}
                            >
                                <Send className="h-5 w-5" /> إرسال عبر واتساب ولي الأمر
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
