"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    ArrowRight,
    CheckCircle,
    RefreshCw,
    Search,
    MessageCircle,
    AlertTriangle,
    Eye,
    Info
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO, startOfWeek, addDays, startOfMonth, endOfMonth, parse } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { cn, arabicCompare, formatGroupName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { surahs } from '@/lib/surahs';
import { Student } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type MessageTemplate = "weekly_summary" | "absence_warning" | "memorization_alert" | "behavior_note" | "encouragement" | "meeting_invite";

const pad = (num: number) => num < 10 ? `0${num}` : num.toString();

// Convert a Gregorian Date to a Hijri date string
const toHijri = (date: Date): string => {
    try {
        const hijriDate = new Date(date);
        const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
        const parts = fmt.formatToParts(hijriDate);
        const day = parts.find(p => p.type === 'day')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';
        const toWestern = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        return `${toWestern(day)} ${month} ${toWestern(year)}`;
    } catch {
        return '';
    }
};

export default function ParentCommunicationPage() {
    const { students, allUsers, dailySessions, loading, shareStudentRecord } = useStudentContext();
    const { user, isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    // Tabs state
    const [activeTab, setActiveTab] = useState<'bulk' | 'individual'>('bulk');
    
    // Bulk state
    const [bulkType, setBulkType] = useState<'daily' | 'weekly'>('daily');
    const [selectedDailyDate, setSelectedDailyDate] = useState<string>('');
    const [bulkSearchTerm, setBulkSearchTerm] = useState('');
    const [checkedStudents, setCheckedStudents] = useState<Record<string, boolean>>({});
    const [sentList, setSentList] = useState<Record<string, 'not_sent' | 'sent'>>({});
    
    // Preview Modal state
    const [previewMessage, setPreviewMessage] = useState('');
    const [previewStudentName, setPreviewStudentName] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Individual Mode states
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [template, setTemplate] = useState<MessageTemplate>('weekly_summary');
    const [messageContent, setMessageContent] = useState('');

    // Time Filtering States for Weekly Summaries
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

    // Filter active students sorted alphabetically
    const activeStudents = useMemo(() =>
        (students ?? [])
            .filter(s => s.status === 'نشط')
            .sort((a, b) => arabicCompare(a.fullName, b.fullName)),
        [students]);

    // Filter students belonging to the current Sheikh if role is sheikh
    const filteredStudents = useMemo(() => {
        if (!user) return [];
        if (user.role === 'sheikh') {
            return activeStudents.filter(s => s.ownerId === user.uid);
        }
        return activeStudents;
    }, [activeStudents, user]);

    // Student options for dropdown (individual tab)
    const studentOptions: SearchableSelectOption[] = useMemo(() =>
        filteredStudents.map(s => ({ value: s.id, label: s.fullName })),
        [filteredStudents]);

    const selectedStudent = useMemo(() =>
        filteredStudents.find(s => s.id === selectedStudentId),
        [filteredStudents, selectedStudentId]);

    // Generate list of unique dates with daily sessions (sorted descending)
    const sessionDates = useMemo(() => {
        if (!dailySessions) return [];
        return Object.keys(dailySessions).sort((a, b) => b.localeCompare(a));
    }, [dailySessions]);

    // Default daily date configuration
    useEffect(() => {
        if (sessionDates.length > 0 && !selectedDailyDate) {
            setSelectedDailyDate(sessionDates[0]);
        }
    }, [sessionDates, selectedDailyDate]);

    // Handle URL Query parameters for automatic routing from session registry
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const qMode = params.get('mode');
            const qType = params.get('type');
            const qDate = params.get('date');

            if (qMode === 'bulk') {
                setActiveTab('bulk');
            }
            if (qType === 'daily') {
                setBulkType('daily');
            } else if (qType === 'weekly') {
                setBulkType('weekly');
            }
            if (qDate) {
                setSelectedDailyDate(qDate);
            }
        }
    }, []);

    // Generate List of Weeks for the selected month/year (weekly tab)
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

    // Check all students by default when loading/changing mode
    useEffect(() => {
        const initialChecked: Record<string, boolean> = {};
        filteredStudents.forEach(s => {
            initialChecked[s.id] = true;
        });
        setCheckedStudents(initialChecked);
        setSentList({}); // Reset sent list on filter changes
    }, [bulkType, selectedDailyDate, selectedWeekIndex, filteredStudents.length]);

    // Compute weekly stats for a single student
    const getWeeklyStatsForStudent = (studentId: string, weekIndex: number) => {
        if (!weeksInMonth[weekIndex]) return null;

        const { sat } = weeksInMonth[weekIndex];
        const startDate = startOfDay(sat);
        const endDate = endOfDay(addDays(sat, 6)); // Full week Sat-Fri

        const sessionsInRange = Object.values(dailySessions ?? {}).flatMap(day => Object.values(day)).filter((session: any) => {
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

        sessionsInRange.forEach((session: any) => {
            const record = (session.records ?? []).find((r: any) => r.studentId === studentId);
            if (record) {
                stats.totalSessions++;
                if (record.attendance === 'حاضر') stats.present++;
                if (record.attendance === 'غائب' || record.attendance === 'غياب') stats.absent++;
                if (record.attendance === 'متأخر') stats.late++;

                if (record.memorization && record.memorization !== 'لم يحفظ' && record.memorization !== 'لا يوجد') {
                    stats.memorizationDays++;
                    const scores: any = {
                        'ممتاز': 10,
                        'جيد جداً': 7,
                        'جيد جدا': 7,
                        'جيد': 5,
                        'حسن': 3,
                        'مقبول': 2,
                        'متوسط': 2,
                        'ضعيف': 1,
                        'لم يحفظ': 0,
                    };
                    if (scores[record.memorization] !== undefined) {
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
            fri: weeksInMonth[weekIndex].fri,
            ...stats,
            generalEval
        };
    };

    // Calculate Week Range for selected student in individual mode
    const weekStats = useMemo(() => {
        if (!selectedStudentId) return null;
        return getWeeklyStatsForStudent(selectedStudentId, selectedWeekIndex);
    }, [selectedStudentId, dailySessions, weeksInMonth, selectedWeekIndex]);

    // Get Daily Records for a single student on a selected date
    const getDailyRecordsForStudent = (studentId: string, dateStr: string) => {
        if (!dailySessions || !dailySessions[dateStr]) return [];
        const sessions = Object.values(dailySessions[dateStr]);
        const records: any[] = [];
        sessions.forEach((s: any) => {
            if (s.records) {
                const r = s.records.find((rec: any) => rec.studentId === studentId);
                if (r) {
                    records.push({
                        ...r,
                        sessionType: s.sessionType,
                        sessionNumber: s.sessionNumber
                    });
                }
            }
        });
        return records;
    };

    // Generate Arabic message for daily report of a student
    const generateDailyMessageForStudent = (student: Student, dateStr: string, records: any[]) => {
        const sName = student.fullName;
        const gName = student.guardianName || "ولي الأمر";
        const teacherName = user?.displayName || "الشيخ";
        const parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
        const dayName = format(parsedDate, 'EEEE', { locale: ar });
        const dateFormatted = format(parsedDate, 'dd-MM-yyyy');

        let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
        msg += `السيد ${gName} المحترم،\n\n`;
        msg += `نحيطكم علماً بتقرير أداء ابنكم/ابنتكم (${sName}) لحلقة حفظ القرآن الكريم ليوم ${dayName} ${dateFormatted}:\n`;

        if (records.length === 0) {
            msg += `⚠️ لم يتم تسجيل حضور أو تقييم للطالب في هذه الحصة.\n\n`;
        } else {
            records.forEach((rec, index) => {
                const label = records.length > 1 ? `الحصة ${rec.sessionNumber}: ` : '';
                msg += `📍 ${label}الحضور: *${rec.attendance}*\n`;
                if (rec.attendance === 'حاضر' || rec.attendance === 'متأخر') {
                    if (rec.memorization && rec.memorization !== 'لا يوجد') {
                        msg += `📍 التقييم اليومي: *${rec.memorization}*\n`;
                    }
                    if (rec.surahId) {
                        const surahName = surahs.find(s => s.id === rec.surahId)?.name || '';
                        msg += `📍 الورد: سورة *${surahName}* من آية *${rec.fromVerse}* إلى *${rec.toVerse}*\n`;
                    } else if (rec.tasmieSurahId) {
                        const surahName = surahs.find(s => s.id === rec.tasmieSurahId)?.name || '';
                        msg += `📍 ورد التسميع: سورة *${surahName}* من آية *${rec.tasmieFromVerse}* إلى *${rec.tasmieToVerse}*\n`;
                    }
                    if (rec.behavior) {
                        msg += `📍 السلوك: *${rec.behavior}*\n`;
                    }
                }
                if (rec.notes) {
                    msg += `📍 ملاحظات الشيخ: ${rec.notes}\n`;
                }
                msg += `\n`;
            });
        }

        const recordLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/record?id=${student.id}`;
        msg += `🔗 لمراجعة السجل الكامل للطالب: \n${recordLink}\n\n`;
        msg += `نسأل الله له التوفيق والثبات.\n`;
        msg += `تحياتنا،\n${teacherName}`;
        return msg;
    };

    // Generate Arabic message for weekly report of a student
    const generateWeeklyMessageForStudent = (student: Student, stats: any) => {
        const sName = student.fullName;
        const gName = student.guardianName || "ولي الأمر";
        const teacherName = user?.displayName || "الشيخ";
        const recordLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/record?id=${student.id}`;

        let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
        msg += `السيد ${gName} المحترم،\n\n`;

        if (stats) {
            msg += `نحيطكم علماً بملخص أداء ابنكم/ابنتكم (${sName}) للأسبوع (من ${format(stats.sat, 'dd MMM')} إلى ${format(stats.fri, 'dd MMM')}):\n`;
            msg += `📍 الحضور: حضر ${stats.present} حصص، وتغيب ${stats.absent} (المتأخر: ${stats.late}).\n`;
            msg += `📍 الحفظ: قام بالتسميع في ${stats.memorizationDays} أيام خلال الأسبوع.\n`;
            msg += `📍 التقييم العام لهذا الأسبوع: *${stats.generalEval}*.\n\n`;
        } else {
            msg += `نحيطكم علماً بملخص أداء ابنكم/ابنتكم (${sName}) لهذا الأسبوع.\n\n`;
        }

        msg += `🔗 لمراجعة السجل الكامل للطالب ورؤية تفاصيل الأداء: \n${recordLink}\n\n`;
        msg += `نسأل الله له التوفيق والثبات.\n`;
        msg += `تحياتنا،\n${teacherName}`;
        return msg;
    };

    // Individual page template engine
    useEffect(() => {
        if (!selectedStudent) {
            setMessageContent('');
            return;
        }

        const sName = selectedStudent.fullName;
        const gName = selectedStudent.guardianName || "ولي الأمر";
        const teacher = user?.displayName || "الشيخ";
        const recordLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/record?id=${selectedStudent.id}`;

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

    // Send individual message
    const handleSendIndividualWhatsApp = async () => {
        if (!messageContent || !selectedStudent?.phone1) {
            toast({
                title: "بيانات ناقصة",
                description: "يرجى اختيار طالب والتأكد من وجود رقم هاتفه.",
                variant: "destructive",
            });
            return;
        }

        await syncStudentSnapshot(selectedStudent);

        let phone = selectedStudent.phone1.replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = '213' + phone.substring(1);
        }
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageContent)}`;
        window.open(url, '_blank');
    };

    // Helper to upload record snapshot for parent public view
    const syncStudentSnapshot = async (student: Student) => {
        try {
            const studentId = student.id;
            const fullHistory: any = {};
            Object.keys(dailySessions || {}).forEach(date => {
                const sessions = dailySessions[date];
                const studentSessions = Object.values(sessions).filter((s: any) =>
                    s.records?.some((r: any) => r.studentId === studentId)
                );
                if (studentSessions.length > 0) {
                    fullHistory[date] = {
                        records: studentSessions.flatMap((s: any) => (s.records || []).filter((r: any) => r.studentId === studentId)),
                        isHoliday: studentSessions.some((s: any) => s.isHoliday),
                        isSheikhAbsentNoSub: studentSessions.some((s: any) => s.isSheikhAbsentNoSub),
                        isSheikhAbsentWithSub: studentSessions.some((s: any) => s.isSheikhAbsentWithSub),
                    };
                }
            });

            const sheikh = allUsers.find(u => u.uid === student.ownerId);
            const resolvedSheikhName = sheikh?.displayName || student.sheikhName || 'غير محدد';

            const snapshot = {
                student: {
                    ...student,
                    sheikhName: resolvedSheikhName,
                },
                studentData: fullHistory,
                generatedAt: new Date().toISOString()
            };
            await shareStudentRecord(student.id, snapshot);
        } catch (e) {
            console.error("Failed to sync record snapshot before sending:", e);
        }
    };

    // Bulk action router (whatsapp, sms, copy)
    const handleBulkSendAction = async (student: Student, actionType: 'whatsapp' | 'sms' | 'copy') => {
        // Construct message content dynamically
        let msg = '';
        if (bulkType === 'daily') {
            const records = getDailyRecordsForStudent(student.id, selectedDailyDate);
            msg = generateDailyMessageForStudent(student, selectedDailyDate, records);
        } else {
            const stats = getWeeklyStatsForStudent(student.id, selectedWeekIndex);
            msg = generateWeeklyMessageForStudent(student, stats);
        }

        // Set status
        setSentList(prev => ({ ...prev, [student.id]: 'sent' }));

        // Async share snapshot
        syncStudentSnapshot(student).catch(err => console.error("Async share snapshot failed", err));

        const phoneClean = student.phone1.replace(/\D/g, '');
        const formattedPhone = phoneClean.startsWith('0') ? '213' + phoneClean.substring(1) : phoneClean;

        if (actionType === 'whatsapp') {
            const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        } else if (actionType === 'sms') {
            const url = `sms:${formattedPhone}?body=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        } else {
            navigator.clipboard.writeText(msg);
            toast({
                title: "تم نسخ الرسالة",
                description: `تم نسخ تقرير الطالب ${student.fullName} بنجاح.`,
            });
        }
    };

    // Handle Bulk checkbox states
    const handleCheckAll = (checked: boolean) => {
        const nextChecked: Record<string, boolean> = {};
        if (checked) {
            bulkFilteredStudents.forEach(s => {
                nextChecked[s.id] = true;
            });
        }
        setCheckedStudents(nextChecked);
    };

    const handleCheckStudent = (studentId: string, checked: boolean) => {
        setCheckedStudents(prev => ({
            ...prev,
            [studentId]: checked
        }));
    };

    // Show Preview Modal
    const handleTriggerPreview = (student: Student) => {
        let msg = '';
        if (bulkType === 'daily') {
            const records = getDailyRecordsForStudent(student.id, selectedDailyDate);
            msg = generateDailyMessageForStudent(student, selectedDailyDate, records);
        } else {
            const stats = getWeeklyStatsForStudent(student.id, selectedWeekIndex);
            msg = generateWeeklyMessageForStudent(student, stats);
        }
        setPreviewStudentName(student.fullName);
        setPreviewMessage(msg);
        setIsPreviewOpen(true);
    };

    const handleCopyIndividual = () => {
        navigator.clipboard.writeText(messageContent);
        toast({ title: "تم النسخ", description: "تم نسخ محتوى الرسالة إلى الحافظة" });
    };

    // Filter students for bulk listing based on search term
    const bulkFilteredStudents = useMemo(() => {
        return filteredStudents.filter(s =>
            s.fullName.toLowerCase().includes(bulkSearchTerm.toLowerCase()) ||
            (s.guardianName && s.guardianName.toLowerCase().includes(bulkSearchTerm.toLowerCase()))
        );
    }, [filteredStudents, bulkSearchTerm]);

    const allChecked = bulkFilteredStudents.length > 0 && bulkFilteredStudents.every(s => checkedStudents[s.id]);
    const someChecked = bulkFilteredStudents.length > 0 && bulkFilteredStudents.some(s => checkedStudents[s.id]) && !allChecked;

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-primary animate-pulse font-headline">جاري تحضير لوحة الاتصال...</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20" dir="rtl">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-5">
                    <div className="bg-emerald-500/10 p-4 rounded-[1.5rem] shrink-0 text-emerald-600 dark:text-emerald-400">
                        <MessageSquare className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-1 font-headline">قناة التواصل المطورّة مع ولي الأمر</h1>
                        <p className="text-slate-500 text-sm font-body">إرسال تقارير الحصص اليومية والحصائل الأسبوعية بنقرة واحدة عبر الواتساب أو الرسائل القصيرة.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="rounded-2xl gap-2 h-12 px-6 font-bold border-slate-200" onClick={() => router.push('/sessions')}>
                        <Calendar className="h-4 w-4" />
                        سجل الحصص
                    </Button>
                    <Button variant="outline" className="rounded-2xl gap-2 h-12 px-6 font-bold border-slate-200" onClick={() => router.push('/reports/student')}>
                        <ArrowRight className="h-4 w-4" />
                        العودة للتقارير
                    </Button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-[1.8rem] w-fit border border-slate-200/40">
                <button
                    onClick={() => setActiveTab('bulk')}
                    className={cn(
                        "h-12 px-8 text-sm font-bold rounded-2xl transition-all font-headline",
                        activeTab === 'bulk'
                            ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-md"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                >
                    <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        لوحة الإرسال الجماعي المنظم
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('individual')}
                    className={cn(
                        "h-12 px-8 text-sm font-bold rounded-2xl transition-all font-headline",
                        activeTab === 'individual'
                            ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-md"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                >
                    <span className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4" />
                        مراسلة فردية مخصصة
                    </span>
                </button>
            </div>

            {/* Render Tab Contents */}
            {activeTab === 'bulk' ? (
                <div className="space-y-6">
                    {/* Bulk Settings Panel */}
                    <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-headline font-bold text-slate-800 dark:text-white">تصفية وإعداد تقارير أولياء الأمور</CardTitle>
                                <CardDescription className="font-body text-xs mt-1">اختر نوع التقرير وتاريخ الحصة للحصول على الرسائل الجاهزة مباشرة.</CardDescription>
                            </div>
                            
                            {/* Toggle Daily/Weekly */}
                            <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl w-fit">
                                <button
                                    onClick={() => setBulkType('daily')}
                                    className={cn(
                                        "h-9 px-4 text-xs font-bold rounded-lg transition-all",
                                        bulkType === 'daily' ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                    )}
                                >
                                    حصة يومية
                                </button>
                                <button
                                    onClick={() => setBulkType('weekly')}
                                    className={cn(
                                        "h-9 px-4 text-xs font-bold rounded-lg transition-all",
                                        bulkType === 'weekly' ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                    )}
                                >
                                    حصيلة أسبوعية
                                </button>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-end gap-6">
                                {/* Conditional Selection UI */}
                                {bulkType === 'daily' ? (
                                    <div className="space-y-2 flex-1">
                                        <Label className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5" />
                                            اختر تاريخ الحصة اليومية
                                        </Label>
                                        <Select value={selectedDailyDate} onValueChange={setSelectedDailyDate}>
                                            <SelectTrigger className="rounded-xl h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm">
                                                <SelectValue placeholder="اختر التاريخ..." />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[220px]">
                                                {sessionDates.map(dateStr => {
                                                    const dateParsed = parse(dateStr, 'yyyy-MM-dd', new Date());
                                                    const formatted = format(dateParsed, 'EEEE d MMMM yyyy', { locale: ar });
                                                    return (
                                                        <SelectItem key={dateStr} value={dateStr} className="text-right">
                                                            {formatted}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-400 mr-1">الشهر</Label>
                                            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                                <SelectTrigger className="rounded-xl h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm">
                                                    <SelectValue placeholder="الشهر" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 12 }).map((_, i) => (
                                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM', { locale: ar })}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-400 mr-1">السنة</Label>
                                            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                                <SelectTrigger className="rounded-xl h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm">
                                                    <SelectValue placeholder="السنة" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[2024, 2025, 2026].map(y => (
                                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-400 mr-1">اختر الأسبوع</Label>
                                            <Select value={selectedWeekIndex.toString()} onValueChange={(v) => setSelectedWeekIndex(parseInt(v))}>
                                                <SelectTrigger className="rounded-xl h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
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

                                {/* Search Bar */}
                                <div className="space-y-2 w-full md:w-[260px]">
                                    <Label className="text-xs font-bold text-slate-400 mr-1">البحث عن طالب</Label>
                                    <div className="relative">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={bulkSearchTerm}
                                            onChange={(e) => setBulkSearchTerm(e.target.value)}
                                            placeholder="ابحث بالاسم..."
                                            className="w-full h-11 pr-10 pl-4 rounded-xl border-none bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-body text-slate-800 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Info Warning Alert */}
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-2xl flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-800 dark:text-blue-300 font-body leading-relaxed">
                            <span className="font-bold block mb-1">تعليمات إرسال الرسائل:</span>
                            يرجى الضغط على زر الإرسال بجانب كل ولي أمر بشكل متتالٍ. سيقوم النظام بفتح محادثة واتساب الرسمية مع الرسالة المخصصة لكل ولي مباشرةً. هذا الأسلوب الفردي السريع يحمي حسابك من الحظر من قبل واتساب.
                        </div>
                    </div>

                    {/* Bulk Student List Card */}
                    <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 p-6 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <CardTitle className="text-lg font-headline font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Users className="h-5 w-5 text-emerald-600" />
                                    قائمة الطلاب الحالية ({bulkFilteredStudents.length})
                                </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="select-all"
                                    checked={allChecked}
                                    onCheckedChange={(checked) => handleCheckAll(!!checked)}
                                    className="rounded border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                />
                                <Label htmlFor="select-all" className="text-xs font-bold text-slate-500 cursor-pointer">تحديد الكل</Label>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {bulkFilteredStudents.length > 0 ? (
                                    bulkFilteredStudents.map(student => {
                                        const isChecked = !!checkedStudents[student.id];
                                        const isSent = sentList[student.id] === 'sent';
                                        
                                        // Fetch performance preview based on mode
                                        let performanceSummary = '';
                                        let hasData = false;

                                        if (bulkType === 'daily') {
                                            const recs = getDailyRecordsForStudent(student.id, selectedDailyDate);
                                            hasData = recs.length > 0;
                                            if (hasData) {
                                                const primary = recs[0];
                                                performanceSummary = primary.attendance;
                                                if (primary.attendance === 'حاضر' || primary.attendance === 'متأخر') {
                                                    const memorization = primary.memorization || 'لم يقيم';
                                                    let surahName = '';
                                                    if (primary.surahId) {
                                                        surahName = ` (${surahs.find(s => s.id === primary.surahId)?.name || ''})`;
                                                    } else if (primary.tasmieSurahId) {
                                                        surahName = ` (${surahs.find(s => s.id === primary.tasmieSurahId)?.name || ''})`;
                                                    }
                                                    performanceSummary += ` - تقييم: ${memorization}${surahName}`;
                                                }
                                            } else {
                                                performanceSummary = 'لا توجد سجلات حضور مسجلة';
                                            }
                                        } else {
                                            const stats = getWeeklyStatsForStudent(student.id, selectedWeekIndex);
                                            hasData = !!stats && stats.totalSessions > 0;
                                            if (hasData && stats) {
                                                performanceSummary = `حضور: ${stats.present} حصص، غياب: ${stats.absent} | التقييم: ${stats.generalEval}`;
                                            } else {
                                                performanceSummary = 'لا توجد حصص مسجلة هذا الأسبوع';
                                            }
                                        }

                                        return (
                                            <div
                                                key={student.id}
                                                className={cn(
                                                    "p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors",
                                                    isChecked ? "bg-slate-50/40 dark:bg-slate-800/10" : "opacity-80"
                                                )}
                                            >
                                                {/* Left Section: Checkbox & Student details */}
                                                <div className="flex items-center gap-4 flex-1">
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => handleCheckStudent(student.id, !!checked)}
                                                        className="rounded border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                    />
                                                    
                                                    {/* Student Info */}
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-10 h-10 border border-slate-100">
                                                            <AvatarImage src={student.photoURL} />
                                                            <AvatarFallback className="bg-emerald-50 text-emerald-700 text-sm font-bold">
                                                                {student.fullName.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">{student.fullName}</h4>
                                                            <p className="text-[11px] text-slate-400 font-body mt-0.5">الولي: {student.guardianName || '-'} | {student.phone1}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Middle Section: Performance Details & Badges */}
                                                <div className="flex flex-wrap items-center gap-3 flex-1 md:justify-center">
                                                    {/* WhatsApp status Badge */}
                                                    {student.hasWhatsApp !== false ? (
                                                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200/50 dark:border-green-900/40 text-[10px] font-bold">
                                                            <Smartphone className="h-3 w-3 ml-1" />
                                                            واتساب
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 text-[10px] font-bold">
                                                            <Smartphone className="h-3 w-3 ml-1" />
                                                            SMS فقط
                                                        </Badge>
                                                    )}

                                                    {/* Performance Summary Text */}
                                                    <span className={cn(
                                                        "text-xs font-body leading-relaxed",
                                                        hasData ? "text-slate-600 dark:text-slate-300" : "text-amber-600 dark:text-amber-500"
                                                    )}>
                                                        {performanceSummary}
                                                    </span>
                                                </div>

                                                {/* Right Section: Sending State & Buttons */}
                                                <div className="flex items-center gap-2 justify-end min-w-[280px]">
                                                    {/* Copy Status Badge */}
                                                    {isSent ? (
                                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400 hover:bg-green-100 border border-green-200/40 text-[10px] font-bold gap-1 animate-in fade-in zoom-in-95">
                                                            <CheckCircle className="h-3 w-3" />
                                                            تم فتح الرابط
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                                                            لم يرسل بعد
                                                        </Badge>
                                                    )}

                                                    {/* Actions */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                        onClick={() => handleTriggerPreview(student)}
                                                        title="معاينة نص الرسالة"
                                                    >
                                                        <Eye className="h-4 w-4 text-slate-500" />
                                                    </Button>

                                                    {student.hasWhatsApp !== false ? (
                                                        <Button
                                                            size="sm"
                                                            disabled={!isChecked}
                                                            onClick={() => handleBulkSendAction(student, 'whatsapp')}
                                                            className="h-9 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm font-bold"
                                                        >
                                                            <Send className="h-3.5 w-3.5" />
                                                            إرسال واتساب
                                                        </Button>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={!isChecked}
                                                                onClick={() => handleBulkSendAction(student, 'copy')}
                                                                className="h-9 text-xs gap-1 border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 font-bold"
                                                            >
                                                                <Copy className="h-3.5 w-3.5" />
                                                                نسخ
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                disabled={!isChecked}
                                                                onClick={() => handleBulkSendAction(student, 'sms')}
                                                                className="h-9 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                                                            >
                                                                إرسال SMS
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-12 text-center text-slate-400 text-sm font-body">
                                        لم يتم العثور على أي طلاب يطابقون معايير البحث.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                /* Individual Page Mode (original dashboard) */
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Right: Controls */}
                    <div className="xl:col-span-5 space-y-6">
                        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 p-6">
                                <CardTitle className="text-lg font-black flex items-center gap-2 font-headline">
                                    <Users className="h-5 w-5 text-primary" /> إعدادات الإرسال الفردي
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 mr-2 font-headline">اختر الطالب</label>
                                    <SearchableSelect
                                        options={studentOptions}
                                        value={selectedStudentId}
                                        onValueChange={setSelectedStudentId}
                                        placeholder="ابحث عن طالب..."
                                        className="rounded-2xl h-11"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 mr-2 font-headline">نوع الرسالة / القالب</label>
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
                                    <div className="bg-emerald-500/5 p-5 rounded-3xl border border-emerald-500/10 space-y-3">
                                        <div className="flex justify-between items-center text-xs font-black text-emerald-600 border-b border-emerald-500/10 pb-2">
                                            <span>معلومات التواصل</span>
                                            <div className="flex gap-1.5 items-center">
                                                <Badge variant="secondary" className="bg-white border-emerald-500/20">{selectedStudent.phone1}</Badge>
                                                {selectedStudent.hasWhatsApp !== false ? (
                                                    <Badge className="bg-green-100 text-green-800 border-none text-[9px] font-bold">واتساب ✅</Badge>
                                                ) : (
                                                    <Badge className="bg-slate-100 text-slate-500 border-none text-[9px] font-bold">SMS فقط</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold">ولي الأمر</p>
                                                <p className="text-sm font-black">{selectedStudent.guardianName || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold">الحلقة</p>
                                                <p className="text-sm font-black">{formatGroupName(selectedStudent.groupName || '', allUsers) || '-'}</p>
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
                                        <TrendingUp className="h-4 w-4 text-emerald-500" />
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
                                        <p className="text-xs font-black text-emerald-400">{weekStats.generalEval}</p>
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
                                    <CardTitle className="text-lg font-black flex items-center gap-2 font-headline">
                                        <Smartphone className="h-5 w-5 text-emerald-600" /> معاينة الرسالة
                                    </CardTitle>
                                    <CardDescription className="text-xs">راجع النص وقم بالتعديل اللازم قبل الإرسال.</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={handleCopyIndividual} title="نسخ">
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0 flex-grow relative">
                                <Textarea
                                    value={messageContent}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    className="w-full h-full min-h-[350px] border-none rounded-none p-8 text-lg font-medium leading-relaxed bg-transparent focus-visible:ring-0 resize-none font-body"
                                    placeholder="اختر طالباً وقالب رسالة..."
                                    disabled={!selectedStudent}
                                />
                                {!selectedStudent && (
                                    <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/40 flex items-center justify-center backdrop-blur-[2px]">
                                        <p className="font-bold text-slate-400">يرجى اختيار طالب أولاً لإعداد الرسالة</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t flex gap-2">
                                <Button
                                    onClick={handleSendIndividualWhatsApp}
                                    className="flex-1 h-14 rounded-2xl text-lg font-black gap-3 shadow-xl shadow-green-500/20 bg-green-600 hover:bg-green-700 transition-all text-white font-headline"
                                    disabled={!selectedStudent}
                                >
                                    <Send className="h-5 w-5" /> إرسال عبر واتساب ولي الأمر
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="font-headline">معاينة الرسالة للطالب: {previewStudentName}</DialogTitle>
                        <DialogDescription className="font-body text-xs">
                            هذا النص سيتم توجيهه مباشرة إلى ولي الأمر عند ضغط زر الإرسال.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            value={previewMessage}
                            disabled
                            rows={10}
                            className="bg-slate-50 dark:bg-slate-800 border-none font-body text-sm leading-relaxed p-4"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>إغلاق المعاينة</Button>
                        <Button
                            onClick={() => {
                                navigator.clipboard.writeText(previewMessage);
                                toast({ title: "تم النسخ", description: "تم نسخ محتوى الرسالة إلى الحافظة" });
                                setIsPreviewOpen(false);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Copy className="h-4 w-4 ml-1.5" />
                            نسخ نص الرسالة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
