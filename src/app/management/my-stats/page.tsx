"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';
import {
    Activity, Calendar, Award, MessageSquare, Star, Shield, Users,
    ChevronLeft, ChevronRight, FileDown, Printer, AlertTriangle, Target, Info
} from 'lucide-react';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    addMonths, subMonths, addDays, subDays
} from 'date-fns';
import { ar } from 'date-fns/locale';

// Reusable components
import { AttendanceHeatmap } from '@/components/management/AttendanceHeatmap';
import { StudentProgressChart } from '@/components/management/StudentProgressChart';
import { EarlyWarningView, computeAtRiskStudents } from '@/components/management/EarlyWarning';
import { HonorCardGenerator } from '@/components/management/HonorCardGenerator';

// Constants for session type configuration
const TYPE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    'حصة أساسية': { label: 'أساسية', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
    'حصة تعويضية': { label: 'تعويضية', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    'حصة إضافية': { label: 'إضافية', dot: 'bg-indigo-500', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
    'حصة أنشطة': { label: 'أنشطة', dot: 'bg-purple-500', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
    'يوم عطلة': { label: 'عطلة', dot: 'bg-sky-400', bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700' },
    'غياب الشيخ': { label: 'غياب شيخ', dot: 'bg-rose-500', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
};

interface DayStats {
    session: any;
    type: string;
    attendance: number | null;
    excellent: number | null;
}

export default function MyStatsPage() {
    const { dailySessions, allUsers, loading, students } = useStudentContext();
    const { user, role } = useAuth();

    const isSheikh = role === 'sheikh';
    const isManagement = role === 'super_admin' || role === 'management';

    // State
    const [statsMonth, setStatsMonth] = useState(new Date());
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [studentHonorCard, setStudentHonorCard] = useState<any | null>(null);

    // Fetch theme
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    // Load unique sheikh groups for admin selector
    const sheikhsList = useMemo(() => {
        const map = new Map<string, { uid: string; displayName: string; group: string; uids: Set<string> }>();
        allUsers.filter(u => u.role === 'sheikh' && u.group).forEach(u => {
            if (!map.has(u.group!)) {
                map.set(u.group!, { uid: u.uid, displayName: u.displayName || '', group: u.group!, uids: new Set([u.uid]) });
            } else {
                map.get(u.group!)!.uids.add(u.uid);
            }
        });
        return Array.from(map.values()).sort((a, b) => {
            const numA = parseInt(a.group.replace(/\D/g, '') || '0');
            const numB = parseInt(b.group.replace(/\D/g, '') || '0');
            return numA - numB;
        });
    }, [allUsers]);

    // Handle group selection
    useEffect(() => {
        if (isSheikh && user?.group) {
            setSelectedGroup(user.group);
        } else if (isManagement && sheikhsList.length > 0 && !selectedGroup) {
            setSelectedGroup(sheikhsList[0].group);
        }
    }, [isSheikh, user?.group, isManagement, sheikhsList, selectedGroup]);

    const activeSheikh = useMemo(() => {
        if (!selectedGroup) return null;
        return sheikhsList.find(s => s.group === selectedGroup) || null;
    }, [sheikhsList, selectedGroup]);

    // Compute student count in active group
    const activeStudentCount = useMemo(() => {
        if (!selectedGroup || !students) return 0;
        return students.filter(s => s.status === 'نشط' && s.groupName === selectedGroup).length;
    }, [students, selectedGroup]);

    // Index daily sessions for the active group
    const groupSessionsMap = useMemo(() => {
        const map = new Map<string, any[]>();
        if (!dailySessions || !activeSheikh) return map;

        Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
            if (!daySessions) return;
            Object.values(daySessions as Record<string, any>).forEach(session => {
                if (session && activeSheikh.uids.has(session.ownerId)) {
                    const arr = map.get(dateStr) || [];
                    if (!arr.some(s => s.sessionNumber === session.sessionNumber)) {
                        arr.push({ ...session, dateStr });
                        map.set(dateStr, arr);
                    }
                }
            });
        });
        return map;
    }, [dailySessions, activeSheikh]);

    // Helper: calculate day statistics for the group
    const getDayStats = useCallback((group: string, dateStr: string): DayStats | null => {
        const sessions = groupSessionsMap.get(dateStr) || [];
        const session = sessions.find(s => s.sessionNumber === 1) || sessions[0] || null;
        if (!session) return null;

        const records: any[] = Array.isArray(session.records)
            ? session.records
            : session.records ? Object.values(session.records) : [];

        if (!records.length || activeStudentCount === 0) {
            return { session, type: session.sessionType, attendance: null, excellent: null };
        }

        let present = 0, excellent = 0;
        records.forEach(r => {
            if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') present++;
            if (!r.review && (r.memorization === 'ممتاز')) excellent++;
        });

        const p = (n: number) => activeStudentCount > 0 ? Math.round((n / activeStudentCount) * 100) : 0;
        return {
            session,
            type: session.sessionType,
            attendance: p(present),
            excellent: p(excellent)
        };
    }, [groupSessionsMap, activeStudentCount]);

    // Compute month analytics
    const myStats = useMemo(() => {
        if (!selectedGroup || !activeSheikh) return null;

        const start = startOfMonth(statsMonth);
        const end = endOfMonth(statsMonth);
        const allDays = eachDayOfInterval({ start, end });

        let sessionDays = 0, absences = 0, holidays = 0;
        const attVals: number[] = [];
        const excVals: number[] = [];

        allDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayRes = getDayStats(selectedGroup, dateStr);
            if (!dayRes) return;
            if (dayRes.type === 'يوم عطلة') { holidays++; return; }
            if (dayRes.type === 'غياب الشيخ') { absences++; return; }
            if (dayRes.type === 'حصة أساسية' || dayRes.type === 'حصة تعويضية' || dayRes.type === 'حصة إضافية') {
                sessionDays++;
                if (dayRes.attendance !== null) attVals.push(dayRes.attendance);
                if (dayRes.excellent !== null) excVals.push(dayRes.excellent);
            }
        });

        const workingDays = allDays.length - holidays - absences;
        const commitmentRate = workingDays > 0 ? Math.round((sessionDays / workingDays) * 100) : 0;

        // Weekly breakdown
        const firstSat = addDays(start, -6);
        const lastSat = addDays(end, -6);
        const Saturdays = eachDayOfInterval({ start: firstSat, end: lastSat }).filter(d => getDay(d) === 6);

        const weeklyBreakdown = Saturdays.map((sat, i) => {
            const fri = addDays(sat, 6);
            const wDays = eachDayOfInterval({ start: sat, end: fri });
            let wSessions = 0;
            const wAtt: number[] = [];
            const wExc: number[] = [];

            wDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayRes = getDayStats(selectedGroup, dateStr);
                if (!dayRes || dayRes.type === 'يوم عطلة' || dayRes.type === 'غياب الشيخ') return;
                if (dayRes.type === 'حصة أساسية' || dayRes.type === 'حصة تعويضية' || dayRes.type === 'حصة إضافية') {
                    wSessions++;
                    if (dayRes.attendance !== null) wAtt.push(dayRes.attendance);
                    if (dayRes.excellent !== null) wExc.push(dayRes.excellent);
                }
            });

            return {
                label: `الأسبوع ${i + 1}`,
                dateRange: `${format(sat, 'd MMM', { locale: ar })} — ${format(fri, 'd MMM yyyy', { locale: ar })}`,
                sessions: wSessions,
                attendance: wAtt.length ? Math.round(wAtt.reduce((a, b) => a + b, 0) / wAtt.length) : null,
                excellent: wExc.length ? Math.round(wExc.reduce((a, b) => a + b, 0) / wExc.length) : null,
            };
        });

        const avgAtt = attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : 0;
        const avgExc = excVals.length ? Math.round(excVals.reduce((a, b) => a + b, 0) / excVals.length) : 0;

        return {
            commitmentRate,
            sessionDays,
            absences,
            holidays,
            avgAttendance: avgAtt,
            avgExcellent: avgExc,
            weeklyBreakdown
        };
    }, [selectedGroup, activeSheikh, statsMonth, getDayStats]);

    // Early warning students for this group
    const atRiskStudents = useMemo(() => {
        if (!students || !dailySessions || !activeSheikh) return [];
        const computed = computeAtRiskStudents(students, dailySessions, [activeSheikh], endOfMonth(statsMonth));
        return computed.filter(s => s.group === selectedGroup);
    }, [students, dailySessions, activeSheikh, selectedGroup, statsMonth]);

    // Compute student stats for card generation
    const studentStatsList = useMemo(() => {
        if (!selectedGroup || !students) return [];
        const groupStudents = students.filter(s => s.status === 'نشط' && s.groupName === selectedGroup);
        const start = startOfMonth(statsMonth);
        const end = endOfMonth(statsMonth);
        const allDays = eachDayOfInterval({ start, end });

        return groupStudents.map(student => {
            let totalSessions = 0;
            let attendedSessions = 0;
            let excellentCount = 0;

            allDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const sessions = groupSessionsMap.get(dateStr) || [];
                const session = sessions[0] || null;
                if (!session) return;
                const sType = session.sessionType;
                if (sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية') {
                    totalSessions++;
                    const records: any[] = Array.isArray(session.records) ? session.records : session.records ? Object.values(session.records) : [];
                    const rec = records.find((r: any) => r.studentId === student.id);
                    if (rec) {
                        const isPresent = rec.attendance === 'حاضر' || rec.attendance === 'متأخر' || rec.attendance === 'تعويض';
                        if (isPresent) {
                            attendedSessions++;
                            if (!rec.review && rec.memorization === 'ممتاز') {
                                excellentCount++;
                            }
                        }
                    }
                }
            });

            const attendanceRate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 100;

            return {
                id: student.id,
                name: student.fullName,
                attendanceRate,
                excellentCount,
                totalSessions
            };
        });
    }, [selectedGroup, students, statsMonth, groupSessionsMap]);

    const handleOpenHonorCard = (st: any) => {
        setStudentHonorCard({
            type: 'student_excellence',
            name: st.name,
            group: selectedGroup,
            subtitle: '⭐ نجم التميز والتفوق',
            month: format(statsMonth, 'MMMM yyyy', { locale: ar }),
            schoolName: 'المدرسة القرآنية للإمام الشافعي',
            stats: [
                { label: 'نسبة الحضور', value: `${st.attendanceRate}%` },
                { label: 'حفظ ممتاز', value: `${st.excellentCount} حصص` },
                { label: 'إجمالي الحصص', value: `${st.totalSessions} حصة` }
            ]
        });
    };

    // Export personal PDF report
    const handleExportPDF = () => {
        if (!myStats || !activeSheikh) return;
        const monthLabel = format(statsMonth, 'MMMM yyyy', { locale: ar });

        const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8"/>
    <title>تقرير أداء الحلقة - ${selectedGroup}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; background: #ffffff; color: #1e293b; padding: 20px; font-size: 11px; }
        h1, h2 { font-weight: 700; color: #0f172a; margin-bottom: 5px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 25px; }
        .header-left { text-align: left; }
        .kpi-container { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; background: #f8fafc; }
        .kpi-value { font-size: 20px; font-weight: 900; color: #1e3a5f; margin-top: 5px; }
        .kpi-label { font-size: 9px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: center; }
        th { background: #1e3a5f; color: #ffffff; font-size: 10px; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>مدرسة الإمام الشافعي لتعليم القرآن الكريم</h1>
            <h2>تقرير أداء الفوج: ${selectedGroup} — ${activeSheikh.displayName}</h2>
            <p>شهر التقرير: ${monthLabel}</p>
        </div>
        <div class="header-left">
            <p>تاريخ الاستخراج: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            <p>عدد طلاب الفوج: ${activeStudentCount} طالب نشط</p>
        </div>
    </div>

    <div class="kpi-container">
        <div class="kpi-card">
            <div class="kpi-label">معدل التزام الشيخ بالحصص</div>
            <div class="kpi-value">${myStats.commitmentRate}%</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">معدل حضور الطلاب المتوسط</div>
            <div class="kpi-value">${myStats.avgAttendance}%</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">نسبة الحفظ المتميز (ممتاز)</div>
            <div class="kpi-value">${myStats.avgExcellent}%</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">عدد الحصص المنعقدة</div>
            <div class="kpi-value">${myStats.sessionDays} حصة</div>
        </div>
    </div>

    <h2>ملخص أسابيع الشهر التعليمية</h2>
    <table>
        <thead>
            <tr>
                <th>الأسبوع</th>
                <th>فترة الأسبوع</th>
                <th>عدد الحصص</th>
                <th>متوسط الحضور%</th>
                <th>متوسط تقييم ممتاز%</th>
            </tr>
        </thead>
        <tbody>
            ${myStats.weeklyBreakdown.map(w => `
                <tr>
                    <td style="font-weight:700">${w.label}</td>
                    <td>${w.dateRange}</td>
                    <td>${w.sessions}</td>
                    <td style="font-weight:700;color:${w.attendance && w.attendance >= 90 ? '#059669' : '#d97706'}">${w.attendance !== null ? w.attendance + '%' : '—'}</td>
                    <td style="font-weight:700;color:#2563eb">${w.excellent !== null ? w.excellent + '%' : '—'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    ${atRiskStudents.length > 0 ? `
    <h2>الطلاب المتعثرون والذين يحتاجون متابعة</h2>
    <table>
        <thead>
            <tr>
                <th>اسم الطالب</th>
                <th>مستوى الخطورة</th>
                <th>الغيابات (أسبوعين)</th>
                <th>الأسباب والتوصية</th>
            </tr>
        </thead>
        <tbody>
            ${atRiskStudents.map(s => `
                <tr>
                    <td style="font-weight:700;text-align:right">${s.name}</td>
                    <td style="color:${s.riskLevel === 'high' ? '#dc2626;font-weight:700' : '#d97706'}">${s.riskLevel === 'high' ? 'خطورة عالية 🔴' : 'يحتاج تنبيه 🟡'}</td>
                    <td>${s.absencesLast2Weeks} حصة</td>
                    <td style="text-align:right">${s.reasons.join(' ، ')}<br/><small style="color:#64748b">التوصية: ${s.recommendation}</small></td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    ` : ''}

    <div class="footer">
        <p>موقع مدرسة الإمام الشافعي • إدارة التقارير التلقائية • تم استخراج هذا التقرير تلقائيًا بناءً على إدخالات المعلم الحقيقية</p>
    </div>
    <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

        const pw = window.open('', '_blank', 'width=800,height=900');
        if (!pw) { alert('يرجى السماح بالنوافذ المنبثقة لاستخراج التقرير'); return; }
        pw.document.write(html);
        pw.document.close();
    };

    const handlePrevMonth = () => setStatsMonth(prev => subMonths(prev, 1));
    const handleNextMonth = () => setStatsMonth(prev => addMonths(prev, 1));

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Activity className="h-8 w-8 text-primary animate-spin" />
                <span className="mr-2 text-sm text-muted-foreground">جاري تحميل البيانات الإحصائية...</span>
            </div>
        );
    }

    if (!selectedGroup || !activeSheikh || !myStats) {
        return (
            <div className="text-center py-16 space-y-4">
                <Shield className="h-14 w-14 text-slate-400 mx-auto" />
                <div className="text-lg font-bold text-slate-700">لم يتم تخصيص فوج تعليمي لهذا الحساب</div>
                <p className="text-sm text-muted-foreground">يرجى الاتصال بالإدارة لتخصيص فوج تعليمي لك ومزامنة بياناتك.</p>
            </div>
        );
    }

    const monthLabel = format(statsMonth, 'MMMM yyyy', { locale: ar });

    return (
        <ProtectedPage>
            <div className="container mx-auto p-4 space-y-8 pb-32 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">بوابة المعلم الذاتية</span>
                            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full font-bold">{selectedGroup}</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-headline font-bold mt-2">إحصائيات الحلقة والأداء</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            متابعة حضور الطلاب، التزام الحلقات، وتقييم جودة الحفظ اليومية والأسبوعية.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {isManagement && sheikhsList.length > 0 && (
                            <select
                                aria-label="اختر الفوج التعليمي للمشاهدة"
                                value={selectedGroup}
                                onChange={e => setSelectedGroup(e.target.value)}
                                className="text-sm font-bold border rounded-xl px-4 py-2 bg-slate-900 text-white border-white/20"
                                dir="rtl"
                            >
                                {sheikhsList.map(s => (
                                    <option key={s.group} value={s.group}>{s.group} — {s.displayName}</option>
                                ))}
                            </select>
                        )}
                        <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2 h-10 border-white/10 hover:bg-white/10">
                            <FileDown className="h-4 w-4" /> تصدير تقرير الفوج
                        </Button>
                    </div>
                </div>

                {/* Month Navigator */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl">
                    <Button variant="outline" size="sm" onClick={handlePrevMonth} className="gap-1 border-white/10 hover:bg-white/10 w-full md:w-auto">
                        <ChevronRight className="h-4 w-4" /> الشهر السابق
                    </Button>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-3 text-center">
                        <div className="text-lg font-bold flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-emerald-400" />
                            <span>تقييم شهر: {monthLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                aria-label="الشهر"
                                value={statsMonth.getMonth()}
                                onChange={e => {
                                    const newDate = new Date(statsMonth);
                                    newDate.setMonth(parseInt(e.target.value));
                                    setStatsMonth(newDate);
                                }}
                                className="text-xs font-bold border rounded-xl px-2.5 py-1.5 bg-slate-900 text-white border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                dir="rtl"
                            >
                                {[
                                    { value: 0, label: 'يناير (1)' },
                                    { value: 1, label: 'فبراير (2)' },
                                    { value: 2, label: 'مارس (3)' },
                                    { value: 3, label: 'أبريل (4)' },
                                    { value: 4, label: 'مايو (5)' },
                                    { value: 5, label: 'يونيو (6)' },
                                    { value: 6, label: 'يوليو (7)' },
                                    { value: 7, label: 'أغسطس (8)' },
                                    { value: 8, label: 'سبتمبر (9)' },
                                    { value: 9, label: 'أكتوبر (10)' },
                                    { value: 10, label: 'نوفمبر (11)' },
                                    { value: 11, label: 'ديسمبر (12)' }
                                ].map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            
                            <select
                                aria-label="السنة"
                                value={statsMonth.getFullYear()}
                                onChange={e => {
                                    const newDate = new Date(statsMonth);
                                    newDate.setFullYear(parseInt(e.target.value));
                                    setStatsMonth(newDate);
                                }}
                                className="text-xs font-bold border rounded-xl px-2.5 py-1.5 bg-slate-900 text-white border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                dir="rtl"
                            >
                                {Array.from({ length: 7 }, (_, i) => 2024 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleNextMonth} className="gap-1 border-white/10 hover:bg-white/10 w-full md:w-auto">
                        الشهر التالي <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border-none shadow-xl bg-white/5 backdrop-blur-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                <span>الحضور المتوسط للطلاب</span>
                                <Users className="h-4 w-4 text-emerald-400" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black font-headline text-emerald-400">{myStats.avgAttendance}%</div>
                            <p className="text-[10px] text-muted-foreground mt-1">متوسط نسبة حضور طلاب الفوج بالحصة</p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white/5 backdrop-blur-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                <span>التزام المعلم بالحلقات</span>
                                <Award className="h-4 w-4 text-indigo-400" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black font-headline text-indigo-400">{myStats.commitmentRate}%</div>
                            <p className="text-[10px] text-muted-foreground mt-1">نسبة الحصص المنعقدة من أيام العمل الكلية</p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white/5 backdrop-blur-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                <span>الحفظ المتميز للطلاب</span>
                                <Star className="h-4 w-4 text-amber-400" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black font-headline text-amber-400">{myStats.avgExcellent}%</div>
                            <p className="text-[10px] text-muted-foreground mt-1">نسبة الطلاب الحاصلين على تقدير "ممتاز"</p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white/5 backdrop-blur-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                <span>حصص الفوج المنعقدة</span>
                                <Calendar className="h-4 w-4 text-rose-400" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black font-headline text-rose-400">{myStats.sessionDays} حصة</div>
                            <p className="text-[10px] text-muted-foreground mt-1">إجمالي الحصص الأساسية والإضافية المسجلة</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column - Stats tables & charts */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Weekly breakdown */}
                        <Card className="border-none shadow-2xl bg-white/5 backdrop-blur-md">
                            <CardHeader className="border-b border-white/10">
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Target className="h-5 w-5 text-indigo-400" />
                                    <span>الملخص الأسبوعي للفوج</span>
                                </CardTitle>
                                <CardDescription>متابعة التزام وحضور وتسميع الفوج أسبوعياً</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right border-collapse text-sm">
                                        <thead>
                                            <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground">
                                                <th className="p-4 text-right">الأسبوع</th>
                                                <th className="p-4 text-center">الفترة الزمنية</th>
                                                <th className="p-4 text-center">الحصص</th>
                                                <th className="p-4 text-center">الحضور%</th>
                                                <th className="p-4 text-center">الممتاز%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {myStats.weeklyBreakdown.map((w, idx) => (
                                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-bold text-white">{w.label}</td>
                                                    <td className="p-4 text-center text-muted-foreground text-xs">{w.dateRange}</td>
                                                    <td className="p-4 text-center text-white">{w.sessions}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={cn(
                                                            "font-bold",
                                                            w.attendance && w.attendance >= 90 ? "text-emerald-400" : w.attendance && w.attendance >= 70 ? "text-amber-400" : "text-rose-400"
                                                        )}>
                                                            {w.attendance !== null ? `${w.attendance}%` : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className="font-bold text-blue-400">
                                                            {w.excellent !== null ? `${w.excellent}%` : '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Attendance Heatmap */}
                        <Card className="border-none shadow-2xl bg-white/5 backdrop-blur-md overflow-hidden">
                            <CardHeader className="border-b border-white/10">
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-emerald-400" />
                                    <span>خريطة حضور الفوج اليومية</span>
                                </CardTitle>
                                <CardDescription>توزيع الحضور والالتزام الفعلي يوماً بيوم في الشهر</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <AttendanceHeatmap
                                    sheikhs={sheikhsList}
                                    getDayStats={getDayStats}
                                    groupFilter={selectedGroup}
                                />
                            </CardContent>
                        </Card>

                        {/* Student Progress Chart */}
                        <Card className="border-none shadow-2xl bg-white/5 backdrop-blur-md">
                            <CardHeader className="border-b border-white/10">
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Target className="h-5 w-5 text-amber-400" />
                                    <span>مخطط الحفظ والمراجعة للطلاب</span>
                                </CardTitle>
                                <CardDescription>معدلات التسميع والإنجاز العام لطلاب الفوج</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 h-[400px]">
                                <StudentProgressChart
                                    sheikhs={sheikhsList}
                                    students={students || []}
                                    dailySessions={dailySessions}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Warnings & Honor Cards */}
                    <div className="space-y-8">
                        {/* At-risk students warning */}
                        <Card className="border-none shadow-2xl bg-white/5 backdrop-blur-md">
                            <CardHeader className="border-b border-white/10">
                                <CardTitle className="text-xl font-bold text-rose-400 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    <span>طلاب يحتاجون متابعة</span>
                                </CardTitle>
                                <CardDescription>الطلاب المعرضين للتعثر أو الغياب الطويل</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4">
                                <EarlyWarningView
                                    atRiskStudents={atRiskStudents}
                                    sheikhs={sheikhsList}
                                    onStudentClick={() => {}}
                                />
                            </CardContent>
                        </Card>

                        {/* Honor card generator */}
                        <Card className="border-none shadow-2xl bg-white/5 backdrop-blur-md">
                            <CardHeader className="border-b border-white/10">
                                <CardTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
                                    <Award className="h-5 w-5" />
                                    <span>توليد بطاقات الشرف للطلاب</span>
                                </CardTitle>
                                <CardDescription>مكافأة الطلاب المجتهدين في الفوج هذا الشهر</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 max-h-[350px] overflow-y-auto space-y-2">
                                {studentStatsList.map(st => (
                                    <div key={st.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-amber-500/20 transition-all">
                                        <div>
                                            <div className="font-bold text-sm text-white">{st.name}</div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                حضور: {st.attendanceRate}% · ممتاز: {st.excellentCount} حصص
                                            </div>
                                        </div>
                                        <Button size="sm" onClick={() => handleOpenHonorCard(st)} className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1">
                                            <Award className="h-3 w-3" /> بطاقة تكريم
                                        </Button>
                                    </div>
                                ))}
                                {studentStatsList.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-xs">لا يوجد طلاب نشطون في هذا الفوج</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                </div>

                {studentHonorCard && (
                    <HonorCardGenerator
                        data={studentHonorCard}
                        onClose={() => setStudentHonorCard(null)}
                    />
                )}

            </div>
        </ProtectedPage>
    );
}
