"use client";

import React, { useState, useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { surahs } from '@/lib/surahs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Loader2, Trophy, Settings2, Calculator, Printer,
    Search, FileText, ArrowUpDown, ArrowUp, ArrowDown,
    Download, ChevronDown, ChevronUp, SlidersHorizontal
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

// ─── Default scoring values (editable in UI) ────────────────────────────────
const DEFAULT_PERF: Record<string, number> = {
    'ممتاز': 10,
    'جيد جداً': 8,
    'جيد': 6,
    'حسن': 4,
    'مقبول': 4,
    'متوسط': 2,
    'ضعيف': 2,
    'لم يحفظ': 0,
    'غير محفوظ': 0,
};

// ─── Types ────────────────────────────────────────────────────────────────────
type SortField = 'name' | 'surahScore' | 'dailyScore' | 'attendanceScore' | 'tafseerScore' | 'surahEvalScore' | 'totalScore';

interface StudentResult {
    id: string;
    name: string;
    group: string;
    surahScore: number;
    dailyScore: number;
    attendanceScore: number;
    tafseerScore: number;
    surahEvalScore: number;
    totalScore: number;
    details: {
        surahs: { id: string | number; name: string; evalStr: string; points: number }[];
        surahAvg: string;
        dailyAvg: string;
        evaluatedDaily: number;
        evaluatedWeekly: number;
        presents: number;
        absences: number;
        lates: number;
        expectedDays: number;
    };
}

export default function CompetitionPage() {
    const { user } = useAuth();
    const { students, dailySessions, weeklyOutcomes, surahProgress } = useStudentContext();

    // ── Subject Coefficients ────────────────────────────────────────────────
    const [coefSurah, setCoefSurah] = useState(4);
    const [coefDaily, setCoefDaily] = useState(3);
    const [coefAttendance, setCoefAttendance] = useState(1);
    const [coefTafseer, setCoefTafseer] = useState(2);
    const [coefSurahEval, setCoefSurahEval] = useState(2);

    // ── Date Range ──────────────────────────────────────────────────────────
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // ── Surah selection ─────────────────────────────────────────────────────
    const [selectedSurahs, setSelectedSurahs] = useState<(string | number)[]>([]);
    const [surahSearch, setSurahSearch] = useState('');

    // ── Customizable scoring ────────────────────────────────────────────────
    const [perfPoints, setPerfPoints] = useState<Record<string, number>>({ ...DEFAULT_PERF });
    const [attBase, setAttBase] = useState(10);
    const [attAbsent, setAttAbsent] = useState(1.0);
    const [attLate, setAttLate] = useState(0.5);
    const [showScoring, setShowScoring] = useState(false);

    // ── Per-student manual grades ───────────────────────────────────────────
    const [tafseerGrades, setTafseerGrades] = useState<Record<string, number>>({});
    const [surahEvalGrades, setSurahEvalGrades] = useState<Record<string, number>>({});

    // ── Results & sorting ───────────────────────────────────────────────────
    const [isCalculating, setIsCalculating] = useState(false);
    const [results, setResults] = useState<StudentResult[]>([]);
    const [printingStudent, setPrintingStudent] = useState<StudentResult | null>(null);
    const [sortField, setSortField] = useState<SortField>('totalScore');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // ── Derived ─────────────────────────────────────────────────────────────
    const myStudents = useMemo(
        () => students.filter(s => s.ownerId === user?.uid),
        [students, user]
    );

    const filteredSurahs = useMemo(() => {
        const q = surahSearch.trim();
        return q ? surahs.filter(s => s.name.includes(q)) : surahs;
    }, [surahSearch]);

    const sortedResults = useMemo(() => {
        return [...results].sort((a, b) => {
            const av = (a as any)[sortField] ?? 0;
            const bv = (b as any)[sortField] ?? 0;
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === 'asc' ? av - bv : bv - av;
        });
    }, [results, sortField, sortDir]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const toggleSurah = (id: string | number) =>
        setSelectedSurahs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
    };

    // ── Calculation ──────────────────────────────────────────────────────────
    const calculateResults = () => {
        setIsCalculating(true);
        setTimeout(() => {
            const start = parseISO(startDate);
            const end = parseISO(endDate);
            const datesToProcess: string[] = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                datesToProcess.push(format(d, 'yyyy-MM-dd'));
            }

            const calculated: StudentResult[] = myStudents.map(student => {
                // 1. Surah Score
                let surahSum = 0;
                const progress = surahProgress[student.id] || {};
                const surahsDetails = selectedSurahs.map(surahId => {
                    const evalStr = progress[Number(surahId)]?.evaluation || 'لم يحفظ';
                    const pts = perfPoints[evalStr] ?? 0;
                    surahSum += pts;
                    const surahObj = surahs.find(s => s.id === Number(surahId));
                    return { id: surahId, name: surahObj?.name || `سورة ${surahId}`, evalStr, points: pts };
                });
                const surahAvg = selectedSurahs.length > 0 ? surahSum / selectedSurahs.length : 0;
                const surahFinal = parseFloat((surahAvg * coefSurah).toFixed(2));

                // 2. Daily & Attendance
                let expectedDays = 0, presentDays = 0, absentDays = 0, lateDays = 0;
                let dailyEvalSum = 0, dailyEvalCount = 0;

                datesToProcess.forEach(dateStr => {
                    const sessions = dailySessions[dateStr] ? Object.values(dailySessions[dateStr]) : [];
                    sessions.forEach((session: any) => {
                        const rec = session.records?.find((r: any) => r.studentId === student.id);
                        if (rec) {
                            expectedDays++;
                            const att = rec.attendance;
                            if (att === 'حاضر' || att === 'تعويض') presentDays++;
                            else if (att === 'متأخر') { presentDays++; lateDays++; }
                            else if (att === 'غائب' || att === 'غياب') absentDays++;

                            if (rec.memorization && perfPoints[rec.memorization] !== undefined) {
                                dailyEvalSum += perfPoints[rec.memorization];
                                dailyEvalCount++;
                            }
                        }
                    });
                });

                const attScore = Math.max(0, attBase - absentDays * attAbsent - lateDays * attLate);
                const attFinal = parseFloat((attScore * coefAttendance).toFixed(2));

                // Weekly
                let weeklyEvalSum = 0, weeklyEvalCount = 0;
                datesToProcess.forEach(dateStr => {
                    const outcome = weeklyOutcomes[`${student.id}_${dateStr}`];
                    if (outcome?.evaluation && perfPoints[outcome.evaluation] !== undefined) {
                        weeklyEvalSum += perfPoints[outcome.evaluation];
                        weeklyEvalCount++;
                    }
                });

                const dailyAvg = dailyEvalCount > 0 ? dailyEvalSum / dailyEvalCount : 0;
                const weeklyAvg = weeklyEvalCount > 0 ? weeklyEvalSum / weeklyEvalCount : 0;
                const combinedDA = (dailyEvalCount === 0 && weeklyEvalCount === 0)
                    ? 0
                    : (weeklyEvalCount > 0 ? (dailyAvg + weeklyAvg * 2) / 3 : dailyAvg);
                const dailyFinal = parseFloat((combinedDA * coefDaily).toFixed(2));

                // 3. Tafseer (manual per-student)
                const tGrade = tafseerGrades[student.id] ?? 0;
                const tafseerFin = parseFloat((tGrade * coefTafseer).toFixed(2));

                // 4. Surah Eval (manual per-student)
                const seGrade = surahEvalGrades[student.id] ?? 0;
                const surahEvalFin = parseFloat((seGrade * coefSurahEval).toFixed(2));

                const totalScore = parseFloat((surahFinal + dailyFinal + attFinal + tafseerFin + surahEvalFin).toFixed(2));

                return {
                    id: student.id,
                    name: student.fullName,
                    group: student.groupName,
                    surahScore: surahFinal,
                    dailyScore: dailyFinal,
                    attendanceScore: attFinal,
                    tafseerScore: tafseerFin,
                    surahEvalScore: surahEvalFin,
                    totalScore,
                    details: {
                        surahs: surahsDetails,
                        surahAvg: surahAvg.toFixed(2),
                        dailyAvg: combinedDA.toFixed(2),
                        evaluatedDaily: dailyEvalCount,
                        evaluatedWeekly: weeklyEvalCount,
                        presents: presentDays,
                        absences: absentDays,
                        lates: lateDays,
                        expectedDays,
                    }
                };
            }).sort((a, b) => b.totalScore - a.totalScore);

            setResults(calculated);
            setIsCalculating(false);
        }, 500);
    };

    const handlePrint = () => { setPrintingStudent(null); setTimeout(() => window.print(), 400); };
    const handlePrintIndividual = (r: StudentResult) => { setPrintingStudent(r); setTimeout(() => window.print(), 400); };

    const handleExportCSV = () => {
        const headers = ['الاسم', 'الفوج', 'السور', 'الأوراد', 'الحضور', 'التفسير', 'حفظ السور', 'المجموع'];
        const rows = sortedResults.map(r => [
            `"${r.name}"`, `"${r.group}"`,
            r.surahScore, r.dailyScore, r.attendanceScore, r.tafseerScore, r.surahEvalScore, r.totalScore
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `competition_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    // Access guard
    if (user?.email !== 'admin5@gmail.com') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <Trophy className="w-16 h-16 mx-auto text-slate-300" />
                    <h2 className="text-xl font-bold text-slate-500">هذه الصفحة مخصصة للشيخ إبراهيم فقط</h2>
                </div>
            </div>
        );
    }

    // ─── Individual Print Layout (كشف نقاط رسمي) ──────────────────────────────
    const IndividualPrint = () => {
        if (!printingStudent) return null;
        const rank = results.findIndex(r => r.id === printingStudent.id) + 1;
        const p = printingStudent;

        // Build table rows for the 5 subjects
        const subjectRows = [
            {
                num: 1,
                label: 'الحصيلة اليومية والأسبوعية',
                grade10: parseFloat(p.details.dailyAvg),
                coef: coefDaily,
                total: p.dailyScore,
                notes: `تقييمات يومية: ${p.details.evaluatedDaily} | حصائل أسبوعية: ${p.details.evaluatedWeekly}`,
            },
            {
                num: 2,
                label: 'السور المحفوظة',
                grade10: parseFloat(p.details.surahAvg),
                coef: coefSurah,
                total: p.surahScore,
                notes: p.details.surahs.map(s => `${s.name}: ${s.evalStr}`).join(' | '),
            },
            {
                num: 3,
                label: 'الحضور والالتزام',
                grade10: parseFloat((p.attendanceScore / (coefAttendance || 1)).toFixed(2)),
                coef: coefAttendance,
                total: p.attendanceScore,
                notes: `حضور: ${p.details.presents} | غياب: ${p.details.absences} | تأخر: ${p.details.lates} (من ${p.details.expectedDays} يوم)`,
            },
            {
                num: 4,
                label: 'التفسير',
                grade10: tafseerGrades[p.id] ?? 0,
                coef: coefTafseer,
                total: p.tafseerScore,
                notes: 'أسئلة فهم ومدى استيعاب الطالب',
            },
            {
                num: 5,
                label: 'إمتحان حفظ السور',
                grade10: surahEvalGrades[p.id] ?? 0,
                coef: coefSurahEval,
                total: p.surahEvalScore,
                notes: 'اختيار الطالب لعدة مواضع من كل سورة للتأكد من جودة الحفظ',
            },
        ];

        const maxTotal = subjectRows.reduce((acc, r) => acc + r.coef * 10, 0);
        const generalAvg = maxTotal > 0 ? parseFloat(((p.totalScore / maxTotal) * 20).toFixed(2)) : 0;
        const getRating = (avg: number) => {
            if (avg >= 18) return 'ممتاز';
            if (avg >= 16) return 'جيد جداً';
            if (avg >= 14) return 'جيد';
            if (avg >= 12) return 'مقبول';
            return 'ضعيف';
        };

        return (
            <div style={{ display: 'none' }} className="print:!block" dir="rtl">
                <div style={{
                    fontFamily: 'Arial, sans-serif',
                    maxWidth: '210mm',
                    margin: '0 auto',
                    padding: '12mm 14mm',
                    fontSize: '12pt',
                    color: '#111',
                    direction: 'rtl',
                }}>
                    {/* ── Header ────────────────────────────────────────────── */}
                    <div style={{ textAlign: 'center', borderBottom: '3px double #2d6a2d', paddingBottom: '8pt', marginBottom: '10pt' }}>
                        <div style={{ fontSize: '11pt', color: '#444' }}>المدرسة القرآنية للإمام الشافعي</div>
                        <div style={{ fontSize: '22pt', fontWeight: 'bold', color: '#1a3d1a', margin: '4pt 0' }}>
                            كشف نقاط الإمتحانات الأولية
                        </div>
                        <div style={{ fontSize: '11pt' }}>
                            الموسم الدراسي 1447/1448 هـ الموافق لـ 2025/2026 م
                        </div>
                        <div style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '4pt' }}>
                            {p.group} — المستوى الأول
                        </div>
                    </div>

                    {/* ── Student info ────────────────────────────────────────── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6pt', fontSize: '11pt', borderBottom: '1px solid #999', paddingBottom: '6pt' }}>
                        <span><strong>اسم ولقب الطالب :</strong> {p.name}</span>
                        <span><strong>فوج الشيخ إبراهيم مراد</strong></span>
                    </div>

                    {/* ── Rank ─────────────────────────────────────────────────── */}
                    <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '8pt', fontSize: '11pt', border: '1px solid #ccc', padding: '4pt', background: '#f8f8f8' }}>
                        ترتيب الطالب في الفوج : {rank} / {results.length}
                    </div>

                    {/* ── Subjects Table ──────────────────────────────────────── */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
                        <thead>
                            <tr style={{ background: '#c8e6c9', fontWeight: 'bold', textAlign: 'center' }}>
                                <th style={{ border: '1px solid #888', padding: '5pt 3pt', width: '6%' }}>م</th>
                                <th style={{ border: '1px solid #888', padding: '5pt 3pt', width: '20%' }}>المادة</th>
                                <th style={{ border: '1px solid #888', padding: '5pt 3pt', width: '12%' }}>العلامة/10</th>
                                <th style={{ border: '1px solid #888', padding: '5pt 3pt', width: '12%' }}>المعامل</th>
                                <th style={{ border: '1px solid #888', padding: '5pt 3pt', width: '12%' }}>المجموع</th>
                                <th style={{ border: '1px solid #888', padding: '5pt 3pt' }}>ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjectRows.map(row => (
                                <tr key={row.num} style={{ textAlign: 'center' }}>
                                    <td style={{ border: '1px solid #ccc', padding: '5pt 3pt' }}>{row.num}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5pt 6pt', textAlign: 'right', fontWeight: 500 }}>{row.label}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5pt 3pt', fontWeight: 'bold' }}>{row.grade10}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5pt 3pt' }}>{row.coef}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5pt 3pt', fontWeight: 'bold', background: '#f0f4f0' }}>{row.total}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '5pt 6pt', textAlign: 'right', fontSize: '9.5pt', color: '#444' }}>{row.notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* ── Summary + Sheikh Notes ──────────────────────────────── */}
                    <div style={{ display: 'flex', gap: '12pt', marginTop: '10pt' }}>
                        {/* Summary box */}
                        <div style={{ flex: 1, border: '1px solid #888', padding: '8pt 10pt', fontSize: '11pt', lineHeight: '1.9' }}>
                            <div><strong>المعدل العام :</strong> {generalAvg}</div>
                            <div><strong>التقدير :</strong> {getRating(generalAvg)}</div>
                            <div style={{ marginTop: '6pt' }}><strong>قرار المدرسة :</strong> ___________________</div>
                            <div style={{ marginTop: '10pt' }}><strong>إمضاء ولي الأمر :</strong></div>
                            <div style={{ marginTop: '28pt', borderTop: '1px solid #999', paddingTop: '4pt' }}><strong>إمضاء الإدارة :</strong></div>
                        </div>

                        {/* Sheikh notes */}
                        <div style={{ flex: 1, border: '1px solid #888', padding: '8pt 10pt', fontSize: '11pt' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '6pt', color: '#1a3d1a' }}>ملاحظات الشيخ :</div>
                            <div style={{ minHeight: '90pt', borderBottom: '1px dashed #bbb', paddingBottom: '4pt' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    // ─── Main UI ──────────────────────────────────────────────────────────────
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
            <IndividualPrint />

            <div className={printingStudent ? 'print:hidden' : ''}>
                {/* Header */}
                <div className="flex items-center gap-3 print:hidden">
                    <div className="p-3 bg-purple-100 rounded-2xl text-purple-700"><Trophy className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-2xl font-bold">المسابقة النهائية</h1>
                        <p className="text-sm text-muted-foreground">تقييم شامل بـ 5 مواد — حساب الشيخ إبراهيم</p>
                    </div>
                </div>

                {/* ── SECTION A: Coefficients ─────────────────────────────── */}
                <Card className="print:hidden">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-purple-800">
                            <Settings2 className="w-4 h-4" />
                            معاملات المواد الخمس
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {[
                                { label: 'السور المحفوظة', val: coefSurah, set: setCoefSurah, color: 'purple' },
                                { label: 'الأوراد والحصيلة', val: coefDaily, set: setCoefDaily, color: 'blue' },
                                { label: 'الحضور', val: coefAttendance, set: setCoefAttendance, color: 'emerald' },
                                { label: 'التفسير', val: coefTafseer, set: setCoefTafseer, color: 'amber' },
                                { label: 'تقييم الحفظ', val: coefSurahEval, set: setCoefSurahEval, color: 'green' },
                            ].map(({ label, val, set, color }) => (
                                <div key={label} className={`border border-${color}-100 bg-${color}-50/30 rounded-xl p-3 text-center space-y-2`}>
                                    <div className={`text-xs font-bold text-${color}-700`}>{label}</div>
                                    <Input
                                        type="number" min={0} step={0.5}
                                        className="text-center font-bold text-lg h-10"
                                        value={val}
                                        onChange={e => set(Number(e.target.value) || 0)}
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* ── SECTION B: Customizable Scoring ────────────────────── */}
                <Card className="print:hidden">
                    <CardHeader
                        className="pb-3 cursor-pointer"
                        onClick={() => setShowScoring(v => !v)}
                    >
                        <CardTitle className="text-base flex items-center justify-between text-slate-700">
                            <span className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4" />
                                تخصيص نقاط التقييم
                            </span>
                            {showScoring ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </CardTitle>
                    </CardHeader>
                    {showScoring && (
                        <CardContent className="space-y-5">
                            {/* Performance points table */}
                            <div>
                                <h4 className="text-sm font-bold mb-3 text-slate-600">نقاط تقييم الأداء (السور والأوراد)</h4>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {Object.entries(perfPoints).map(([key, val]) => (
                                        <div key={key} className="space-y-1">
                                            <Label className="text-[11px] text-slate-500">{key}</Label>
                                            <Input
                                                type="number" min={0} max={20} step={0.5}
                                                className="h-8 text-center text-sm"
                                                value={val}
                                                onChange={e => setPerfPoints(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Attendance parameters */}
                            <div>
                                <h4 className="text-sm font-bold mb-3 text-slate-600">معايير الحضور</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-emerald-700">النقاط الأساسية للحضور</Label>
                                        <Input type="number" min={0} className="h-8" value={attBase} onChange={e => setAttBase(Number(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-rose-700">خصم الغياب (لكل غيابة)</Label>
                                        <Input type="number" min={0} step={0.25} className="h-8" value={attAbsent} onChange={e => setAttAbsent(Number(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-amber-700">خصم التأخر (لكل تأخر)</Label>
                                        <Input type="number" min={0} step={0.25} className="h-8" value={attLate} onChange={e => setAttLate(Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* ── SECTION C: Date Range + Surah Selection ─────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                    {/* Date range */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-700">الفترة الزمنية</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">من</Label>
                                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">إلى</Label>
                                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Surah selection */}
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm text-slate-700">السور المقررة ({selectedSurahs.length})</CardTitle>
                                {selectedSurahs.length > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedSurahs([])} className="h-6 text-[10px] text-red-500">مسح</Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="relative">
                                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input className="pr-9 h-8 text-xs" placeholder="ابحث سورة..." value={surahSearch} onChange={e => setSurahSearch(e.target.value)} />
                            </div>
                            <ScrollArea className="h-[140px] w-full rounded-md border bg-white p-2">
                                <div className="space-y-1">
                                    {filteredSurahs.map(s => (
                                        <div key={s.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`s-${s.id}`}
                                                checked={selectedSurahs.includes(s.id)}
                                                onCheckedChange={() => toggleSurah(s.id)}
                                            />
                                            <label htmlFor={`s-${s.id}`} className="text-xs cursor-pointer">{s.name}</label>
                                        </div>
                                    ))}
                                    {filteredSurahs.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">لا توجد نتائج</div>}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* ── SECTION D: Per-student Manual Grades ────────────────── */}
                {myStudents.length > 0 && (
                    <Card className="print:hidden">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base text-slate-700">علامات التفسير وتقييم الحفظ (يدوية لكل طالب)</CardTitle>
                            <CardDescription className="text-xs">
                                أدخل علامة كل طالب من 10. علامة تقييم الحفظ تنقلها من صفحة &quot;تقييم حفظ السور&quot;.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="p-2 border text-right">الطالب</th>
                                            <th className="p-2 border text-center text-amber-700">التفسير (/10)</th>
                                            <th className="p-2 border text-center text-green-700">تقييم الحفظ (/10)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {myStudents.map(s => (
                                            <tr key={s.id} className="hover:bg-slate-50">
                                                <td className="p-2 border font-medium">{s.fullName}</td>
                                                <td className="p-2 border text-center">
                                                    <Input
                                                        type="number" min={0} max={10} step={0.5}
                                                        className="h-7 w-20 text-center text-sm mx-auto border-amber-200 focus:border-amber-400"
                                                        value={tafseerGrades[s.id] ?? ''}
                                                        placeholder="0"
                                                        onChange={e => setTafseerGrades(prev => ({ ...prev, [s.id]: Number(e.target.value) || 0 }))}
                                                    />
                                                </td>
                                                <td className="p-2 border text-center">
                                                    <Input
                                                        type="number" min={0} max={10} step={0.5}
                                                        className="h-7 w-20 text-center text-sm mx-auto border-green-200 focus:border-green-400"
                                                        value={surahEvalGrades[s.id] ?? ''}
                                                        placeholder="0"
                                                        onChange={e => setSurahEvalGrades(prev => ({ ...prev, [s.id]: Number(e.target.value) || 0 }))}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Calculate Button ─────────────────────────────────────── */}
                <div className="flex justify-end print:hidden">
                    <Button
                        onClick={calculateResults}
                        disabled={selectedSurahs.length === 0 || !startDate || !endDate || isCalculating}
                        className="bg-purple-600 hover:bg-purple-700 text-white gap-2 px-8"
                    >
                        {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        حساب النتائج
                    </Button>
                </div>

                {/* ── SECTION E: Results Table ─────────────────────────────── */}
                {results.length > 0 && (
                    <Card className="print:shadow-none print:border-none">
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
                            <div>
                                <CardTitle className="text-lg text-purple-800">نتائج المسابقة</CardTitle>
                                <CardDescription>مرتبة حسب المجموع الكلي — {results.length} طالب</CardDescription>
                            </div>
                            <div className="flex gap-2 print:hidden">
                                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1">
                                    <Download className="w-4 h-4" /> CSV
                                </Button>
                                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
                                    <Printer className="w-4 h-4" /> طباعة الكل
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 text-[12px]">
                                            <th className="p-2 border">الترتيب</th>
                                            <th className="p-2 border cursor-pointer hover:bg-slate-200" onClick={() => handleSort('name')}>الاسم <SortIcon field="name" /></th>
                                            <th className="p-2 border text-center cursor-pointer hover:bg-purple-50 text-purple-700" onClick={() => handleSort('surahScore')}>السور المحفوظة (×{coefSurah}) <SortIcon field="surahScore" /></th>
                                            <th className="p-2 border text-center cursor-pointer hover:bg-blue-50 text-blue-700" onClick={() => handleSort('dailyScore')}>الأوراد والحصيلة (×{coefDaily}) <SortIcon field="dailyScore" /></th>
                                            <th className="p-2 border text-center cursor-pointer hover:bg-emerald-50 text-emerald-700" onClick={() => handleSort('attendanceScore')}>الحضور (×{coefAttendance}) <SortIcon field="attendanceScore" /></th>
                                            <th className="p-2 border text-center cursor-pointer hover:bg-amber-50 text-amber-700" onClick={() => handleSort('tafseerScore')}>التفسير (×{coefTafseer}) <SortIcon field="tafseerScore" /></th>
                                            <th className="p-2 border text-center cursor-pointer hover:bg-green-50 text-green-700" onClick={() => handleSort('surahEvalScore')}>تقييم الحفظ (×{coefSurahEval}) <SortIcon field="surahEvalScore" /></th>
                                            <th className="p-2 border text-center font-bold text-purple-700 bg-purple-50 cursor-pointer hover:bg-purple-100" onClick={() => handleSort('totalScore')}>المجموع <SortIcon field="totalScore" /></th>
                                            <th className="p-2 border text-center print:hidden">طباعة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedResults.map((r, idx) => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b">
                                                {/* Rank */}
                                                <td className="p-2 border text-center font-bold align-top">
                                                    {idx === 0 && '🥇'}{idx === 1 && '🥈'}{idx === 2 && '🥉'}
                                                    {idx + 1}
                                                </td>
                                                {/* Name */}
                                                <td className="p-2 border font-bold align-top">{r.name}</td>

                                                {/* Surah Score */}
                                                <td className="p-2 border align-top min-w-[130px]">
                                                    <div className="font-bold text-purple-700 text-center text-base">{r.surahScore}</div>
                                                    {r.details.surahs.map(sd => (
                                                        <div key={sd.id} className="flex justify-between text-[10px] bg-slate-50 rounded px-1 mt-0.5">
                                                            <span className="truncate ml-1">{sd.name}</span>
                                                            <span className="font-bold shrink-0">{sd.points} ({sd.evalStr})</span>
                                                        </div>
                                                    ))}
                                                    <div className="text-[10px] text-center text-muted-foreground mt-1">متوسط: {r.details.surahAvg}/10</div>
                                                </td>

                                                {/* Daily Score */}
                                                <td className="p-2 border align-top min-w-[120px]">
                                                    <div className="font-bold text-blue-700 text-center text-base">{r.dailyScore}</div>
                                                    <div className="flex justify-between text-[10px] bg-blue-50 rounded px-1 mt-0.5">
                                                        <span>تقييم يومي</span><span className="font-bold">{r.details.evaluatedDaily}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] bg-purple-50 rounded px-1 mt-0.5">
                                                        <span>حصيلة أسبوعية</span><span className="font-bold">{r.details.evaluatedWeekly}</span>
                                                    </div>
                                                    <div className="text-[10px] text-center text-muted-foreground mt-1">متوسط: {r.details.dailyAvg}/10</div>
                                                </td>

                                                {/* Attendance Score */}
                                                <td className="p-2 border align-top min-w-[100px]">
                                                    <div className="font-bold text-emerald-700 text-center text-base">{r.attendanceScore}</div>
                                                    <div className="flex justify-between text-[10px] bg-emerald-50 rounded px-1 mt-0.5">
                                                        <span>حضور</span><span className="font-bold">{r.details.presents}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] bg-rose-50 rounded px-1 mt-0.5">
                                                        <span>غياب</span><span className="font-bold">{r.details.absences}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] bg-amber-50 rounded px-1 mt-0.5">
                                                        <span>تأخر</span><span className="font-bold">{r.details.lates}</span>
                                                    </div>
                                                    <div className="text-[10px] text-center text-muted-foreground mt-1">من {r.details.expectedDays} يوم</div>
                                                </td>

                                                {/* Tafseer Score */}
                                                <td className="p-2 border text-center align-middle">
                                                    <div className="font-bold text-amber-700 text-base">{r.tafseerScore}</div>
                                                    <div className="text-[10px] text-muted-foreground">{tafseerGrades[r.id] ?? 0}/10</div>
                                                </td>

                                                {/* Surah Eval Score */}
                                                <td className="p-2 border text-center align-middle">
                                                    <div className="font-bold text-green-700 text-base">{r.surahEvalScore}</div>
                                                    <div className="text-[10px] text-muted-foreground">{surahEvalGrades[r.id] ?? 0}/10</div>
                                                </td>

                                                {/* Total */}
                                                <td className="p-2 border text-center font-bold text-xl text-purple-700 bg-purple-50/50 align-middle">
                                                    {r.totalScore}
                                                </td>

                                                {/* Print button */}
                                                <td className="p-2 border text-center align-middle print:hidden">
                                                    <Button variant="outline" size="sm" onClick={() => handlePrintIndividual(r)} className="text-purple-700 border-purple-200 hover:bg-purple-50 h-7 px-2">
                                                        <FileText className="w-3.5 h-3.5 ml-1" /> طباعة
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
