"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { format, subDays, parse, addDays, startOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageSquare, Trophy, Copy, CheckCircle, RefreshCw, Calendar, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn, arabicCompare } from '@/lib/utils';
import { surahs } from '@/lib/surahs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Admin5MessagesPanelProps {
    dailySessions: Record<string, Record<string, any>> | null;
    students: any[];
    weekDates: Date[]; // Array of 7 dates (Sat–Fri) from the weekly table
    weeklyOutcomes?: Record<string, any>;
    onNextWeek?: () => void;
    onPrevWeek?: () => void;
}

const pad = (num: number) => num < 10 ? `0${num}` : num.toString();

// Convert a Gregorian Date to a Hijri date string, e.g. "08 رمضان 1447"
const toHijri = (date: Date): string => {
    try {
        const hijriDate = new Date(date);
        const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
        // Intl returns something like "٠٨ رمضان ١٤٤٧ هـ"
        // We want to return pure Arabic text without the era suffix
        const parts = fmt.formatToParts(hijriDate);
        const day = parts.find(p => p.type === 'day')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';
        // Convert Arabic-Indic numerals to Western numerals
        const toWestern = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        return `${toWestern(day)} ${month} ${toWestern(year)}`;
    } catch {
        return '';
    }
};

const getSaturday = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 6 ? 0 : -(day + 1);
    d.setDate(d.getDate() + diff);
    return d;
};

