"use client";

import React, { useMemo, useState } from 'react';
import { format, addDays, getDay, subDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, Filter, Users } from 'lucide-react';
import { AttendanceCalendar } from '@/components/ui/AttendanceCalendar';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AtRiskStudent {
    id: string;
    name: string;
    group: string;
    riskLevel: 'high' | 'medium' | 'stable';
    reasons: string[];
    absencesLast2Weeks: number;
    totalSessionsLast2Weeks: number;
    consecutiveNotMem: number;
    absenceRate: number;
    recommendation: string;
    guardianName?: string;
    phone1?: string;
    phone2?: string;
    recentEvaluations?: string[];
    absentDates?: string[];
    notMemDates?: string[];
    recentSessionDetails?: Array<{
        date: string;
        attendance: string;
        memorization?: string;
        behavior?: string;
        sessionType?: string;
    }>;
    behaviorSummary?: {
        calm: number;
        ok: number;
        naughty: number;
    };
    pageNumber?: string;
    memorizedSurahsCount?: number;
    groupAvgAbsenceRate?: number;
    groupAvgNotMemRate?: number;
}

// ─── Risk Computation ─────────────────────────────────────────────────────────
export function computeAtRiskStudents(
    students: any[],
    dailySessions: any,
    sheikhs: { group: string; uids: Set<string> }[],
    referenceDate: Date
): AtRiskStudent[] {
    if (!students || !dailySessions) return [];

    // Last 2 weeks: 14 days back from reference
    const endDate = referenceDate;
    const startDate = subDays(endDate, 13);
    const dateRange: string[] = [];
    for (let i = 0; i < 14; i++) {
        dateRange.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
    }

    // Build group → session dates (real sessions only)
    const groupSessionDates = new Map<string, Set<string>>();
    sheikhs.forEach(sh => groupSessionDates.set(sh.group, new Set()));

    // Build group → ownerId mapping
    const ownerGroupMap = new Map<string, string>();
    sheikhs.forEach(sh => sh.uids.forEach(uid => ownerGroupMap.set(uid, sh.group)));

    if (dailySessions) {
        dateRange.forEach(dateStr => {
            const daySess = (dailySessions as any)[dateStr];
            if (!daySess) return;
            Object.values(daySess as Record<string, any>).forEach((session: any) => {
                if (!session) return;
                const sType = session.sessionType;
                const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                if (!isReal) return;
                const grp = ownerGroupMap.get(session.ownerId);
                if (grp) groupSessionDates.get(grp)?.add(dateStr);
            });
        });
    }

    // Per-student tracking
    // ── Pass 1: collect stats for ALL active students to compute group averages ──
    const groupAbsenceRates = new Map<string, number[]>();
    const groupNotMemRates = new Map<string, number[]>();

    (students || []).filter(s => s.status === 'نشط').forEach(student => {
        const grp = (student as any).group || student.groupName || '';
        const groupDates = groupSessionDates.get(grp);
        if (!groupDates || groupDates.size === 0) return;
        let abs = 0; let notMem = 0; let totalSess = 0;
        dateRange.forEach(dateStr => {
            if (!groupDates.has(dateStr)) return;
            totalSess++;
            const daySess = (dailySessions as any)[dateStr];
            if (!daySess) { abs++; return; }
            let found = false;
            Object.values(daySess as Record<string, any>).forEach((session: any) => {
                if (found || !session) return;
                const grpOwner = ownerGroupMap.get(session.ownerId);
                if (grpOwner !== grp) return;
                const sType = session.sessionType;
                if (sType !== 'حصة أساسية' && sType !== 'حصة تعويضية' && sType !== 'حصة إضافية') return;
                const records: any[] = Array.isArray(session.records) ? session.records : session.records ? Object.values(session.records) : [];
                const rec = records.find((r: any) => r.studentId === student.id);
                found = true;
                if (!rec || rec.attendance === 'غائب' || rec.attendance === 'غياب') abs++;
                if (rec?.memorization === 'لم يحفظ') notMem++;
            });
            if (!found) abs++;
        });
        const ar = totalSess > 0 ? Math.round((abs / totalSess) * 100) : 0;
        const nm = totalSess > 0 ? Math.round((notMem / totalSess) * 100) : 0;
        if (!groupAbsenceRates.has(grp)) groupAbsenceRates.set(grp, []);
        if (!groupNotMemRates.has(grp)) groupNotMemRates.set(grp, []);
        groupAbsenceRates.get(grp)!.push(ar);
        groupNotMemRates.get(grp)!.push(nm);
    });

    const getGroupAvg = (map: Map<string, number[]>, grp: string) => {
        const arr = map.get(grp) || [];
        return arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    };

    // ── Pass 2: compute at-risk students ──────────────────────────────────────
    const results: AtRiskStudent[] = [];

    (students || []).filter(s => s.status === 'نشط').forEach(student => {
        const grp = (student as any).group || student.groupName || '';
        const groupDates = groupSessionDates.get(grp);
        if (!groupDates || groupDates.size === 0) return;

        let absences = 0;
        let notMemConsecutive = 0;
        let maxNotMemConsecutive = 0;
        let appeared = false;

        // Track evaluations in order
        const evalSequence: string[] = [];
        const absentDates: string[] = [];
        const notMemDates: string[] = [];
        const recentSessionDetails: Array<{
            date: string;
            attendance: string;
            memorization?: string;
            behavior?: string;
            sessionType?: string;
        }> = [];
        let calmCount = 0;
        let okCount = 0;
        let naughtyCount = 0;

        dateRange.forEach(dateStr => {
            if (!groupDates.has(dateStr)) return; // no session for this group

            const daySess = (dailySessions as any)[dateStr];
            if (!daySess) {
                absences++;
                absentDates.push(dateStr);
                recentSessionDetails.push({
                    date: dateStr,
                    attendance: 'غائب',
                    memorization: 'لا يوجد',
                    behavior: 'لا يوجد',
                    sessionType: 'حصة أساسية'
                });
                return;
            }

            let foundInSession = false;
            Object.values(daySess as Record<string, any>).forEach((session: any) => {
                if (!session || foundInSession) return;
                const grpOwner = ownerGroupMap.get(session.ownerId);
                if (grpOwner !== grp) return;

                const sType = session.sessionType;
                const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                if (!isReal) return;

                const records: any[] = Array.isArray(session.records)
                    ? session.records
                    : session.records ? Object.values(session.records) : [];

                const rec = records.find((r: any) => r.studentId === student.id);
                if (rec) {
                    foundInSession = true;
                    appeared = true;
                    if (rec.attendance === 'غائب' || rec.attendance === 'غياب') {
                        absences++;
                        absentDates.push(dateStr);
                    }
                    if (!rec.review && rec.memorization) {
                        evalSequence.push(rec.memorization);
                        if (rec.memorization === 'لم يحفظ') {
                            notMemDates.push(dateStr);
                        }
                    }
                    if (rec.behavior) {
                        if (rec.behavior === 'هادئ') calmCount++;
                        else if (rec.behavior === 'مقبول' || rec.behavior === 'متوسط') okCount++;
                        else if (rec.behavior === 'مشاغب' || rec.behavior === 'غير منضبط') naughtyCount++;
                    }
                    recentSessionDetails.push({
                        date: dateStr,
                        attendance: rec.attendance || 'غير مسجل',
                        memorization: rec.memorization || 'لا يوجد',
                        behavior: rec.behavior || 'لا يوجد',
                        sessionType: sType
                    });
                } else {
                    // Student not in records → absent
                    absences++;
                    absentDates.push(dateStr);
                    foundInSession = true;
                    recentSessionDetails.push({
                        date: dateStr,
                        attendance: 'غائب',
                        memorization: 'لا يوجد',
                        behavior: 'لا يوجد',
                        sessionType: sType
                    });
                }
            });

            if (!foundInSession) {
                absences++;
                absentDates.push(dateStr);
                recentSessionDetails.push({
                    date: dateStr,
                    attendance: 'غائب',
                    memorization: 'لا يوجد',
                    behavior: 'لا يوجد',
                    sessionType: 'حصة أساسية'
                });
            }
        });

        // Calculate consecutive "لم يحفظ"
        let currentStreak = 0;
        evalSequence.forEach(eval_ => {
            if (eval_ === 'لم يحفظ') {
                currentStreak++;
                maxNotMemConsecutive = Math.max(maxNotMemConsecutive, currentStreak);
            } else {
                currentStreak = 0;
            }
        });

        const totalSessions = groupDates.size;
        const absenceRate = totalSessions > 0 ? Math.round((absences / totalSessions) * 100) : 0;

        // Determine risk level
        const reasons: string[] = [];
        let riskLevel: 'high' | 'medium' | 'stable' = 'stable';

        // High risk: absent >= 40% of sessions, OR >= 3 consecutive notMem
        if (absenceRate >= 40) {
            reasons.push(`غائب ${absences} من ${totalSessions} حصة (${absenceRate}%)`);
            riskLevel = 'high';
        }
        if (maxNotMemConsecutive >= 3) {
            reasons.push(`"لم يحفظ" ${maxNotMemConsecutive} مرات متتالية`);
            riskLevel = 'high';
        }

        // Medium risk: absent >= 25% of sessions, OR >= 2 consecutive notMem
        if (riskLevel === 'stable') {
            if (absenceRate >= 25) {
                reasons.push(`غائب ${absences} من ${totalSessions} حصة (${absenceRate}%)`);
                riskLevel = 'medium';
            }
            if (maxNotMemConsecutive >= 2) {
                reasons.push(`"لم يحفظ" ${maxNotMemConsecutive} مرات متتالية`);
                riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
            }
        }

        if (riskLevel === 'stable') return; // Skip stable students

        // Recommendation
        let recommendation = '';
        if (riskLevel === 'high') {
            recommendation = 'يحتاج تواصل عاجل مع ولي الأمر ومتابعة مكثفة';
        } else {
            recommendation = 'يحتاج تنبيه ومتابعة من الشيخ';
        }

        results.push({
            id: student.id,
            name: student.fullName,
            group: grp,
            riskLevel,
            reasons,
            absencesLast2Weeks: absences,
            totalSessionsLast2Weeks: totalSessions,
            consecutiveNotMem: maxNotMemConsecutive,
            absenceRate,
            recommendation,
            guardianName: student.guardianName || 'غير محدد',
            phone1: student.phone1 || '',
            phone2: student.phone2 || '',
            recentEvaluations: evalSequence,
            absentDates,
            notMemDates,
            recentSessionDetails,
            behaviorSummary: {
                calm: calmCount,
                ok: okCount,
                naughty: naughtyCount
            },
            pageNumber: student.pageNumber,
            memorizedSurahsCount: student.memorizedSurahsCount,
            groupAvgAbsenceRate: getGroupAvg(groupAbsenceRates, grp),
            groupAvgNotMemRate: getGroupAvg(groupNotMemRates, grp),
        });
    });

    return results.sort((a, b) => {
        if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
        if (a.riskLevel !== 'high' && b.riskLevel === 'high') return 1;
        return b.absenceRate - a.absenceRate;
    });
}

