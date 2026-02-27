"use client";

import React, { useMemo, useState } from 'react';
import { format, addDays, getDay, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, Filter, Users } from 'lucide-react';
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

        dateRange.forEach(dateStr => {
            if (!groupDates.has(dateStr)) return; // no session for this group

            const daySess = (dailySessions as any)[dateStr];
            if (!daySess) { absences++; return; }

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
                    }
                    if (!rec.review && rec.memorization) {
                        evalSequence.push(rec.memorization);
                    }
                } else {
                    // Student not in records → absent
                    absences++;
                    foundInSession = true;
                }
            });

            if (!foundInSession) absences++;
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
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
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
                                    </div>

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