export const Admin5MessagesPanel = ({
    dailySessions,
    students,
    weekDates,
    weeklyOutcomes,
    onNextWeek,
    onPrevWeek,
}: Admin5MessagesPanelProps) => {
    // Sort students alphabetically (Arabic)
    const sortedStudents = useMemo(() =>
        [...students].sort((a, b) => arabicCompare(a.fullName, b.fullName)),
        [students]
    );
    // Days in the week that have registered sessions
    const availableDays = useMemo(() => {
        if (!dailySessions || !weekDates) return [];
        // Force processing 7 days from Sat even if weekDates is shorter
        const baseDate = weekDates[0];
        const workDays = Array.from({ length: 7 }, (_, i) => addDays(baseDate, i));
        
        return workDays
            .map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const sessions = dailySessions[dateStr] ? Object.values(dailySessions[dateStr] as Record<string, any>) : [];
                const primarySession = sessions.find((s: any) => s.sessionNumber === 1) || sessions[0];
                const hasRecords = primarySession?.records && primarySession.records.length > 0;
                return {
                    date,
                    dateStr,
                    dayName: format(date, 'EEEE', { locale: ar }),
                    hasSession: !!primarySession,
                    hasRecords: !!hasRecords,
                    session: primarySession || null,
                };
            });
    }, [dailySessions, weekDates]);

    const [selectedDateStr, setSelectedDateStr] = useState<string>('');
    const [dailyMsgText, setDailyMsgText] = useState('');
    const [harvestMsgText, setHarvestMsgText] = useState('');
    const [copiedDaily, setCopiedDaily] = useState(false);
    const [copiedHarvest, setCopiedHarvest] = useState(false);

    // Auto-select the most recent available day with records (fallback to most recent day)
    useEffect(() => {
        if (availableDays.length > 0 && !selectedDateStr) {
            const withRecords = availableDays.filter(d => d.hasRecords);
            const sourceArray = withRecords.length > 0 ? withRecords : availableDays;
            const sorted = [...sourceArray].sort((a, b) => b.dateStr.localeCompare(a.dateStr));
            setSelectedDateStr(sorted[0].dateStr);
        }
    }, [availableDays, selectedDateStr]);

    // Generate the daily message whenever selectedDate or session data changes
    const generateDailyMessage = useMemo(() => {
        if (!selectedDateStr || !dailySessions) return '';

        const sessions = dailySessions[selectedDateStr]
            ? Object.values(dailySessions[selectedDateStr] as Record<string, any>)
            : [];
        const session = sessions.find((s: any) => s.sessionNumber === 1) || sessions[0];
        if (!session) return '';

        const sessionType = session.sessionType;
        if (sessionType !== 'حصة أساسية' && sessionType !== 'حصة تعويضية' && sessionType !== 'حصة إضافية') return '';

        const selectedDate = parse(selectedDateStr, 'yyyy-MM-dd', new Date());
        const dayName = format(selectedDate, 'EEEE', { locale: ar });
        const gregorianStr = format(selectedDate, 'dd-MM-yyyy');
        const hijriStr = toHijri(selectedDate);

        const header = 'السلام عليكم ورحمة الله وبركاته';
        const dateLine = hijriStr
            ? `اليوم ${dayName} ${hijriStr} الموافق لـ : ${gregorianStr}`
            : `اليوم ${dayName} ${gregorianStr}`;

        const records: any[] = session.records || [];

        // Get performance level mapping — use the records from the session
        const getStudentRecord = (studentId: string) =>
            records.find((r: any) => r.studentId === studentId);

        const isCounterStopped = session.isCounterStopped;
        const tasmieSurahId = session.tasmieSurahId;
        const tasmieFromVerse = session.tasmieFromVerse;
        const tasmieToVerse = session.tasmieToVerse;
        const tasmieSurah = surahs.find(s => s.id === tasmieSurahId);
        const isTasmieCompletion = tasmieToVerse === tasmieSurah?.verses;

        // Build recited list (present + has memorization)
        const presentStudents = sortedStudents.filter(s => {
            const rec = getStudentRecord(s.id);
            return rec && (rec.attendance === 'حاضر' || rec.attendance === 'متأخر');
        });

        const recitedStudents = presentStudents.filter(s => {
            const rec = getStudentRecord(s.id);
            return rec?.memorization && rec.memorization !== 'لا يوجد';
        });

        const lateStudents = sortedStudents.filter(s => {
            const rec = getStudentRecord(s.id);
            return rec?.attendance === 'متأخر';
        });

        const absentStudents = sortedStudents.filter(s => {
            const rec = getStudentRecord(s.id);
            return rec?.attendance === 'غياب' || rec?.attendance === 'غائب';
        });

        // Daily content
        let dailyContent = '';
        if (isCounterStopped) {
            dailyContent = `(العداد موقوف لهذا اليوم)\n`;
        } else if (tasmieSurah) {
            if (isTasmieCompletion) {
                dailyContent = `قائمة الطلبة الذين استظهروا ورد التسميع (سورة ${tasmieSurah.name}) :\n`;
            } else {
                dailyContent = `قائمة الطلبة الذين استظهروا ورد التسميع من الآية(${pad(tasmieFromVerse)}) إلى الآية(${pad(tasmieToVerse)}) من سورة ${tasmieSurah.name} :\n`;
            }
        } else {
            dailyContent = 'قائمة الطلبة الذين استظهروا الورد اليومي :\n';
        }

        if (recitedStudents.length > 0) {
            dailyContent += recitedStudents.map(s => {
                const rec = getStudentRecord(s.id);
                return `*${s.fullName}* : ${rec?.memorization || ''}`;
            }).join('\n');
        } else {
            dailyContent += 'لا يوجد';
        }

        if (lateStudents.length > 0) {
            dailyContent += `\n-------------\nقائمة الطلبة المتأخرين:\n${lateStudents.map(s => `*${s.fullName}*`).join('\n')}`;
        }

        if (absentStudents.length > 0) {
            dailyContent += `\n-------------\nقائمة الطلبة الغائبين:\n${absentStudents.map(s => `*${s.fullName}*`).join('\n')}`;
        }

        // Catch-up wirds
        const catchUpGroups: Record<string, string[]> = {};
        sortedStudents.forEach(s => {
            const rec = getStudentRecord(s.id);
            if (rec?.catchUpRecords && rec.catchUpRecords.length > 0) {
                rec.catchUpRecords.forEach((c: any) => {
                    const key = `${c.surahName} (${c.fromVerse}-${c.toVerse}) - ${c.date}`;
                    if (!catchUpGroups[key]) catchUpGroups[key] = [];
                    catchUpGroups[key].push(s.fullName);
                });
            }
        });

        if (Object.keys(catchUpGroups).length > 0) {
            dailyContent += `\n\n-------------\n📋 تم تعويض الأوراد التالية:\n`;
            Object.entries(catchUpGroups).forEach(([key, names]) => {
                dailyContent += `\n🔸 ${key}:\n`;
                names.forEach((name, i) => {
                    dailyContent += `${i + 1}. ${name}\n`;
                });
            });
        }

        return `${header}\n${dateLine}\n${dailyContent}`;
    }, [selectedDateStr, dailySessions, students]);

    // Generate weekly harvest message (based on the full weekDates)
    const harvestMessageGenerated = useMemo(() => {
        if (!weekDates || !dailySessions || !students) return '';

        const header = 'السلام عليكم ورحمة الله وبركاته';
        const dateLine = `الحصيلة الأسبوعية (${format(weekDates[0], 'd MMMM', { locale: ar })} - ${format(weekDates[6], 'd MMMM yyyy', { locale: ar })})`;

        const weekStart = weekDates[0];
        const weekEnd = weekDates[6];
        const allSessions = Object.values(dailySessions).flatMap(day =>
            Object.values(day as Record<string, any>)
        );

        const weekSessions = allSessions
            .filter(s => {
                const sDate = parse(s.date, 'yyyy-MM-dd', new Date());
                return sDate >= weekStart && sDate <= weekEnd && s.sessionType === 'حصة أساسية';
            })
            .sort((a, b) => a.date.localeCompare(b.date));

        const validSessions = weekSessions.filter(s => s.tasmieSurahId || s.surahId);

        if (validSessions.length === 0) {
            return `${header}\n${dateLine}\n\nلا توجد أوراد مسجلة في هذا الأسبوع.`;
        }

        const firstSession = validSessions[0];
        const lastSession = validSessions[validSessions.length - 1];

        const firstSurah = surahs.find(s => s.id === (firstSession.tasmieSurahId || firstSession.surahId))?.name || '';
        const lastSurah = surahs.find(s => s.id === (lastSession.tasmieSurahId || lastSession.surahId))?.name || '';

        const firstFrom = firstSession.tasmieFromVerse || firstSession.fromVerse || 0;
        const lastTo = lastSession.tasmieToVerse || lastSession.toVerse || 0;

        let harvestContent = '';

        if (firstSurah === lastSurah) {
            harvestContent += `سورة ${firstSurah} من الآية (${pad(firstFrom)}) إلى (${pad(lastTo)})\n\n`;
        } else {
            harvestContent += `من سورة ${firstSurah} الآية (${pad(firstFrom)}) إلى سورة ${lastSurah} الآية (${pad(lastTo)})\n\n`;
        }

        const numWords = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع'];

        validSessions.forEach((session, index) => {
            const surahId = session.tasmieSurahId || session.surahId;
            const surahName = surahs.find(s => s.id === surahId)?.name || '';
            const fromV = session.tasmieFromVerse || session.fromVerse || 0;
            const toV = session.tasmieToVerse || session.toVerse || 0;

            const wirdLabel = `الورد ${numWords[index] || (index + 1)}: سورة ${surahName} من آية ${fromV} الى ${toV}`;

            const memorized: string[] = [];
            const notMemorized: string[] = [];

            sortedStudents.forEach(student => {
                const records = session.records || [];
                const rec = records.find((r: any) => r.studentId === student.id);

                const isAbsent = !rec || rec.attendance === 'غياب' || rec.attendance === 'غائب';
                const isFail = rec?.memorization === 'لم يحفظ' || rec?.memorization === 'ضعيف'; // Including absent or fail as didn't memorize

                const evaluation = isAbsent ? 'غائب' : (rec?.memorization && rec.memorization !== 'لا يوجد' ? rec.memorization : 'لم يحفظ');
                const formattedEntry = `*${student.fullName}* : ${evaluation}`;

                if (isAbsent || isFail || !rec.memorization || rec.memorization === 'لا يوجد') {
                    notMemorized.push(formattedEntry);
                } else {
                    memorized.push(formattedEntry);
                }
            });

            harvestContent += `🔹 ${wirdLabel}\n`;
            harvestContent += `الذين حفظوه:\n${memorized.length > 0 ? memorized.map(m => ` - ${m}`).join('\n') : ' - لا يوجد'}\n`;
            harvestContent += `الذين لم يحفظوه:\n${notMemorized.length > 0 ? notMemorized.map(m => ` - ${m}`).join('\n') : ' - لا يوجد'}\n\n`;
        });

        return `${header}\n${dateLine}\n${harvestContent}`;
    }, [weekDates, dailySessions, students]);

    // Sync generated message into editable textarea (only when regenerated)
    useEffect(() => {
        setDailyMsgText(generateDailyMessage);
    }, [generateDailyMessage]);

    useEffect(() => {
        setHarvestMsgText(harvestMessageGenerated);
    }, [harvestMessageGenerated]);

    const handleCopyDaily = () => {
        navigator.clipboard.writeText(dailyMsgText);
        setCopiedDaily(true);
        setTimeout(() => setCopiedDaily(false), 2000);
    };

    const handleCopyHarvest = () => {
        navigator.clipboard.writeText(harvestMsgText);
        setCopiedHarvest(true);
        setTimeout(() => setCopiedHarvest(false), 2000);
    };

    const selectedDayInfo = availableDays.find(d => d.dateStr === selectedDateStr);

    if (availableDays.length === 0) {
        return (
            <Card className="border-2 border-emerald-100 mt-4">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    لا توجد حصص مسجلة في هذا الأسبوع لتوليد الرسائل.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4 mt-4" dir="rtl">
            {/* Daily Message Section */}
            <Card className="border-2 border-blue-100 shadow-sm">
                <CardHeader className="pb-3 bg-gradient-to-l from-blue-50/60 to-white rounded-t-xl">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-blue-800 text-base">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                            رسالة الورد اليومي (WhatsApp)
                        </CardTitle>

                        {/* Day Selector */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
                            <Select value={selectedDateStr} onValueChange={setSelectedDateStr}>
                                <SelectTrigger className="h-9 w-full sm:w-[200px] text-xs border-blue-200 bg-white">
                                    <SelectValue placeholder="اختر اليوم..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableDays.map(d => (
                                        <SelectItem key={d.dateStr} value={d.dateStr}>
                                            <span className="flex items-center gap-2">
                                                <span className="font-bold">{d.dayName}</span>
                                                <span className="text-muted-foreground text-[10px]">{d.dateStr}</span>
                                                {d.hasRecords && (
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-green-50 text-green-700 border-green-200">
                                                        مسجّل
                                                    </Badge>
                                                )}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {selectedDayInfo && (
                        <p className="text-[11px] text-blue-600/70 mt-1">
                            يوم {selectedDayInfo.dayName} — {selectedDateStr}
                            {!selectedDayInfo.hasRecords && <span className="text-amber-600 mr-2">⚠️ لا توجد سجلات حضور مكتملة</span>}
                        </p>
                    )}
                </CardHeader>

                <CardContent className="space-y-3 pt-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">يمكنك التعديل على الرسالة قبل نسخها</span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDailyMsgText(generateDailyMessage)}
                                className="h-8 text-[11px] gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                                <RefreshCw className="h-3 w-3" />
                                إعادة توليد
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleCopyDaily}
                                disabled={!dailyMsgText}
                                className={cn(
                                    "h-8 text-[11px] gap-1.5 transition-all",
                                    copiedDaily
                                        ? "bg-green-100 text-green-800 border border-green-200 hover:bg-green-100"
                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                )}
                            >
                                {copiedDaily ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedDaily ? 'تم النسخ ✓' : 'نسخ الرسالة'}
                            </Button>
                        </div>
                    </div>

                    <Textarea
                        value={dailyMsgText}
                        onChange={(e) => setDailyMsgText(e.target.value)}
                        className="min-h-[220px] text-sm font-body leading-relaxed text-right bg-blue-50/30 border-blue-100 focus:border-blue-300 resize-none"
                        dir="rtl"
                        placeholder="اختر يوماً لتوليد الرسالة..."
                    />
                </CardContent>
            </Card>

            {/* Weekly Harvest Message */}
            {harvestMessageGenerated && (
                <Card className="border-2 border-emerald-200 shadow-sm">
                    <CardHeader className="pb-3 bg-gradient-to-l from-emerald-50/60 to-white rounded-t-xl">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-emerald-800 text-base">
                                <Trophy className="h-5 w-5 text-emerald-600" />
                                رسالة الحصيلة الأسبوعية (WhatsApp)
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setHarvestMsgText(harvestMessageGenerated)}
                                    className="h-8 text-[11px] gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    إعادة توليد
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleCopyHarvest}
                                    disabled={!harvestMsgText}
                                    className={cn(
                                        "h-8 text-[11px] gap-1.5 transition-all",
                                        copiedHarvest
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    )}
                                >
                                    {copiedHarvest ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    {copiedHarvest ? 'تم النسخ ✓' : 'نسخ الحصيلة'}
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-[11px] text-emerald-600/70">
                                ملخص أسبوع {weekDates?.[0] ? format(weekDates[0], 'dd/MM', { locale: ar }) : ''} — {weekDates?.[6] ? format(weekDates[6], 'dd/MM/yyyy', { locale: ar }) : ''}
                            </p>
                            <div className="flex items-center gap-1" dir="ltr">
                                {onNextWeek && (
                                    <Button variant="outline" size="icon" className="h-6 w-6 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={onNextWeek}>
                                        <ChevronRight className="h-3 w-3" />
                                    </Button>
                                )}
                                {onPrevWeek && (
                                    <Button variant="outline" size="icon" className="h-6 w-6 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={onPrevWeek}>
                                        <ChevronLeft className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-2">
                        <span className="text-xs text-muted-foreground">يمكنك التعديل على الرسالة قبل نسخها</span>
                        <Textarea
                            value={harvestMsgText}
                            onChange={(e) => setHarvestMsgText(e.target.value)}
                            className="min-h-[260px] text-sm font-body leading-relaxed text-right bg-emerald-50/30 border-emerald-100 focus:border-emerald-300 resize-none"
                            dir="rtl"
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
