"use client";

import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
    format, eachDayOfInterval, startOfWeek, endOfWeek,
    startOfMonth, endOfMonth, subDays, addDays, subMonths, addMonths, startOfYear, endOfYear, subYears, addYears
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { TrendingUp, Users, BookOpen, BarChart2, Eye, EyeOff, ChevronDown, HelpCircle, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GroupSheikhInfo {
    uid: string;
    group: string;
    displayName: string;
    uids: Set<string>;
}

interface StudentProgressChartProps {
    sheikhs: GroupSheikhInfo[];
    students: any[];
    dailySessions: any;
}

type PeriodType = 'week' | 'month' | 'season' | 'year';
type ChartMode = 'cumulative' | 'daily';

// ─── Constants ────────────────────────────────────────────────────────────────
const EVAL_SCORE: Record<string, number> = {
    'ممتاز': 6, 'جيد جدا': 5, 'جيد جداً': 5,
    'جيد': 4, 'مقبول': 3, 'حسن': 3,
    'ضعيف': 2, 'متوسط': 2, 'لم يحفظ': 1,
};

const EVAL_LABEL: Record<number, string> = {
    6: 'ممتاز', 5: 'جيد جداً', 4: 'جيد', 3: 'مقبول', 2: 'ضعيف', 1: 'لم يحفظ'
};

// Color for each rating level (dot fill)
const RATING_COLOR: Record<number, string> = {
    6: '#065f46', // dark green  — ممتاز
    5: '#10b981', // emerald     — جيد جداً
    4: '#84cc16', // lime        — جيد
    3: '#f59e0b', // amber       — مقبول
    2: '#f97316', // orange      — ضعيف
    1: '#ef4444', // red         — لم يحفظ
};

// Short Arabic label shown under date in X-axis
const RATING_XLABEL: Record<number, string> = {
    6: 'ممتاز',
    5: 'جيد جداً',
    4: 'جيد',
    3: 'مقبول',
    2: 'ضعيف',
    1: 'لم يحفظ',
};

// Unified colors — student = green, group avg = indigo
const COLOR_STUDENT = '#10b981';  // emerald green
const COLOR_GROUP   = '#6366f1';  // indigo

const GROUP_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
    '#0ea5e9', '#a855f7', '#e11d48', '#059669',
];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, mode }: any) {
    if (!active || !payload?.length) return null;

    const dataPoint = payload[0]?.payload;
    let statusText = '';
    let statusColor = '';
    let statusBg = '';

    if (dataPoint) {
        if (dataPoint.isHoliday) {
            statusText = 'عطلة رسمية';
            statusColor = '#d97706';
            statusBg = '#fef3c7';
        } else if (dataPoint.isSheikhAbsent) {
            statusText = 'غياب الشيخ';
            statusColor = '#dc2626';
            statusBg = '#fee2e2';
        } else if (dataPoint.isStudentAbsent) {
            statusText = 'غائب (طالب)';
            statusColor = '#db2777';
            statusBg = '#fce7f3';
        } else if (dataPoint.isNoSession) {
            statusText = 'يوم بلا حلقة';
            statusColor = '#64748b';
            statusBg = '#f1f5f9';
        }
    }

    return (
        <div
            dir="rtl"
            style={{
                background: 'rgba(255,255,255,0.97)',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '10px 14px',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.18)',
                fontSize: '11px',
                minWidth: '160px',
            }}
        >
            <div style={{ fontWeight: 800, marginBottom: 6, color: '#1e293b' }}>{label}</div>

            {statusText && (
                <div style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: statusColor,
                    backgroundColor: statusBg,
                    marginBottom: '8px',
                }}>
                    {statusText}
                </div>
            )}

            {payload.map((entry: any) => {
                const valueText = entry.value === null || entry.value === undefined
                    ? '—'
                    : (mode === 'cumulative' ? entry.value : (EVAL_LABEL[entry.value] || entry.value));

                return (
                    <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: '#64748b', flex: 1 }}>{entry.name}:</span>
                        <span style={{ fontWeight: 700, color: entry.color }}>
                            {valueText}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StudentProgressChart({ sheikhs, students, dailySessions }: StudentProgressChartProps) {
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [period, setPeriod] = useState<PeriodType>('month');
    const [mode, setMode] = useState<ChartMode>('cumulative');
    const [showAllDays, setShowAllDays] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [isExporting, setIsExporting] = useState(false);

    // Ref for screenshot capture (stats + chart area)
    const exportRef = useRef<HTMLDivElement>(null);

    // Reset date to today when changing periods
    const handlePeriodChange = useCallback((p: PeriodType) => {
        setPeriod(p);
        setCurrentDate(new Date());
    }, []);

    // Navigate backwards/forwards in time
    const handleTimeNavigate = useCallback((dir: -1 | 1) => {
        setCurrentDate(prev => {
            if (period === 'week') return addDays(prev, dir * 7);
            if (period === 'month') return addMonths(prev, dir);
            if (period === 'season') return addMonths(prev, dir * 3); // season navigates by 3 months (90 days)
            return addYears(prev, dir);
        });
    }, [period]);

    // Reset date to today
    const handleResetToToday = useCallback(() => {
        setCurrentDate(new Date());
    }, []);

    const today = useMemo(() => new Date(), []);

    // Check if we can navigate forward (prevent going into the future)
    const canNavigateForward = useMemo(() => {
        if (period === 'week') {
            const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 6 });
            const startOfSelectedWeek = startOfWeek(currentDate, { weekStartsOn: 6 });
            return startOfSelectedWeek < startOfCurrentWeek;
        }
        if (period === 'month') {
            return startOfMonth(currentDate) < startOfMonth(today);
        }
        if (period === 'season') {
            return currentDate < today;
        }
        return startOfYear(currentDate) < startOfYear(today);
    }, [period, currentDate, today]);

    // Format range label in Arabic
    const rangeLabel = useMemo(() => {
        const isCurrentPeriod = (
            (period === 'month' && format(currentDate, 'yyyy-MM') === format(today, 'yyyy-MM')) ||
            (period === 'year' && format(currentDate, 'yyyy') === format(today, 'yyyy')) ||
            (period === 'week' && format(startOfWeek(currentDate), 'yyyy-w') === format(startOfWeek(today), 'yyyy-w')) ||
            (period === 'season' && Math.abs(currentDate.getTime() - today.getTime()) < 24 * 60 * 60 * 1000 * 3)
        );

        let label = '';
        if (period === 'week') {
            const dow = currentDate.getDay();
            const sat = addDays(currentDate, dow === 6 ? 0 : -(dow + 1));
            const fri = addDays(sat, 6);
            label = `أسبوع ${format(sat, 'd MMM', { locale: ar })} — ${format(fri, 'd MMM yyyy', { locale: ar })}`;
        } else if (period === 'month') {
            label = format(currentDate, 'MMMM yyyy', { locale: ar });
        } else if (period === 'season') {
            label = `90 يوماً تنتهي في ${format(currentDate, 'd MMM yyyy', { locale: ar })}`;
        } else {
            label = `عام ${format(currentDate, 'yyyy', { locale: ar })}`;
        }

        return { label, isCurrentPeriod };
    }, [period, currentDate, today]);

    // ── Active students per group ─────────────────────────────────────────
    const activeStudents = useMemo(() => {
        return (students || []).filter(s => s && s.status === 'نشط');
    }, [students]);

    const studentsInGroup = useMemo(() => {
        if (!selectedGroup) return [];
        return activeStudents.filter(s =>
            s && ((s as any).group === selectedGroup || s.groupName === selectedGroup)
        );
    }, [activeStudents, selectedGroup]);

    // Auto-select first student when group changes
    const handleGroupChange = useCallback((grp: string) => {
        setSelectedGroup(grp);
        setSelectedStudentId('');
        setCurrentDate(new Date()); // reset date when group changes
    }, []);

    // ── Owner → group map ─────────────────────────────────────────────────
    const ownerGroupMap = useMemo(() => {
        const map = new Map<string, string>();
        sheikhs.forEach(sh => sh.uids.forEach(uid => map.set(uid, sh.group)));
        return map;
    }, [sheikhs]);

    // ── Date range for selected period ────────────────────────────────────
    const { startDate, endDate } = useMemo(() => {
        let start = startOfMonth(currentDate);
        let end = currentDate;

        if (period === 'week') {
            const dow = currentDate.getDay();
            const sat = addDays(currentDate, dow === 6 ? 0 : -(dow + 1));
            start = sat;
            end = addDays(sat, 6);
        } else if (period === 'month') {
            start = startOfMonth(currentDate);
            end = endOfMonth(currentDate);
        } else if (period === 'season') {
            start = subDays(currentDate, 89);
            end = currentDate;
        } else if (period === 'year') {
            start = startOfYear(currentDate);
            end = endOfYear(currentDate);
        }

        // Restrict end date to today if it is month/season/year to avoid showing blank future calendar days
        if (period !== 'week') {
            if (end > today) {
                end = today;
            }
        }

        // Dynamically adjust start/end to cover only days that have actual session data in this period
        if (period !== 'week' && dailySessions && selectedGroup) {
            const datesWithSessions = Object.keys(dailySessions).filter(dateStr => {
                const daySessions = dailySessions[dateStr];
                if (!daySessions) return false;
                const sessionList = Object.values(daySessions);
                return sessionList.some((s: any) => ownerGroupMap.get(s?.ownerId) === selectedGroup);
            }).sort();

            if (datesWithSessions.length > 0) {
                const firstSessionDate = new Date(datesWithSessions[0]);
                const lastSessionDate = new Date(datesWithSessions[datesWithSessions.length - 1]);

                // If first session is within the period's range, start the chart from it
                if (firstSessionDate > start && firstSessionDate <= end) {
                    start = firstSessionDate;
                }
                // If last session is within the period's range, end the chart at it
                if (lastSessionDate < end && lastSessionDate >= start) {
                    end = lastSessionDate;
                }
            }
        }

        return { startDate: start, endDate: end };
    }, [period, dailySessions, selectedGroup, ownerGroupMap, currentDate, today]);

    // ── Per-student, per-date score aggregation ───────────────────────────
    // Build: list of { dateStr, dayLabel, isHoliday, isSheikhAbsent, isNoSession, scores, attendance, unregistered }
    const sessionData = useMemo(() => {
        if (!dailySessions || !selectedGroup) return null;
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        const result: {
            dateStr: string;
            dayLabel: string;
            isHoliday: boolean;
            isSheikhAbsent: boolean;
            isNoSession: boolean;
            scores: Record<string, number | null>;
            attendance: Record<string, string>;
            unregistered: Set<string>; // studentIds present but with no memorization score
        }[] = [];

        allDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySessions = dailySessions[dateStr];
            const dayLabel = format(day, 'd/M', { locale: ar });

            if (!daySessions) {
                result.push({
                    dateStr,
                    dayLabel,
                    isHoliday: false,
                    isSheikhAbsent: false,
                    isNoSession: true,
                    scores: {},
                    attendance: {},
                    unregistered: new Set<string>(),
                });
                return;
            }

            const sessionList = Object.values(daySessions as Record<string, any>);
            const groupSession = sessionList.find((s: any) => ownerGroupMap.get(s?.ownerId) === selectedGroup);

            if (!groupSession) {
                result.push({
                    dateStr,
                    dayLabel,
                    isHoliday: false,
                    isSheikhAbsent: false,
                    isNoSession: true,
                    scores: {},
                    attendance: {},
                    unregistered: new Set<string>(),
                });
                return;
            }

            const sType = groupSession.sessionType;

            if (sType === 'يوم عطلة') {
                result.push({
                    dateStr,
                    dayLabel,
                    isHoliday: true,
                    isSheikhAbsent: false,
                    isNoSession: false,
                    scores: {},
                    attendance: {},
                    unregistered: new Set<string>(),
                });
                return;
            }

            if (sType === 'غياب الشيخ') {
                result.push({
                    dateStr,
                    dayLabel,
                    isHoliday: false,
                    isSheikhAbsent: true,
                    isNoSession: false,
                    scores: {},
                    attendance: {},
                    unregistered: new Set<string>(),
                });
                return;
            }

            const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
            if (!isReal) {
                result.push({
                    dateStr,
                    dayLabel,
                    isHoliday: false,
                    isSheikhAbsent: false,
                    isNoSession: true,
                    scores: {},
                    attendance: {},
                    unregistered: new Set<string>(),
                });
                return;
            }

            const records: any[] = Array.isArray(groupSession.records)
                ? groupSession.records
                : groupSession.records ? Object.values(groupSession.records) : [];

            const dayScores: Record<string, number | null> = {};
            const dayAttendance: Record<string, string> = {};
            const dayUnregistered = new Set<string>();

            records.forEach(r => {
                if (!r.studentId) return;
                dayAttendance[r.studentId] = r.attendance || 'غائب';
                const isPresent = r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض';
                if (!isPresent) {
                    dayScores[r.studentId] = null;
                    return;
                }
                if (r.review) {
                    // review session — treat as unregistered
                    dayScores[r.studentId] = null;
                    dayUnregistered.add(r.studentId);
                    return;
                }
                const score = EVAL_SCORE[r.memorization] ?? null;
                dayScores[r.studentId] = score;
                // Present but memorization is empty → unregistered
                if (score === null) dayUnregistered.add(r.studentId);
            });

            result.push({
                dateStr,
                dayLabel,
                isHoliday: false,
                isSheikhAbsent: false,
                isNoSession: false,
                scores: dayScores,
                attendance: dayAttendance,
                unregistered: dayUnregistered,
            });
        });

        return result;
    }, [dailySessions, selectedGroup, ownerGroupMap, startDate, endDate]);

    // ── Chart data builder ─────────────────────────────────────────────────

    // ── Simpler cumulative calculation (no circular dependency) ───────────
    const finalChartData = useMemo(() => {
        if (!sessionData || !selectedStudentId) return [];
        const groupStudentIds = studentsInGroup.map(s => s.id);

        const filteredSessions = showAllDays
            ? sessionData
            : sessionData.filter(d => !d.isHoliday && !d.isSheikhAbsent && !d.isNoSession);

        let studentCum = 0;
        let runningGroupSum = 0;
        let lastStudentCum = 0;
        let lastGroupCum = 0;

        return filteredSessions.map((dayData) => {
            const studentScore = dayData.scores[selectedStudentId] ?? null;
            const studentAttendance = dayData.attendance[selectedStudentId] ?? null;
            const isStudentAbsent = studentAttendance === 'غائب';
            const isUnregistered = dayData.unregistered?.has(selectedStudentId) ?? false;

            const groupScores: number[] = [];
            groupStudentIds.forEach(sid => {
                const sc = dayData.scores[sid];
                if (sc !== null && sc !== undefined) groupScores.push(sc);
            });
            const groupAvg = groupScores.length > 0
                ? Math.round((groupScores.reduce((a, b) => a + b, 0) / groupScores.length) * 10) / 10
                : null;

            const entry: Record<string, any> = {
                name: dayData.dayLabel,
                dateStr: dayData.dateStr,
                isHoliday: dayData.isHoliday,
                isSheikhAbsent: dayData.isSheikhAbsent,
                isNoSession: dayData.isNoSession,
                isStudentAbsent,
                isUnregistered,
                studentAttendance,
                studentScore,  // raw score for dot coloring
            };

            if (mode === 'daily') {
                entry['الطالب'] = studentScore;
                entry['متوسط الفوج'] = groupAvg;
            } else {
                if (studentScore !== null) {
                    studentCum += studentScore;
                    lastStudentCum = studentCum;
                }
                if (groupAvg !== null) {
                    runningGroupSum += groupAvg;
                    lastGroupCum = runningGroupSum;
                }
                entry['الطالب'] = studentCum > 0 || lastStudentCum > 0 ? studentCum : null;
                entry['متوسط الفوج'] = runningGroupSum > 0 || lastGroupCum > 0 ? runningGroupSum : null;
            }

            return entry;
        });
    }, [sessionData, selectedStudentId, studentsInGroup, mode, showAllDays]);

    const selectedStudent = studentsInGroup.find(s => s.id === selectedStudentId);
    const hasData = finalChartData.length > 0;

    // ── Stats summary ─────────────────────────────────────────────────────
    const summaryStats = useMemo(() => {
        if (!sessionData || !selectedStudentId) return null;
        const realSessions = sessionData.filter(d => !d.isHoliday && !d.isSheikhAbsent && !d.isNoSession);
        const scores = realSessions.map(d => d.scores[selectedStudentId]).filter((s): s is number => s !== null && s !== undefined);
        if (!scores.length) return null;
        const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        const max = Math.max(...scores);
        const recent3 = scores.slice(-3);
        const recentAvg = recent3.length ? Math.round((recent3.reduce((a, b) => a + b, 0) / recent3.length) * 10) / 10 : null;
        const trend = recentAvg !== null && avg > 0 ? (recentAvg > avg ? 'up' : recentAvg < avg - 0.5 ? 'down' : 'stable') : 'stable';
        return { avg, max, total: scores.reduce((a, b) => a + b, 0), sessions: scores.length, trend };
    }, [sessionData, selectedStudentId]);

    // ── Counts of each session status ─────────────────────────────────────
    const stateCounts = useMemo(() => {
        if (!finalChartData) return { present: 0, holiday: 0, sheikhAbsent: 0, studentAbsent: 0, noSession: 0, unregistered: 0 };
        let present = 0;
        let holiday = 0;
        let sheikhAbsent = 0;
        let studentAbsent = 0;
        let noSession = 0;
        let unregistered = 0;

        finalChartData.forEach(d => {
            if (d.isHoliday) holiday++;
            else if (d.isSheikhAbsent) sheikhAbsent++;
            else if (d.isStudentAbsent) studentAbsent++;
            else if (d.isNoSession) noSession++;
            else if (d.isUnregistered) unregistered++;
            else if (d.studentAttendance === 'حاضر' || d.studentAttendance === 'متأخر' || d.studentAttendance === 'تعويض') {
                present++;
            }
        });

        return { present, holiday, sheikhAbsent, studentAbsent, noSession, unregistered };
    }, [finalChartData]);

    const periodLabels: Record<PeriodType, string> = {
        week: 'الأسبوع',
        month: 'الشهر',
        season: 'الموسم (90 يوم)',
        year: 'السنة',
    };

    // ── Chart pixel width for scrollable long-period charts ────────────────
    const chartPixelWidth = useMemo(() => {
        const n = finalChartData.length;
        if (!n) return 0;
        // Spacious pixels per data point based on period to prevent text overlaps
        const pxPerPoint = period === 'year' ? 45 : period === 'season' ? 55 : period === 'month' ? 70 : 90;
        const computed = n * pxPerPoint;
        
        // Enforce safe minimum widths for each period
        const minWidth = period === 'year' ? 4500 : period === 'season' ? 2500 : period === 'month' ? 1200 : 600;
        return Math.max(computed, minWidth);
    }, [finalChartData.length, period]);

    const needsScroll = true; // Always allow scrolling if chart exceeds screen width

    // ── Export / Download ──────────────────────────────────────────
    const handleExport = useCallback(async (formatType: 'png' | 'pdf') => {
        if (!exportRef.current || !selectedStudent) return;
        setIsExporting(true);
        
        // Store original styles to restore later
        const originalWidth = exportRef.current.style.width;
        const originalMaxWidth = exportRef.current.style.maxWidth;
        
        // Temporarily expand card width to fit the chart during export (capped at 2000px for visual sanity on PDF)
        const exportWidth = chartPixelWidth > 0 ? `${Math.min(chartPixelWidth + 60, 2000)}px` : '1200px';
        exportRef.current.style.width = exportWidth;
        exportRef.current.style.maxWidth = 'none';
        
        // Wait a tiny bit for the DOM layout to update
        await new Promise(resolve => setTimeout(resolve, 150));

        try {
            const canvas = await html2canvas(exportRef.current, {
                backgroundColor: '#f8fafc',
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: chartPixelWidth > 0 ? chartPixelWidth + 100 : undefined,
            });

            // Construct clean descriptive filename
            const studentCleanName = selectedStudent.fullName?.replace(/\s+/g, '_') || 'الطالب';
            const periodLabel = periodLabels[period];
            const dateCleanLabel = rangeLabel.label.replace(/[\s/\\:*?"<>|—–]+/g, '_');
            const fileName = `تقرير_حفظ_${studentCleanName}_${periodLabel}_${dateCleanLabel}`;

            if (formatType === 'png') {
                const link = document.createElement('a');
                link.download = `${fileName}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } else {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                    unit: 'px',
                    format: [canvas.width / 2, canvas.height / 2],
                });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
                pdf.save(`${fileName}.pdf`);
            }
        } catch (e) {
            console.error('Export failed:', e);
        } finally {
            // Restore original styles
            if (exportRef.current) {
                exportRef.current.style.width = originalWidth;
                exportRef.current.style.maxWidth = originalMaxWidth;
            }
            setIsExporting(false);
        }
    }, [selectedStudent, period, periodLabels, rangeLabel.label, chartPixelWidth]);

    return (
        <div
            dir="rtl"
            style={{
                background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #f0fdf4 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                overflow: 'hidden',
                marginBottom: '20px',
                boxShadow: '0 4px 24px -6px rgba(99,102,241,0.12)',
            }}
        >
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        padding: '6px',
                        display: 'flex',
                    }}>
                        <TrendingUp style={{ width: 18, height: 18, color: 'white' }} />
                    </div>
                    <div>
                        <h3 style={{ color: 'white', fontWeight: 800, fontSize: '14px', margin: 0 }}>
                            📈 منحنى تطور الحفظ
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px', margin: 0 }}>
                            تتبع مسيرة الطالب وقارنها بفوجه ومعدل المدرسة
                        </p>
                    </div>
                </div>

                {/* Range Navigation Controls */}
                {selectedStudentId && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(255,255,255,0.15)',
                        padding: '4px 10px',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 700,
                    }}>
                        <button
                            onClick={() => handleTimeNavigate(-1)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '2px',
                            }}
                            title="الفترة السابقة"
                        >
                            <ChevronRight style={{ width: 16, height: 16 }} />
                        </button>
                        
                        <div style={{ minWidth: '110px', textAlign: 'center' }}>
                            {rangeLabel.label}
                        </div>

                        <button
                            onClick={() => handleTimeNavigate(1)}
                            disabled={!canNavigateForward}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: canNavigateForward ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '2px',
                                opacity: canNavigateForward ? 1 : 0.4,
                            }}
                            title="الفترة التالية"
                        >
                            <ChevronLeft style={{ width: 16, height: 16 }} />
                        </button>

                        {!rangeLabel.isCurrentPeriod && (
                            <button
                                onClick={handleResetToToday}
                                style={{
                                    background: 'white',
                                    color: '#6366f1',
                                    border: 'none',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    marginRight: '4px',
                                }}
                            >
                                اليوم
                            </button>
                        )}
                    </div>
                )}

                {/* Period buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['week', 'month', 'season', 'year'] as PeriodType[]).map(p => (
                        <button
                            key={p}
                            onClick={() => handlePeriodChange(p)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: period === p ? 'white' : 'rgba(255,255,255,0.15)',
                                color: period === p ? '#6366f1' : 'white',
                            }}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                </div>

                {/* Export Buttons */}
                {selectedStudentId && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {/* PNG Download */}
                        <button
                            onClick={() => handleExport('png')}
                            disabled={isExporting || !hasData}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                border: 'none',
                                cursor: isExporting || !hasData ? 'not-allowed' : 'pointer',
                                background: isExporting ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
                                color: isExporting ? 'rgba(255,255,255,0.5)' : '#6366f1',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                opacity: isExporting || !hasData ? 0.6 : 1,
                                transition: 'all 0.2s',
                            }}
                            title="تحميل كصورة PNG"
                        >
                            <Download style={{ width: 13, height: 13 }} />
                            {isExporting ? 'جاري...' : 'تحميل صورة'}
                        </button>
                        
                        {/* PDF Download */}
                        <button
                            onClick={() => handleExport('pdf')}
                            disabled={isExporting || !hasData}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                border: 'none',
                                cursor: isExporting || !hasData ? 'not-allowed' : 'pointer',
                                background: isExporting ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
                                color: isExporting ? 'rgba(255,255,255,0.5)' : '#8b5cf6',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                opacity: isExporting || !hasData ? 0.6 : 1,
                                transition: 'all 0.2s',
                            }}
                            title="تحميل كملف PDF"
                        >
                            <FileText style={{ width: 13, height: 13 }} />
                            {isExporting ? 'جاري...' : 'تحميل PDF'}
                        </button>
                    </div>
                )}
            </div>

            {/* Filters row */}
            <div style={{
                padding: '12px 16px',
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.7)',
                borderBottom: '1px solid #e2e8f0',
            }}>
                {/* Group select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>الفوج</label>
                    <select
                        value={selectedGroup}
                        onChange={e => handleGroupChange(e.target.value)}
                        style={{
                            fontSize: '11px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '5px 10px',
                            background: 'white',
                            color: '#1e293b',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minWidth: '120px',
                        }}
                    >
                        <option value="">اختر الفوج</option>
                        {sheikhs.map(sh => (
                            <option key={sh.group} value={sh.group}>
                                {sh.group} — {sh.displayName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Student select */}
                {selectedGroup && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <label style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>الطالب</label>
                        <select
                            value={selectedStudentId}
                            onChange={e => setSelectedStudentId(e.target.value)}
                            style={{
                                fontSize: '11px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '5px 10px',
                                background: 'white',
                                color: '#1e293b',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minWidth: '160px',
                            }}
                        >
                            <option value="">اختر الطالب</option>
                            {studentsInGroup.map(s => (
                                <option key={s.id} value={s.id}>{s.fullName}</option>
                            ))}
                        </select>
                    </div>
                )}
                {selectedStudentId && (
                    <div style={{ display: 'flex', gap: 4, marginRight: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Days visibility toggle */}
                        <button
                            onClick={() => setShowAllDays(v => !v)}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                border: `2px solid ${showAllDays ? '#8b5cf6' : '#e2e8f0'}`,
                                cursor: 'pointer',
                                background: showAllDays ? '#8b5cf6' : 'white',
                                color: showAllDays ? 'white' : '#64748b',
                                transition: 'all 0.2s',
                            }}
                        >
                            {showAllDays ? '📅 كل الأيام (بما فيها العطل)' : '📅 أيام الحلقات فقط'}
                        </button>

                        {([['cumulative', '📈 تراكمي'], ['daily', '📊 يومي']] as [ChartMode, string][]).map(([m, label]) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    border: `2px solid ${mode === m ? '#6366f1' : '#e2e8f0'}`,
                                    cursor: 'pointer',
                                    background: mode === m ? '#6366f1' : 'white',
                                    color: mode === m ? 'white' : '#64748b',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                        {/* Explain Chart Button */}
                        <button
                            onClick={() => setShowInfo(v => !v)}
                            style={{
                                padding: '5px 8px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer',
                                background: showInfo ? '#f1f5f9' : 'white',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.2s',
                            }}
                            title="شرح المنحنى التراكمي واليومي"
                        >
                            <HelpCircle style={{ width: 14, height: 14, color: '#6366f1' }} />
                            <span style={{ fontSize: '9px' }}>فهم المنحنى</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Info explanation card */}
            {showInfo && selectedStudent && (
                <div style={{
                    margin: '12px 16px 4px',
                    padding: '14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#334155',
                    lineHeight: '1.6',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                }}>
                    <div style={{ fontWeight: 800, color: '#4f46e5', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <HelpCircle style={{ width: 14, height: 14 }} />
                        دليل فهم المنحنيات البيانية
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                        <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>📈 المنحنى التراكمي (مجموع النقاط):</div>
                            <ul style={{ listStyleType: 'disc', paddingRight: '16px', margin: 0 }}>
                                <li>يجمع درجات الطالب يوماً بعد يوم، وبالتالي **يصعد دائماً** أو يبقى مستوياً (ثابتاً) ولا ينزل أبداً.</li>
                                <li>**متى يكون ممتازاً؟** لمراقبة الاستمرارية والتراكم المعرفي. المنحنى ذو الصعود المستمر يعني التزاماً وثباتاً، بينما تحوله لخط مستوٍ (أفقي) يعني انقطاعاً.</li>
                                <li>**متى لا يكون مناسباً؟** إذا أردت رؤية جودة الحفظ الفردية لكل يوم بحد ذاته، لأن الدرجات الضعيفة تظهر كصعود طفيف وليس كهبوط.</li>
                            </ul>
                        </div>
                        <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 4 }}>📊 المنحنى اليومي (التقييم الفردي):</div>
                            <ul style={{ listStyleType: 'disc', paddingRight: '16px', margin: 0 }}>
                                <li>يظهر الدرجة الحقيقية للحفظ في كل حصة (ممتاز = 6، ضعيف = 2، إلخ).</li>
                                <li>**متى يكون ممتازاً؟** لمعرفة التذبذب اليومي للطالب فوراً. يمكنك بسهولة اكتشاف أي حصة ضعفت فيها جودة الحفظ بدقة.</li>
                                <li>**متى لا يكون مناسباً** لتتبع مدى التقدم الإجمالي ومقارنة إنتاجية الطالب بمرور الوقت بسبب صعوده ونزوله المستمر.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Main content and report card */}
            <div style={{ padding: '16px' }}>
                {!selectedGroup && (
                    <div style={{
                        textAlign: 'center',
                        padding: '48px 16px',
                        color: '#94a3b8',
                        fontSize: '13px',
                    }}>
                        <BookOpen style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontWeight: 700 }}>اختر الفوج والطالب لعرض منحنى التطور</div>
                    </div>
                )}

                {selectedGroup && !selectedStudentId && (
                    <div style={{
                        textAlign: 'center',
                        padding: '48px 16px',
                        color: '#94a3b8',
                        fontSize: '13px',
                    }}>
                        <Users style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontWeight: 700 }}>اختر طالباً من {selectedGroup} لعرض منحنى حفظه</div>
                    </div>
                )}

                {selectedStudentId && !hasData && (
                    <div style={{
                        textAlign: 'center',
                        padding: '48px 16px',
                        color: '#94a3b8',
                        fontSize: '13px',
                    }}>
                        <BarChart2 style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontWeight: 700 }}>لا توجد حصص مسجلة في هذه الفترة</div>
                        <div style={{ fontSize: '11px', marginTop: 4 }}>جرب تغيير الفترة الزمنية أعلاه</div>
                    </div>
                )}

                {selectedStudentId && hasData && (
                    <div
                        ref={exportRef}
                        style={{
                            background: '#f8fafc',
                            padding: '16px',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
                        }}
                    >
                        {/* 1. Report Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1.5px solid #e2e8f0',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            borderRadius: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 2px 8px -3px rgba(0,0,0,0.03)',
                        }}>
                            <div>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>بطاقة تقرير الأداء ومستوى الحفظ</div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>{selectedStudent?.fullName}</div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>الفوج: {selectedGroup}</div>
                            </div>
                            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b' }}>الفترة الزمنية</div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5', marginTop: '2px' }}>{rangeLabel.label}</div>
                                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px', fontWeight: 500 }}>{periodLabels[period]} - {mode === 'cumulative' ? 'نقاط تراكمية' : 'تقييم يومي'}</div>
                            </div>
                        </div>

                        {/* 2. Stats cards */}
                        {summaryStats && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 8,
                                padding: '12px 16px',
                                background: 'white',
                                borderRadius: '14px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 2px 8px -3px rgba(0,0,0,0.03)',
                            }}>
                                {[
                                    {
                                        label: 'متوسط التقييم',
                                        value: EVAL_LABEL[Math.round(summaryStats.avg)] || summaryStats.avg.toFixed(1),
                                        sub: `التقييم: ${summaryStats.avg.toFixed(1)} من 6`,
                                        color: summaryStats.avg >= 5 ? '#065f46' : summaryStats.avg >= 4 ? '#10b981' : summaryStats.avg >= 3 ? '#f59e0b' : '#ef4444',
                                        bg: summaryStats.avg >= 5 ? '#ecfdf5' : summaryStats.avg >= 4 ? '#d1fae5' : summaryStats.avg >= 3 ? '#fffbeb' : '#fef2f2',
                                    },
                                    {
                                        label: 'أعلى تقييم',
                                        value: EVAL_LABEL[summaryStats.max] || '—',
                                        sub: RATING_COLOR[summaryStats.max] ? '● ' + EVAL_LABEL[summaryStats.max] : '—',
                                        color: RATING_COLOR[summaryStats.max] || '#8b5cf6',
                                        bg: '#f5f3ff',
                                    },
                                    {
                                        label: 'عدد الحصص',
                                        value: summaryStats.sessions,
                                        sub: 'حصة مقيّمة',
                                        color: '#3b82f6',
                                        bg: '#eff6ff',
                                    },
                                    {
                                        label: 'الاتجاه',
                                        value: summaryStats.trend === 'up' ? '📈 تحسن' : summaryStats.trend === 'down' ? '📉 تراجع' : '➡️ ثابت',
                                        sub: 'آخر 3 حصص مقيّمة',
                                        color: summaryStats.trend === 'up' ? '#10b981' : summaryStats.trend === 'down' ? '#ef4444' : '#64748b',
                                        bg: '#f8fafc',
                                    },
                                ].map(card => (
                                    <div key={card.label} style={{
                                        background: card.bg,
                                        border: `1px solid ${card.color}22`,
                                        borderRadius: '12px',
                                        padding: '10px 12px',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '15px', fontWeight: 800, color: card.color }}>{card.value}</div>
                                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>{card.label}</div>
                                        <div style={{ fontSize: '8px', color: '#94a3b8' }}>{card.sub}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 3. Session State Counts */}
                        {summaryStats && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '10px',
                                padding: '12px 16px',
                                background: 'white',
                                borderRadius: '14px',
                                border: '1px solid #e2e8f0',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#475569',
                                boxShadow: '0 2px 8px -3px rgba(0,0,0,0.03)',
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    📊 تفاصيل الأيام وحالة الحضور في هذه الفترة:
                                </span>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#065f46', border: `1px solid ${COLOR_STUDENT}33`, fontWeight: 800 }} title="الحصص التي حضرها الطالب وتم تقييمه فيها">
                                        ✅ حضور مُقيَّم: {stateCounts.present} حصة
                                    </span>
                                    {stateCounts.unregistered > 0 && (
                                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #94a3b833' }}>
                                            ⬜ غير مسجّل: {stateCounts.unregistered} حصة
                                        </span>
                                    )}
                                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fffbeb', color: '#b45309', border: '1px solid #f59e0b33' }}>
                                        🏖 عطلة رسمية: {stateCounts.holiday} يوم
                                    </span>
                                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #ef444433' }}>
                                        🔴 غياب الشيخ: {stateCounts.sheikhAbsent} يوم
                                    </span>
                                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fdf2f8', color: '#be185d', border: '1px solid #ec489933' }}>
                                        🩷 غياب الطالب: {stateCounts.studentAbsent} يوم
                                    </span>
                                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e133' }}>
                                        ⬜ بلا حلقة: {stateCounts.noSession} يوم
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 4. Chart container */}
                        <div style={{
                            background: 'white',
                            padding: '16px',
                            borderRadius: '14px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 2px 8px -3px rgba(0,0,0,0.03)',
                        }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#4f46e5',
                                marginBottom: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <TrendingUp style={{ width: 14, height: 14 }} />
                                منحنى أداء الحفظ {mode === 'cumulative' ? 'التراكمي' : 'اليومي'}
                                {needsScroll && (
                                    <span style={{ marginRight: 'auto', fontSize: '9px', color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        ↔ اسحب يميناً ويساراً لمشاهدة كامل الفترة
                                    </span>
                                )}
                            </div>

                            {/* Scrollable chart wrapper for long periods */}
                            <div style={{
                                overflowX: isExporting ? 'visible' : (needsScroll ? 'auto' : 'visible'),
                                overflowY: 'visible',
                                paddingBottom: needsScroll && !isExporting ? 8 : 0,
                                // Custom scrollbar styling
                                scrollbarWidth: 'thin',
                                scrollbarColor: `${COLOR_STUDENT}55 #f1f5f9`,
                            }}>
                                <div style={{
                                    width: '100%',
                                    minWidth: chartPixelWidth > 0 ? chartPixelWidth : undefined,
                                    height: 300,
                                    direction: 'ltr',
                                }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={finalChartData}
                                            margin={{ top: 15, right: typeof chartPixelWidth === 'number' ? 80 : 30, left: 15, bottom: 5 }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                vertical={false}
                                                stroke="#e2e8f0"
                                            />
                                            <XAxis
                                                dataKey="name"
                                                height={52}
                                                interval={period === 'year' ? 30 : period === 'season' ? 7 : period === 'month' ? 2 : 0}
                                                padding={{ left: 24, right: 24 }}
                                                tick={(props: any) => {
                                                    const { x, y, payload } = props;
                                                    const dayData = finalChartData[payload.index];
                                                    if (!dayData) return <text x={x} y={y} dy={10} textAnchor="middle" fill="#94a3b8" style={{ fontSize: '9px' }}>{payload.value}</text>;

                                                    // Determine color and sub-label based on status
                                                    let color = '#94a3b8';
                                                    let subLabel = '—';
                                                    let subColor = color;

                                                    if (dayData.isHoliday) {
                                                        color = '#d97706';
                                                        subLabel = '🏖 عطلة';
                                                        subColor = '#d97706';
                                                    } else if (dayData.isSheikhAbsent) {
                                                        color = '#dc2626';
                                                        subLabel = '🔴 غ.شيخ';
                                                        subColor = '#dc2626';
                                                    } else if (dayData.isStudentAbsent) {
                                                        color = '#db2777';
                                                        subLabel = '🩷 غ.طالب';
                                                        subColor = '#db2777';
                                                    } else if (dayData.isUnregistered) {
                                                        color = '#64748b';
                                                        subLabel = '⬜ غ.مسجل';
                                                        subColor = '#64748b';
                                                    } else if (dayData.isNoSession) {
                                                        color = '#94a3b8';
                                                        subLabel = '—';
                                                        subColor = '#cbd5e1';
                                                    } else if (dayData.studentScore !== null && dayData.studentScore !== undefined) {
                                                        // Scored session — show rating
                                                        const sc = dayData.studentScore as number;
                                                        color = RATING_COLOR[sc] || COLOR_STUDENT;
                                                        subLabel = RATING_XLABEL[sc] || '';
                                                        subColor = color;
                                                    }

                                                    return (
                                                        <g transform={`translate(${x},${y})`}>
                                                            <text
                                                                x={0}
                                                                y={0}
                                                                dy={10}
                                                                textAnchor="middle"
                                                                fill={color}
                                                                style={{ fontSize: '8.5px', fontWeight: subLabel !== '—' ? 700 : 500 }}
                                                            >
                                                                {payload.value}
                                                            </text>
                                                            {subLabel && (
                                                                <text
                                                                    x={0}
                                                                    y={0}
                                                                    dy={22}
                                                                    textAnchor="middle"
                                                                    fill={subColor}
                                                                    style={{ fontSize: '7.5px', fontWeight: subLabel !== '—' ? 700 : 500 }}
                                                                >
                                                                    {subLabel}
                                                                </text>
                                                            )}
                                                        </g>
                                                    );
                                                }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                domain={mode === 'cumulative' ? [0, 'dataMax + 6'] : [0, 6]}
                                                tickCount={mode === 'cumulative' ? undefined : 7}
                                                ticks={mode === 'cumulative' ? undefined : [0, 1, 2, 3, 4, 5, 6]}
                                                tick={(props: any) => {
                                                    const { x, y, payload } = props;
                                                    const val = payload.value as number;

                                                    if (mode === 'cumulative') {
                                                        const isMultipleOf6 = val % 6 === 0;
                                                        if (!isMultipleOf6 && val !== 0) return <g />;
                                                        const countLabel = val > 0 ? ` (${val / 6}×ممتاز)` : '';
                                                        return (
                                                            <text x={x - 5} y={y} dy={3} textAnchor="end" fill="#475569" style={{ fontSize: '8.5px', fontWeight: 700 }}>
                                                                {val} {countLabel}
                                                            </text>
                                                        );
                                                    }

                                                    return (
                                                        <text x={x - 5} y={y} dy={3} textAnchor="end" fill={val > 0 ? (RATING_COLOR[val] || '#64748b') : '#64748b'} style={{ fontSize: '9px', fontWeight: val > 0 ? 700 : 500 }}>
                                                            {val > 0 ? `${val} (${EVAL_LABEL[val]})` : val}
                                                        </text>
                                                    );
                                                }}
                                                tickLine={false}
                                                axisLine={false}
                                                width={mode === 'cumulative' ? 70 : 60}
                                            />
                                            <Tooltip content={<CustomTooltip mode={mode} />} />

                                            {/* Reference lines every few points for cumulative mode to denote "number of perfect marks" */}
                                            {mode === 'cumulative' && (() => {
                                                const maxVal = finalChartData.reduce((acc, curr) => Math.max(acc, (curr['الطالب'] as number) || 0), 0);
                                                const lines = [];
                                                
                                                // Dynamic step size to prevent vertical crowding
                                                let step = 6;
                                                if (maxVal > 150) {
                                                    step = 36; // every 6× ممتاز
                                                } else if (maxVal > 80) {
                                                    step = 24; // every 4× ممتاز
                                                } else if (maxVal > 40) {
                                                    step = 18; // every 3× ممتاز
                                                } else if (maxVal > 20) {
                                                    step = 12; // every 2× ممتاز
                                                }

                                                const limit = Math.min(maxVal + step, 300);
                                                for (let val = step; val <= limit; val += step) {
                                                    lines.push(
                                                        <ReferenceLine
                                                            key={val}
                                                            y={val}
                                                            stroke="#10b981"
                                                            strokeWidth={0.5}
                                                            strokeDasharray="3 3"
                                                            label={{
                                                                value: `معادل ${val / 6}×ممتاز`,
                                                                position: 'right',
                                                                fill: '#059669',
                                                                fontSize: 7.5,
                                                                fontWeight: 700,
                                                            }}
                                                        />
                                                    );
                                                }
                                                return lines;
                                            })()}

                                            {/* Main student line */}
                                            <Line
                                                type="monotone"
                                                dataKey="الطالب"
                                                name={selectedStudent?.fullName?.split(' ').slice(0, 2).join(' ') || 'الطالب'}
                                                stroke={COLOR_STUDENT}
                                                strokeWidth={2.5}
                                                dot={(props: any) => {
                                                    const { cx, cy, payload, index } = props;
                                                    const key = `dot-${index}`;
                                                    if (!cx || !cy) return <g key={key} />;

                                                    // Special session types — large colored dots
                                                    if (payload.isHoliday) {
                                                        return <circle key={key} cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2} />;
                                                    }
                                                    if (payload.isSheikhAbsent) {
                                                        return <circle key={key} cx={cx} cy={cy} r={7} fill="#dc2626" stroke="#fff" strokeWidth={2} />;
                                                    }
                                                    if (payload.isStudentAbsent) {
                                                        return <circle key={key} cx={cx} cy={cy} r={7} fill="#ec4899" stroke="#fff" strokeWidth={2} />;
                                                    }
                                                    if (payload.isUnregistered) {
                                                        // Diamond shape for unregistered
                                                        return (
                                                            <rect
                                                                key={key}
                                                                x={cx - 5} y={cy - 5}
                                                                width={10} height={10}
                                                                fill="#94a3b8" stroke="#fff" strokeWidth={1.5}
                                                                transform={`rotate(45 ${cx} ${cy})`}
                                                            />
                                                        );
                                                    }
                                                    if (payload.isNoSession) {
                                                        return <circle key={key} cx={cx} cy={cy} r={3} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={1} />;
                                                    }
                                                    // Normal scored session — color by rating
                                                    const sc = payload.studentScore as number | null;
                                                    const dotColor = sc !== null && sc !== undefined ? (RATING_COLOR[sc] || COLOR_STUDENT) : COLOR_STUDENT;
                                                    const dotR = sc === 6 ? 6.5 : sc === 1 ? 6 : 4.5;
                                                    return <circle key={key} cx={cx} cy={cy} r={dotR} fill={dotColor} stroke="#fff" strokeWidth={1.5} />;
                                                }}
                                                activeDot={{ r: 8, fill: COLOR_STUDENT, stroke: 'white', strokeWidth: 2 }}
                                                connectNulls={true}
                                            />

                                            {/* Group average line */}
                                            <Line
                                                type="monotone"
                                                dataKey="متوسط الفوج"
                                                name={selectedStudent?.fullName?.split(' ').slice(0, 2).join(' ') || 'الطالب'}
                                                stroke={COLOR_GROUP}
                                                strokeWidth={1.5}
                                                strokeDasharray="6 3"
                                                dot={false}
                                                connectNulls={true}
                                            />

                                            {/* Other student lines removed to keep focus on student vs average */}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Legend description */}
                            <div style={{
                                display: 'flex',
                                gap: 12,
                                marginTop: 12,
                                fontSize: '9px',
                                color: '#64748b',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '10px',
                            }}>
                                {/* Lines */}
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 20, height: 2.5, background: COLOR_STUDENT, display: 'inline-block', borderRadius: 2 }} />
                                    {selectedStudent?.fullName?.split(' ').slice(0, 2).join(' ')}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 20, height: 1.5, background: COLOR_GROUP, display: 'inline-block', borderRadius: 2, borderTop: `1.5px dashed ${COLOR_GROUP}` }} />
                                    متوسط الفوج
                                </span>

                                <span style={{ color: '#cbd5e1' }}>|</span>

                                {/* Rating dots */}
                                {([6,5,4,3,2,1] as const).map(sc => (
                                    <span key={sc} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <span style={{ width: sc === 6 ? 11 : 8, height: sc === 6 ? 11 : 8, borderRadius: '50%', background: RATING_COLOR[sc], display: 'inline-block', flexShrink: 0, border: '1.5px solid #fff', boxShadow: '0 0 0 1px #e2e8f0' }} />
                                        {EVAL_LABEL[sc]}
                                    </span>
                                ))}

                                {showAllDays && (
                                    <>
                                        <span style={{ color: '#cbd5e1' }}>|</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                            عطلة رسمية
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                                            غياب الشيخ
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ec4899', display: 'inline-block' }} />
                                            غياب الطالب
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <span style={{ width: 9, height: 9, background: '#94a3b8', display: 'inline-block', transform: 'rotate(45deg)' }} />
                                            حصة غير مسجّلة
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e2e8f0', display: 'inline-block', border: '1px solid #cbd5e1' }} />
                                            يوم بلا حلقة
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
