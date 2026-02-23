"use client";

import React, { useState, useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { surahs } from '@/lib/surahs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Plus, Trash2, Search, Printer, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { format } from 'date-fns';

// ─── Deduction weights per error type ───────────────────────────────────────
const DEDUCTIONS = {
    critical: 2.0,    // أخطاء جسيمة
    forgotten: 1.5,   // نسيان
    wrongWord: 0.75,  // كلمات خاطئة
    tajweed: 0.25,    // أخطاء الأحكام
};

interface LocationErrors {
    pageNumber: string;
    critical: number;
    forgotten: number;
    wrongWord: number;
    tajweed: number;
}

interface SurahEntry {
    surahId: number;
    surahName: string;
    locations: LocationErrors[];
}

function calcPageScore(loc: LocationErrors): number {
    const deduction =
        loc.critical * DEDUCTIONS.critical +
        loc.forgotten * DEDUCTIONS.forgotten +
        loc.wrongWord * DEDUCTIONS.wrongWord +
        loc.tajweed * DEDUCTIONS.tajweed;
    return Math.max(0, parseFloat((10 - deduction).toFixed(2)));
}

function calcSurahAvg(locs: LocationErrors[]): number {
    if (locs.length === 0) return 0;
    const sum = locs.reduce((acc, loc) => acc + calcPageScore(loc), 0);
    return parseFloat((sum / locs.length).toFixed(2));
}

function defaultLocation(pageNum = ''): LocationErrors {
    return { pageNumber: pageNum, critical: 0, forgotten: 0, wrongWord: 0, tajweed: 0 };
}

function defaultSurahEntry(id: number, name: string): SurahEntry {
    return {
        surahId: id,
        surahName: name,
        locations: [defaultLocation(), defaultLocation(), defaultLocation()],
    };
}

export default function SurahEvalPage() {
    const { user } = useAuth();
    const { students } = useStudentContext();

    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [coefficient, setCoefficient] = useState(4);
    const [evalSurahs, setEvalSurahs] = useState<SurahEntry[]>([]);
    const [surahSearch, setSurahSearch] = useState('');
    const [showSurahPicker, setShowSurahPicker] = useState(false);
    const [expandedSurahs, setExpandedSurahs] = useState<Set<number>>(new Set());

    const myStudents = useMemo(() =>
        students.filter(s => s.ownerId === user?.uid),
        [students, user]
    );

    const filteredSurahs = useMemo(() => {
        const q = surahSearch.trim();
        return q ? surahs.filter(s => s.name.includes(q)) : surahs;
    }, [surahSearch]);

    const addSurah = (id: number, name: string) => {
        if (evalSurahs.some(s => s.surahId === id)) return;
        setEvalSurahs(prev => [...prev, defaultSurahEntry(id, name)]);
        setExpandedSurahs(prev => new Set(prev).add(prev.size));
        setShowSurahPicker(false);
        setSurahSearch('');
    };

    const removeSurah = (idx: number) => {
        setEvalSurahs(prev => prev.filter((_, i) => i !== idx));
    };

    const updateLocation = (sIdx: number, lIdx: number, field: keyof LocationErrors, value: string | number) => {
        setEvalSurahs(prev => prev.map((s, i) => {
            if (i !== sIdx) return s;
            const locs = s.locations.map((l, j) => j === lIdx ? { ...l, [field]: value } : l);
            return { ...s, locations: locs };
        }));
    };

    const addLocation = (sIdx: number) => {
        setEvalSurahs(prev => prev.map((s, i) => i === sIdx ? { ...s, locations: [...s.locations, defaultLocation()] } : s));
    };

    const removeLocation = (sIdx: number, lIdx: number) => {
        setEvalSurahs(prev => prev.map((s, i) => {
            if (i !== sIdx) return s;
            return { ...s, locations: s.locations.filter((_, j) => j !== lIdx) };
        }));
    };

    const toggleExpand = (idx: number) => {
        setExpandedSurahs(prev => {
            const ns = new Set(prev);
            ns.has(idx) ? ns.delete(idx) : ns.add(idx);
            return ns;
        });
    };

    const overallAvg = useMemo(() => {
        if (evalSurahs.length === 0) return 0;
        const total = evalSurahs.reduce((acc, s) => acc + calcSurahAvg(s.locations), 0);
        return parseFloat((total / evalSurahs.length).toFixed(2));
    }, [evalSurahs]);

    const finalScore = parseFloat((overallAvg * coefficient).toFixed(2));

    const selectedStudent = myStudents.find(s => s.id === selectedStudentId);

    if (user?.email !== 'admin5@gmail.com') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <BookOpen className="w-16 h-16 mx-auto text-slate-300" />
                    <h2 className="text-xl font-bold text-slate-500">صفحة مخصصة للشيخ إبراهيم فقط</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
            {/* ─── Print View ─── */}
            {selectedStudent && evalSurahs.length > 0 && (
                <div style={{ display: 'none' }} className="print:!block space-y-6 p-8">
                    <div className="text-center border-b pb-4">
                        <Trophy className="w-12 h-12 mx-auto text-green-600 mb-2" />
                        <h1 className="text-2xl font-bold">كشف تقييم حفظ السور</h1>
                        <p className="text-lg">{selectedStudent.fullName} — {format(new Date(), 'yyyy/MM/dd')}</p>
                    </div>
                    {evalSurahs.map((s, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                            <h3 className="font-bold text-lg mb-2">{s.surahName} — متوسط: {calcSurahAvg(s.locations)}/10</h3>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="p-2 border">الموضع</th>
                                        <th className="p-2 border">جسيمة</th>
                                        <th className="p-2 border">نسيان</th>
                                        <th className="p-2 border">كلمات خاطئة</th>
                                        <th className="p-2 border">أحكام</th>
                                        <th className="p-2 border font-bold">العلامة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {s.locations.map((loc, li) => (
                                        <tr key={li}>
                                            <td className="p-2 border text-center">{loc.pageNumber || `${li + 1}`}</td>
                                            <td className="p-2 border text-center">{loc.critical}</td>
                                            <td className="p-2 border text-center">{loc.forgotten}</td>
                                            <td className="p-2 border text-center">{loc.wrongWord}</td>
                                            <td className="p-2 border text-center">{loc.tajweed}</td>
                                            <td className="p-2 border text-center font-bold">{calcPageScore(loc)}/10</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    <div className="border-t pt-4 text-center text-xl font-bold">
                        متوسط السور: {overallAvg}/10 | العلامة النهائية (×{coefficient}): <span className="text-green-700">{finalScore}</span>
                    </div>
                </div>
            )}

            {/* ─── Main UI ─── */}
            <div className={evalSurahs.length > 0 && selectedStudent ? 'print:hidden' : ''}>
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-2xl text-green-700">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">تقييم حفظ السور</h1>
                        <p className="text-sm text-muted-foreground">تقييم دقيق بالمواضع والأخطاء لكل سورة</p>
                    </div>
                </div>

                {/* Settings */}
                <Card className="print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base text-green-800">إعدادات التقييم</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-sm">اختر الطالب</Label>
                            <select
                                className="w-full border rounded-md p-2 text-sm bg-white"
                                value={selectedStudentId}
                                onChange={e => setSelectedStudentId(e.target.value)}
                            >
                                <option value="">-- اختر طالباً --</option>
                                {myStudents.map(s => (
                                    <option key={s.id} value={s.id}>{s.fullName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-sm">معامل المادة</Label>
                            <Input
                                type="number"
                                min={1}
                                value={coefficient}
                                onChange={e => setCoefficient(Number(e.target.value) || 1)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Scores Summary */}
                {evalSurahs.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 print:hidden">
                        <Card className="text-center p-4 bg-green-50/50 border-green-100">
                            <div className="text-2xl font-bold text-green-700">{overallAvg}</div>
                            <div className="text-xs text-slate-500 mt-1">متوسط السور / 10</div>
                        </Card>
                        <Card className="text-center p-4 bg-blue-50/50 border-blue-100">
                            <div className="text-2xl font-bold text-blue-700">× {coefficient}</div>
                            <div className="text-xs text-slate-500 mt-1">المعامل</div>
                        </Card>
                        <Card className="text-center p-4 bg-purple-50/50 border-purple-100">
                            <div className="text-2xl font-bold text-purple-700">{finalScore}</div>
                            <div className="text-xs text-slate-500 mt-1">العلامة النهائية</div>
                        </Card>
                    </div>
                )}

                {/* Surah Picker Button */}
                <div className="print:hidden">
                    <Button
                        onClick={() => setShowSurahPicker(v => !v)}
                        variant="outline"
                        className="gap-2 w-full border-dashed border-green-400 text-green-700 hover:bg-green-50"
                    >
                        <Plus className="w-4 h-4" />
                        إضافة سورة للتقييم
                    </Button>

                    {showSurahPicker && (
                        <Card className="mt-2 border-green-200">
                            <CardContent className="pt-4 space-y-2">
                                <div className="relative">
                                    <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        className="pr-9 text-sm"
                                        placeholder="ابحث عن سورة..."
                                        value={surahSearch}
                                        onChange={e => setSurahSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <ScrollArea className="h-48 border rounded-md bg-white p-2">
                                    <div className="space-y-1">
                                        {filteredSurahs.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => addSurah(s.id, s.name)}
                                                disabled={evalSurahs.some(e => e.surahId === s.id)}
                                                className="w-full text-right px-3 py-1.5 rounded text-sm hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {s.name}
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Surah Entries */}
                {evalSurahs.map((s, sIdx) => {
                    const avg = calcSurahAvg(s.locations);
                    const isExpanded = expandedSurahs.has(sIdx);
                    return (
                        <Card key={sIdx} className="border-green-100">
                            <CardHeader
                                className="py-3 px-4 cursor-pointer flex flex-row items-center justify-between"
                                onClick={() => toggleExpand(sIdx)}
                            >
                                <div>
                                    <CardTitle className="text-base text-green-800">{s.surahName}</CardTitle>
                                    <CardDescription className="text-xs">
                                        متوسط: <span className="font-bold text-green-700">{avg}/10</span>
                                        {' — '}
                                        {s.locations.length} مواضع
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={e => { e.stopPropagation(); removeSurah(sIdx); }}
                                        className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </CardHeader>

                            {isExpanded && (
                                <CardContent className="pt-0 space-y-4">
                                    {/* Error type legend */}
                                    <div className="grid grid-cols-4 gap-2 text-[11px] text-center bg-slate-50 p-2 rounded-lg">
                                        <div className="bg-red-50 text-red-700 p-1 rounded font-medium">جسيمة (−{DEDUCTIONS.critical})</div>
                                        <div className="bg-orange-50 text-orange-700 p-1 rounded font-medium">نسيان (−{DEDUCTIONS.forgotten})</div>
                                        <div className="bg-yellow-50 text-yellow-700 p-1 rounded font-medium">كلمات خاطئة (−{DEDUCTIONS.wrongWord})</div>
                                        <div className="bg-blue-50 text-blue-700 p-1 rounded font-medium">أحكام (−{DEDUCTIONS.tajweed})</div>
                                    </div>

                                    {/* Locations */}
                                    {s.locations.map((loc, lIdx) => {
                                        const score = calcPageScore(loc);
                                        const color = score >= 8 ? 'text-green-600 bg-green-50' : score >= 5 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
                                        return (
                                            <div key={lIdx} className="border rounded-xl p-3 space-y-3 bg-white">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-500">الموضع {lIdx + 1}</span>
                                                        <Input
                                                            className="h-7 w-24 text-xs"
                                                            placeholder="رقم الصفحة"
                                                            value={loc.pageNumber}
                                                            onChange={e => updateLocation(sIdx, lIdx, 'pageNumber', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-sm font-bold px-3 py-1 rounded-full ${color}`}>
                                                            {score}/10
                                                        </div>
                                                        {s.locations.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeLocation(sIdx, lIdx)}
                                                                className="text-red-400 hover:text-red-600 h-7 w-7 p-0"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-4 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-red-700">أخطاء جسيمة</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            className="h-8 text-center text-sm border-red-200 focus:border-red-400"
                                                            value={loc.critical}
                                                            onChange={e => updateLocation(sIdx, lIdx, 'critical', Math.max(0, parseInt(e.target.value) || 0))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-orange-700">نسيان</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            className="h-8 text-center text-sm border-orange-200 focus:border-orange-400"
                                                            value={loc.forgotten}
                                                            onChange={e => updateLocation(sIdx, lIdx, 'forgotten', Math.max(0, parseInt(e.target.value) || 0))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-yellow-700">كلمات خاطئة</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            className="h-8 text-center text-sm border-yellow-200 focus:border-yellow-400"
                                                            value={loc.wrongWord}
                                                            onChange={e => updateLocation(sIdx, lIdx, 'wrongWord', Math.max(0, parseInt(e.target.value) || 0))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-blue-700">أخطاء الأحكام</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            className="h-8 text-center text-sm border-blue-200 focus:border-blue-400"
                                                            value={loc.tajweed}
                                                            onChange={e => updateLocation(sIdx, lIdx, 'tajweed', Math.max(0, parseInt(e.target.value) || 0))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addLocation(sIdx)}
                                        className="w-full border-dashed text-green-700 border-green-300 hover:bg-green-50 gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        إضافة موضع
                                    </Button>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}

                {/* Print Results Button */}
                {evalSurahs.length > 0 && selectedStudentId && (
                    <Button
                        onClick={() => window.print()}
                        className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 print:hidden"
                    >
                        <Printer className="w-4 h-4" />
                        طباعة كشف التقييم
                    </Button>
                )}
            </div>
        </div>
    );
}