// ─── Early Warning View Component ─────────────────────────────────────────────
interface EarlyWarningProps {
    atRiskStudents: AtRiskStudent[];
    sheikhs: { group: string; displayName: string }[];
    onStudentClick?: (id: string, name: string, group: string) => void;
}

export function EarlyWarningView({ atRiskStudents, sheikhs, onStudentClick }: EarlyWarningProps) {
    const [groupFilter, setGroupFilter] = useState('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showOnlyHigh, setShowOnlyHigh] = useState(false);

    const filtered = useMemo(() => {
        let list = atRiskStudents;
        if (groupFilter !== 'all') list = list.filter(s => s.group === groupFilter);
        if (showOnlyHigh) list = list.filter(s => s.riskLevel === 'high');
        return list;
    }, [atRiskStudents, groupFilter, showOnlyHigh]);

    const highCount = atRiskStudents.filter(s => s.riskLevel === 'high').length;
    const mediumCount = atRiskStudents.filter(s => s.riskLevel === 'medium').length;

    if (atRiskStudents.length === 0) {
        return (
            <div className="text-center py-16 space-y-3">
                <ShieldCheck className="h-14 w-14 text-emerald-400 mx-auto" />
                <div className="font-bold text-lg text-emerald-700">لا يوجد طلاب في خطر 🎉</div>
                <p className="text-sm text-muted-foreground">جميع الطلاب مستقرون في الأسبوعين الأخيرين</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary badges */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 rounded-xl p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-rose-600">{highCount}</div>
                    <div className="text-[10px] font-bold text-rose-500">🔴 في خطر</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-amber-600">{mediumCount}</div>
                    <div className="text-[10px] font-bold text-amber-500">🟡 يحتاج انتباه</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-3 text-center shadow-sm">
                    <div className="text-2xl font-black text-emerald-600">{atRiskStudents.length}</div>
                    <div className="text-[10px] font-bold text-emerald-500">📋 إجمالي</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 bg-card border rounded-xl px-3 py-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                    aria-label="تصفية حسب الفوج"
                    value={groupFilter}
                    onChange={e => setGroupFilter(e.target.value)}
                    className="text-xs border rounded-lg px-3 py-1.5 bg-background font-bold"
                    dir="rtl"
                >
                    <option value="all">🏫 جميع الأفواج</option>
                    {sheikhs.map(sh => <option key={sh.group} value={sh.group}>{sh.group} — {sh.displayName}</option>)}
                </select>
                <button
                    onClick={() => setShowOnlyHigh(v => !v)}
                    className={cn(
                        "text-[11px] font-bold px-3 py-1 rounded-lg border transition-colors",
                        showOnlyHigh ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-white border-border hover:bg-muted"
                    )}
                >
                    {showOnlyHigh ? '🔴 في خطر فقط' : '🔴 عرض في خطر فقط'}
                </button>
                <span className="text-[10px] text-muted-foreground mr-auto">{filtered.length} طالب</span>
            </div>

            {/* Students list */}
            <div className="space-y-2">
                {filtered.map(student => {
                    const isExpanded = expandedId === student.id;
                    const riskConfig = student.riskLevel === 'high'
                        ? { bg: 'bg-gradient-to-r from-rose-50 to-red-50', border: 'border-rose-200', icon: '🔴', iconColor: 'text-rose-600', badge: 'bg-rose-100 text-rose-700' }
                        : { bg: 'bg-gradient-to-r from-amber-50 to-yellow-50', border: 'border-amber-200', icon: '🟡', iconColor: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' };

                    return (
                        <div key={student.id} className={cn("rounded-xl border overflow-hidden transition-all hover:shadow-md", riskConfig.bg, riskConfig.border)}>
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : student.id)}
                                className="w-full p-3 flex items-center gap-3 text-right"
                            >
                                <span className="text-xl shrink-0">{riskConfig.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); onStudentClick?.(student.id, student.name, student.group); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onStudentClick?.(student.id, student.name, student.group); } }}
                                            className="font-bold text-sm truncate hover:underline text-right cursor-pointer"
                                            title="فتح ملف الطالب"
                                        >{student.name}</span>
                                        <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded-md font-medium shrink-0">{student.group}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{student.reasons[0]}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", riskConfig.badge)}>
                                        {student.riskLevel === 'high' ? 'في خطر' : 'يحتاج انتباه'}
                                    </span>
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="px-3 pb-3 border-t border-dashed space-y-2 animate-in fade-in-50 duration-200" style={{ borderColor: 'inherit' }}>
                                    {/* Details */}
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
                                        <div className="bg-white/80 rounded-lg p-2 text-center border">
                                            <div className="text-lg font-black">{student.absencesLast2Weeks}</div>
                                            <div className="text-[9px] text-muted-foreground">غيابات (أسبوعين)</div>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2 text-center border">
                                            <div className="text-lg font-black">{student.totalSessionsLast2Weeks}</div>
                                            <div className="text-[9px] text-muted-foreground">إجمالي الحصص</div>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2 text-center border">
                                            <div className="text-lg font-black text-rose-600">{student.absenceRate}%</div>
                                            <div className="text-[9px] text-muted-foreground">نسبة الغياب</div>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2 text-center border">
                                            <div className="text-lg font-black text-amber-600">{student.consecutiveNotMem}</div>
                                            <div className="text-[9px] text-muted-foreground">"لم يحفظ" متتالية</div>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2 text-center border">
                                            <div className="text-lg font-black text-indigo-600">{student.pageNumber || '—'}</div>
                                            <div className="text-[9px] text-muted-foreground">الصفحة الحالية</div>
                                        </div>
                                        <div className="bg-white/80 rounded-lg p-2 text-center border">
                                            <div className="text-lg font-black text-teal-600">{student.memorizedSurahsCount || 0}</div>
                                            <div className="text-[9px] text-muted-foreground">السور المحفوظة</div>
                                        </div>
                                    </div>

                                    {/* Group Comparison Bars */}
                                    {(student.groupAvgAbsenceRate !== undefined) && (
                                        <div className="bg-white/80 rounded-lg p-3 border space-y-2">
                                            <div className="text-[10px] font-bold text-muted-foreground">📊 مقارنة بمتوسط الفوج:</div>
                                            {/* Absence rate comparison */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="font-semibold">نسبة الغياب</span>
                                                    <span className="font-bold">
                                                        <span className={student.absenceRate > (student.groupAvgAbsenceRate || 0) ? 'text-rose-600' : 'text-emerald-600'}>
                                                            {student.absenceRate}%
                                                        </span>
                                                        <span className="text-muted-foreground"> / متوسط الفوج: {student.groupAvgAbsenceRate}%</span>
                                                    </span>
                                                </div>
                                                <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                    {/* Group avg marker */}
                                                    <div
                                                        className="absolute top-0 h-full bg-gray-300 rounded-full"
                                                        style={{ width: `${Math.min(student.groupAvgAbsenceRate || 0, 100)}%` }}
                                                    />
                                                    {/* Student bar */}
                                                    <div
                                                        className={cn("absolute top-0 h-full rounded-full opacity-80", student.absenceRate > (student.groupAvgAbsenceRate || 0) ? 'bg-rose-500' : 'bg-emerald-500')}
                                                        style={{ width: `${Math.min(student.absenceRate, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="text-[9px] text-muted-foreground">
                                                    {student.absenceRate > (student.groupAvgAbsenceRate || 0)
                                                        ? `⚠️ أعلى من متوسط الفوج بـ ${student.absenceRate - (student.groupAvgAbsenceRate || 0)}%`
                                                        : `✅ أقل من متوسط الفوج بـ ${(student.groupAvgAbsenceRate || 0) - student.absenceRate}%`}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Reasons */}
                                    <div className="bg-white/60 rounded-lg p-2 border space-y-1">
                                        <div className="text-[10px] font-bold text-muted-foreground">📋 الأسباب:</div>
                                        {student.reasons.map((r, i) => (
                                            <div key={i} className="text-xs flex items-start gap-1.5">
                                                <span className="text-rose-400 mt-0.5">•</span>
                                                <span>{r}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Guardian Info & Quick WhatsApp Contact */}
                                    <div className="bg-white/80 rounded-lg p-3 border space-y-2">
                                        <div className="text-[10px] font-bold text-muted-foreground">👤 بيانات الولي والتواصل:</div>
                                        <div className="flex flex-col gap-2">
                                            <div className="text-xs space-y-1">
                                                <div><strong className="text-muted-foreground">اسم الولي:</strong> {student.guardianName || 'غير محدد'}</div>
                                                <div><strong className="text-muted-foreground">رقم الهاتف:</strong> {student.phone1 || 'غير متوفر'} {student.phone2 ? ` / ${student.phone2}` : ''}</div>
                                            </div>
                                            {(student.phone1 || student.phone2) && (() => {
                                                const formatPhone = (p: string) => p.replace(/[\s\-().]/g, '').replace(/^00213/, '213').replace(/^0/, '213');
                                                const buildMsg = (phone: string) => {
                                                    const urgency = student.riskLevel === 'high' ? 'عاجل' : 'تنبيه';
                                                    const statLines = [];
                                                    if (student.absencesLast2Weeks > 0) statLines.push(`• غاب ${student.absencesLast2Weeks} من ${student.totalSessionsLast2Weeks} حصة (${student.absenceRate}%)`);
                                                    if (student.consecutiveNotMem > 0) statLines.push(`• لم يحفظ درسه ${student.consecutiveNotMem} مرات متتالية`);
                                                    return encodeURIComponent(
                                                        `السلام عليكم ورحمة الله وبركاته،\n` +
                                                        `معكم معلم القرآن من مدرسة الإمام الشافعي القرآنية.\n\n` +
                                                        `[${urgency}] بخصوص ابنكم الطالب: ${student.name}\n\n` +
                                                        `📊 إحصائيات آخر أسبوعين:\n${statLines.join('\n')}\n\n` +
                                                        `نرجو التواصل ومتابعة الابن في المنزل للحفاظ على مستواه.\nبارك الله فيكم.`
                                                    );
                                                };
                                                return (
                                                    <div className="flex flex-wrap gap-2">
                                                        {student.phone1 && (
                                                            <>
                                                                <a
                                                                    href={`https://wa.me/${formatPhone(student.phone1)}?text=${buildMsg(student.phone1)}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                                                                >
                                                                    <span>💬</span>
                                                                    واتساب (ر1)
                                                                </a>
                                                                <a
                                                                    href={`tel:${student.phone1}`}
                                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors"
                                                                >
                                                                    <span>📞</span>
                                                                    اتصال (ر1)
                                                                </a>
                                                            </>
                                                        )}
                                                        {student.phone2 && (
                                                            <>
                                                                <a
                                                                    href={`https://wa.me/${formatPhone(student.phone2)}?text=${buildMsg(student.phone2)}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors"
                                                                >
                                                                    <span>💬</span>
                                                                    واتساب (ر2)
                                                                </a>
                                                                <a
                                                                    href={`tel:${student.phone2}`}
                                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-[11px] transition-colors"
                                                                >
                                                                    <span>📞</span>
                                                                    اتصال (ر2)
                                                                </a>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>


                                    {/* Recent Evaluations */}
                                    {student.recentEvaluations && student.recentEvaluations.length > 0 && (
                                        <div className="bg-white/80 rounded-lg p-3 border space-y-2">
                                            <div className="text-[10px] font-bold text-muted-foreground">📈 سجل الحفظ والتقييمات الأخيرة (آخر أسبوعين):</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {student.recentEvaluations.map((ev, idx) => {
                                                    let badgeClass = "bg-gray-100 text-gray-700 border-gray-200";
                                                    if (ev === 'ممتاز') badgeClass = "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400";
                                                    else if (ev === 'جيد جدا' || ev === 'جيد جداً') badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400";
                                                    else if (ev === 'جيد') badgeClass = "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400";
                                                    else if (ev === 'مقبول') badgeClass = "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400";
                                                    else if (ev === 'لم يحفظ') badgeClass = "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400";
                                                    return (
                                                        <span key={idx} className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", badgeClass)}>
                                                            {ev}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Attendance Calendar */}
                                    {student.recentSessionDetails && student.recentSessionDetails.length > 0 && (
                                        <div className="bg-white/80 rounded-lg p-3 border space-y-2">
                                            <div className="text-[10px] font-bold text-muted-foreground">🗓️ جدول الحضور المرئي (آخر أسبوعين):</div>
                                            <AttendanceCalendar sessions={student.recentSessionDetails} studentName={student.name} />
                                        </div>
                                    )}

                                    {/* Timeline table of recent sessions */}
                                    {student.recentSessionDetails && student.recentSessionDetails.length > 0 && (
                                        <div className="bg-white/80 rounded-lg p-3 border space-y-2">
                                            <div className="text-[10px] font-bold text-muted-foreground">📅 تفاصيل الحصص الأخيرة بالتفصيل:</div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-right text-xs border-collapse">
                                                    <thead>
                                                        <tr className="border-b text-[9px] text-muted-foreground">
                                                            <th className="pb-1 font-bold">التاريخ</th>
                                                            <th className="pb-1 font-bold text-center">نوع الحصة</th>
                                                            <th className="pb-1 font-bold text-center">الحضور</th>
                                                            <th className="pb-1 font-bold text-center">تقييم الحفظ</th>
                                                            <th className="pb-1 font-bold text-center">السلوك</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {student.recentSessionDetails.map((sess, idx) => {
                                                            let attColor = "text-muted-foreground";
                                                            if (sess.attendance === 'حاضر') attColor = "text-emerald-600 font-bold";
                                                            else if (sess.attendance === 'متأخر') attColor = "text-amber-600 font-bold";
                                                            else if (sess.attendance === 'غياب' || sess.attendance === 'غائب') attColor = "text-rose-600 font-bold";
                                                            else if (sess.attendance === 'تعويض') attColor = "text-blue-600 font-bold";

                                                            let memColor = "text-muted-foreground";
                                                            if (sess.memorization === 'ممتاز' || sess.memorization === 'جيد جدا' || sess.memorization === 'جيد جداً') memColor = "text-emerald-600 font-bold";
                                                            else if (sess.memorization === 'لم يحفظ') memColor = "text-rose-600 font-bold";

                                                            return (
                                                                <tr key={idx} className="border-b last:border-b-0 border-dashed border-muted/50 hover:bg-muted/30">
                                                                    <td className="py-1.5 font-semibold font-body text-[11px]">
                                                                        {(() => {
                                                                            try {
                                                                                return format(parseISO(sess.date), 'dd MMM yyyy', { locale: ar });
                                                                            } catch {
                                                                                return sess.date;
                                                                            }
                                                                        })()}
                                                                    </td>
                                                                    <td className="py-1.5 text-center text-[10px] text-muted-foreground font-body">{sess.sessionType}</td>
                                                                    <td className={cn("py-1.5 text-center", attColor)}>{sess.attendance}</td>
                                                                    <td className={cn("py-1.5 text-center", memColor)}>{sess.memorization}</td>
                                                                    <td className="py-1.5 text-center text-[11px]">{sess.behavior}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sheikh Script/Guidance */}
                                    <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-200/50 space-y-1.5">
                                        <div className="text-[10px] font-bold text-blue-800">🗣️ إرشاد للتحدث مع الولي:</div>
                                        <p className="text-xs text-blue-900 leading-relaxed">
                                            {student.riskLevel === 'high' ? (
                                                <>
                                                    تواصل عاجل مع الولي عبر الهاتف أو واتساب. نبّهه أن الطالب في <strong>خطر تراجع المستوى</strong> بسبب {student.reasons.join(' و ')}. اطلب منه تشجيع الطالب ومتابعته يومياً في المنزل لتدارك النقص قبل تفاقم الوضع.
                                                </>
                                            ) : (
                                                <>
                                                    أرسل تنبيهاً خفيفاً للولي بخصوص {student.reasons.join(' و ')}، مع حثّه على ضرورة انضباط الابن في التسميع والحضور لتجنب التأخر الدراسي والحفاظ على استقراره.
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    {/* Recommendation */}
                                    <div className={cn("rounded-lg p-2 border text-xs font-bold flex items-center gap-2",
                                        student.riskLevel === 'high' ? "bg-rose-100/50 text-rose-700 border-rose-200" : "bg-amber-100/50 text-amber-700 border-amber-200"
                                    )}>
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        {student.recommendation}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
