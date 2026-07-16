"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { surahs, calculateStandardPages } from '@/lib/surahs';
import {
  Loader2, ChevronRight, ChevronLeft,
  BookOpen, Star, Clock, CheckCircle2,
  Award, TrendingUp, User, Activity,
  Calendar, Layers, Flame, X, BookMarked, Trophy
} from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, startOfMonth,
  endOfMonth, eachDayOfInterval, isSameDay, isSameMonth,
  parseISO, subMonths, addMonths, differenceInDays, getDay
} from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, DailySession, DailyRecord, AppUser } from '@/lib/types';
import { useSearchParams, useRouter } from 'next/navigation';

// ─── ثوابت التقييم ────────────────────────────────────────────────
const GRADE_CONFIG: Record<string, { label: string; emoji: string; weight: number; hue: string; bg: string; text: string; border: string }> = {
  'ممتاز':    { label: 'ممتاز',   emoji: '🌟', weight: 5, hue: '152', bg: 'bg-emerald-500',  text: 'text-emerald-700', border: 'border-emerald-300' },
  'جيد جداً': { label: 'جيد جداً', emoji: '✅', weight: 4, hue: '213', bg: 'bg-blue-500',     text: 'text-blue-700',    border: 'border-blue-300' },
  'جيد جدا':  { label: 'جيد جداً', emoji: '✅', weight: 4, hue: '213', bg: 'bg-blue-500',     text: 'text-blue-700',    border: 'border-blue-300' },
  'جيد':      { label: 'جيد',     emoji: '👍', weight: 3, hue: '43',  bg: 'bg-amber-500',    text: 'text-amber-700',   border: 'border-amber-300' },
  'حسن':      { label: 'حسن',     emoji: '🔵', weight: 2, hue: '258', bg: 'bg-indigo-500',   text: 'text-indigo-700',  border: 'border-indigo-300' },
  'متوسط':    { label: 'متوسط',   emoji: '👌', weight: 1, hue: '25',  bg: 'bg-orange-400',   text: 'text-orange-700',  border: 'border-orange-300' },
  'مقبول':    { label: 'مقبول',   emoji: '👌', weight: 1, hue: '25',  bg: 'bg-orange-400',   text: 'text-orange-700',  border: 'border-orange-300' },
  'ضعيف':     { label: 'ضعيف',    emoji: '❌', weight: 0, hue: '0',   bg: 'bg-red-400',      text: 'text-red-700',     border: 'border-red-300' },
  'لم يحفظ':  { label: 'لم يحفظ', emoji: '🚫', weight: 0, hue: '0',   bg: 'bg-red-500',      text: 'text-red-700',     border: 'border-red-300' },
};

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const HEATMAP_COLORS = [
  'bg-slate-100 dark:bg-slate-800/60',      // 0 — فارغ
  'bg-emerald-100 dark:bg-emerald-900/40',  // 1 — خفيف
  'bg-emerald-200 dark:bg-emerald-800/60',  // 2
  'bg-emerald-300 dark:bg-emerald-700/70',  // 3
  'bg-emerald-400 dark:bg-emerald-600/80',  // 4
];

const STATE_COLORS: Record<string, string> = {
  'غائب': '#ef4444',
  'غياب': '#ef4444',
  'مراجعة': '#a855f7',
  'متأخر': '#fbbf24',
  'تعويض': '#0ea5e9',
  'ممتاز': '#10b981',
  'جيد جداً': '#3b82f6',
  'جيد جدا': '#3b82f6',
  'جيد': '#14b8a6',
  'حسن': '#6366f1',
  'متوسط': '#fb923c',
  'مقبول': '#fb923c',
  'ضعيف': '#f43f5e',
  'لم يحفظ': '#dc2626',
  'حاضر': '#10b981',
};

function getRecordColor(recObj: { sessionNum: number; record: DailyRecord; teacherId: string } | undefined): string {
  if (!recObj) return '#f8fafc';
  const r = recObj.record;
  const att = r.attendance || '';
  const isGR = r.review === true && (!r.memorization || (r.memorization as any) === '');
  const grade = r.memorization as string || '';

  if (att === 'غائب' || att === 'غياب') return '#ef4444';
  if (isGR) return '#a855f7';
  if (att === 'متأخر') return '#fbbf24';
  if (att === 'تعويض') return '#0ea5e9';
  return STATE_COLORS[grade] || '#10b981';
}

function getHeatLevel(verses: number): number {
  if (verses === 0) return 0;
  if (verses <= 3) return 1;
  if (verses <= 7) return 2;
  if (verses <= 12) return 3;
  if (verses <= 20) return 4;
  return 5;
}

function calcAvgGrade(grades: string[]): { label: string; emoji: string } {
  if (!grades.length) return { label: '—', emoji: '' };
  const weights = grades.map(g => GRADE_CONFIG[g]?.weight ?? 3);
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  if (avg >= 4.5) return { label: 'ممتاز', emoji: '🌟' };
  if (avg >= 3.5) return { label: 'جيد جداً', emoji: '✅' };
  if (avg >= 2.5) return { label: 'جيد', emoji: '👍' };
  if (avg >= 1.5) return { label: 'حسن', emoji: '🔵' };
  if (avg >= 0.5) return { label: 'متوسط', emoji: '👌' };
  return { label: 'ضعيف', emoji: '❌' };
}

type CellTheme = {
  bg: string;
  numColor: string;
  surahColor: string;
  verseColor: string;
  badgeBg: string;
  badgeText: string;
  badgeLabel: string;
  badgeEmoji: string;
  attendance: string;
  isGR: boolean;
  sName: string;
  from: number;
  to: number;
};

function getRecordTheme(recObj: { sessionNum: number; record: DailyRecord; teacherId: string } | undefined): CellTheme {
  if (!recObj) {
    return {
      bg: 'bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700/40',
      numColor: 'text-slate-300 dark:text-slate-600',
      surahColor: '', verseColor: '',
      badgeBg: '', badgeText: '', badgeLabel: '', badgeEmoji: '',
      attendance: '', isGR: false, sName: '', from: 0, to: 0
    };
  }

  const r = recObj.record;
  const att = r.attendance || '';
  const isGR = r.review === true && (!r.memorization || (r.memorization as any) === '');
  const grade = r.memorization as string || '';
  const gradeCfg = GRADE_CONFIG[grade];

  const sName = surahs.find(s => s.id === (r.tasmieSurahId || r.surahId))?.name || '';
  const from = r.tasmieFromVerse || r.fromVerse || 0;
  const to = r.tasmieToVerse || r.toVerse || 0;

  let bg = '';
  let badgeLabel = '';
  let badgeEmoji = '';
  let badgeBg = 'bg-black/20';
  let badgeText = 'text-white';

  if (att === 'غائب' || att === 'غياب') {
    bg = 'bg-red-500 border border-red-600';
    badgeLabel = 'غائب';
    badgeEmoji = '🚫';
    badgeBg = 'bg-white/20';
  } else if (isGR) {
    bg = 'bg-purple-600 border border-purple-700';
    badgeLabel = 'مراجعة';
    badgeEmoji = '🔄';
    badgeBg = 'bg-white/20';
  } else if (att === 'متأخر') {
    bg = 'bg-amber-400 border border-amber-500';
    badgeLabel = 'متأخر';
    badgeEmoji = '🕐';
    badgeBg = 'bg-black/15';
    badgeText = 'text-gray-900';
  } else if (att === 'تعويض') {
    bg = 'bg-sky-500 border border-sky-600';
    badgeLabel = 'تعويض';
    badgeEmoji = '🔄';
  } else if (gradeCfg) {
    bg = gradeCfg.bg + ' border border-black/10';
    badgeLabel = gradeCfg.label;
    badgeEmoji = gradeCfg.emoji;
  } else {
    bg = 'bg-emerald-500 border border-emerald-600';
    badgeLabel = 'حاضر';
    badgeEmoji = '✅';
  }

  return {
    bg,
    numColor: 'text-white/70',
    surahColor: 'text-white font-black',
    verseColor: 'text-white/85',
    badgeBg, badgeText, badgeLabel, badgeEmoji,
    attendance: att, isGR, sName, from, to
  };
}

type ViewMode = 'month' | 'heatmap' | 'surah-journey';

export function VisualProgress({ overrideStudentId }: { overrideStudentId?: string }) {
  const { user, isSuperAdmin, isManagement } = useAuth();
  const { students: contextStudents, dailySessions, allUsers, loading: contextLoading } = useStudentContext();
  const router = useRouter();

  // ─── قراءة معلمات الرابط (Query Params) ────────────────────────
  const searchParams = useSearchParams();
  const paramStudentId = searchParams?.get('studentId');
  const paramTeacherId = searchParams?.get('teacherId');
  const paramView = searchParams?.get('view');

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [activeDay, setActiveDay] = useState<{
    date: string;
    records: { sessionNum: number; record: DailyRecord; teacherName: string }[];
  } | null>(null);

  const [showFairEvalInfo, setShowFairEvalInfo] = useState<boolean>(true);

  const isAdmin00 = user?.email === 'admin00@gmail.com' || user?.email === 'abdallah.shafii@gmail.com';
  const isPrincipal = isSuperAdmin || isManagement || isAdmin00;

  // مزامنة المعلمين
  const allTeachers = useMemo(() => {
    return (allUsers ?? []).filter(u => u.role === 'sheikh');
  }, [allUsers]);

  // تسطيح الحصص من السياق
  const allSessionsFlat = useMemo(() => {
    const list: DailySession[] = [];
    Object.values(dailySessions ?? {}).forEach((daySessions) => {
      Object.values(daySessions ?? {}).forEach((session) => {
        list.push(session);
      });
    });
    return list;
  }, [dailySessions]);

  // مزامنة الطالب المختار في حال التمرير كـ Prop
  useEffect(() => {
    if (overrideStudentId) {
      setSelectedStudentId(overrideStudentId);
    }
  }, [overrideStudentId]);

  // تعيين المعلم والتبويب الافتراضي من الرابط
  useEffect(() => {
    if (paramTeacherId) {
      setSelectedTeacherId(paramTeacherId);
    }
  }, [paramTeacherId]);

  useEffect(() => {
    if (paramView && ['month', 'heatmap', 'surah-journey'].includes(paramView)) {
      setViewMode(paramView as ViewMode);
    }
  }, [paramView]);

  // الطلاب المتاحون بناءً على دور المستخدم
  const availableStudents = useMemo(() => {
    let list = contextStudents ?? [];
    if (!isPrincipal && user?.uid) {
      // المشايخ يرون طلابهم فقط
      list = list.filter(s => s.ownerId === user.uid);
    }
    return list.sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
  }, [contextStudents, isPrincipal, user?.uid]);

  // الفرز والتحديد
  useEffect(() => {
    if (availableStudents.length > 0 && !selectedStudentId) {
      if (paramStudentId && availableStudents.some(s => s.id === paramStudentId)) {
        setSelectedStudentId(paramStudentId);
        const targetStudent = availableStudents.find(s => s.id === paramStudentId);
        if (targetStudent && isPrincipal && !paramTeacherId) {
          setSelectedTeacherId(targetStudent.ownerId);
        }
      } else {
        setSelectedStudentId(availableStudents[0].id);
      }
    }
  }, [availableStudents, paramStudentId, paramTeacherId, isPrincipal, selectedStudentId]);

  // تصفية الطلاب حسب المعلم المختار (للمدراء)
  const filteredStudents = useMemo(() => {
    if (isPrincipal && selectedTeacherId !== 'all') {
      return availableStudents.filter(s => s.ownerId === selectedTeacherId);
    }
    return availableStudents;
  }, [availableStudents, selectedTeacherId, isPrincipal]);

  useEffect(() => {
    if (filteredStudents.length > 0) {
      const valid = filteredStudents.some(s => s.id === selectedStudentId);
      if (!valid) setSelectedStudentId(filteredStudents[0].id);
    } else {
      setSelectedStudentId('');
    }
  }, [filteredStudents, selectedStudentId]);

  const selectedStudent = useMemo(() =>
    availableStudents.find(s => s.id === selectedStudentId) || null,
  [availableStudents, selectedStudentId]);

  // استخراج حصص الطالب المختار
  const studentRecords = useMemo(() => {
    if (!selectedStudentId) return [];
    const list: { session: DailySession; record: DailyRecord }[] = [];
    allSessionsFlat.forEach(s => {
      const r = s.records?.find(rx => rx.studentId === selectedStudentId);
      if (r) list.push({ session: s, record: r });
    });
    // فرز الحصص تنازلياً حسب التاريخ
    return list.sort((a, b) => b.session.date.localeCompare(a.session.date));
  }, [allSessionsFlat, selectedStudentId]);

  // حصص الشهر المختار للتقويم الشهري
  const monthStartStr = useMemo(() => format(startOfMonth(selectedMonthDate), 'yyyy-MM-dd'), [selectedMonthDate]);
  const monthEndStr = useMemo(() => format(endOfMonth(selectedMonthDate), 'yyyy-MM-dd'), [selectedMonthDate]);

  const monthlySessions = useMemo(() => {
    return allSessionsFlat.filter(s => s.date >= monthStartStr && s.date <= monthEndStr);
  }, [allSessionsFlat, monthStartStr, monthEndStr]);

  // الإحصائيات العامة للطالب
  const stats = useMemo(() => {
    const present = studentRecords.filter(i =>
      ['حاضر', 'متأخر', 'تعويض'].includes(i.record.attendance)
    );
    const absent = studentRecords.filter(i => i.record.attendance === 'غائب' || i.record.attendance === 'غياب').length;
    const total = studentRecords.length;
    const attendanceRate = total > 0 ? Math.round((present.length / total) * 100) : 0;

    let totalVerses = 0;
    let standardPages = 0;
    const grades: string[] = [];

    present.forEach(i => {
      const r = i.record;
      const sId = r.tasmieSurahId || r.surahId;
      const f = r.tasmieFromVerse || r.fromVerse;
      const t = r.tasmieToVerse || r.toVerse;

      if (sId && f && t && t >= f) {
        totalVerses += (t - f + 1);
        standardPages += calculateStandardPages(sId, f, t);
      }
      if (r.memorization) {
        grades.push(r.memorization);
      }
    });

    const avgGrade = calcAvgGrade(grades);

    // حساب الالتزام المتواصل (Streak)
    let streak = 0;
    const sorted = [...studentRecords].sort((a, b) => b.session.date.localeCompare(a.session.date));
    for (const item of sorted) {
      if (['حاضر', 'متأخر', 'تعويض'].includes(item.record.attendance)) {
        streak++;
      } else if (item.record.attendance === 'غائب' || item.record.attendance === 'غياب') {
        break;
      }
    }

    return {
      attendanceRate,
      present: present.length,
      absent,
      totalVerses,
      standardPages: Number(standardPages.toFixed(2)),
      avgGrade,
      streak
    };
  }, [studentRecords]);

  // بيانات خريطة التكثيف (Heatmap)
  const heatmapData = useMemo(() => {
    const map: Record<string, { verses: number; sessions: number }> = {};
    studentRecords.forEach(i => {
      const d = i.session.date;
      const r = i.record;
      const f = r.tasmieFromVerse || r.fromVerse || 0;
      const t = r.tasmieToVerse || r.toVerse || 0;
      const cnt = (t >= f && f > 0) ? (t - f + 1) : 0;

      if (!map[d]) map[d] = { verses: 0, sessions: 0 };
      map[d].verses += cnt;
      map[d].sessions += 1;
    });
    return map;
  }, [studentRecords]);

  // أيام الشهر للرندرة
  const daysInMonthList = useMemo(() => {
    const start = startOfMonth(selectedMonthDate);
    const end = endOfMonth(selectedMonthDate);
    return eachDayOfInterval({ start, end });
  }, [selectedMonthDate]);

  // فرز الحصص حسب الأيام لتسهيل عرض خلية التقويم
  const monthlyRecordsByDay = useMemo(() => {
    const map: Record<string, { sessionNum: number; record: DailyRecord; teacherId: string }[]> = {};
    monthlySessions.forEach(s => {
      const rec = s.records?.find(r => r.studentId === selectedStudentId);
      if (rec) {
        if (!map[s.date]) map[s.date] = [];
        map[s.date].push({
          sessionNum: s.sessionNumber || 1,
          record: rec,
          teacherId: s.ownerId || ''
        });
      }
    });
    // ترتيب الحصص تصاعدياً حسب رقم الحصة
    Object.keys(map).forEach(d => {
      map[d].sort((a, b) => a.sessionNum - b.sessionNum);
    });
    return map;
  }, [monthlySessions, selectedStudentId]);

  const handleCellClick = (dateStr: string) => {
    const dayRecords = monthlyRecordsByDay[dateStr] || [];
    if (dayRecords.length === 0) {
      setActiveDay(null);
      return;
    }
    const formattedRecords = dayRecords.map(item => {
      const teacher = allUsers.find(u => u.uid === item.teacherId);
      return {
        sessionNum: item.sessionNum,
        record: item.record,
        teacherName: teacher?.displayName || 'شيخ الفوج'
      };
    });
    setActiveDay({
      date: dateStr,
      records: formattedRecords
    });
  };

  if (contextLoading) {
    return (
      <div className="bg-card border rounded-3xl p-16 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
        <p className="text-muted-foreground font-bold text-sm">جارٍ تحميل مرصد الأوراد البصري...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── الفلاتر واختيار الطالب ────────────────────────────── */}
      <div className="bg-card border rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black flex items-center gap-2" style={{ fontFamily: "var(--font-headline)" }}>
              <BookMarked className="w-5 h-5 text-primary" />
              مرصد الأوراد ومسار الحفظ البصري
            </h2>
            <p className="text-xs text-muted-foreground">
              عرض بياني تفصيلي متطور لحفظ الطالب، الانضباط، وسجل الحصص التفاعلي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* فلتر المعلم (للمدراء فقط) */}
            {isPrincipal && allTeachers.length > 0 && (
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="bg-indigo-50/50 dark:bg-white/5 border border-indigo-100 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-indigo-950 dark:text-indigo-300 focus:outline-none"
              >
                <option value="all">كل الأفواج والمعلمين</option>
                {allTeachers.map((t) => (
                  <option key={t.uid} value={t.uid}>{t.displayName} ({t.group || 'بدون اسم'})</option>
                ))}
              </select>
            )}

            {/* اختيار الطالب */}
            {filteredStudents.length > 0 ? (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="bg-primary/5 dark:bg-white/5 border border-primary/10 rounded-xl px-3 py-2 text-xs font-bold text-primary focus:outline-none min-w-[200px]"
              >
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-500 font-bold bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl">لا يوجد طلاب نشطون</p>
            )}
          </div>
        </div>

        {/* شريط تبديل طريقة العرض */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit select-none">
          {[
            { key: 'month', label: 'التقويم الشهري', icon: Calendar },
            { key: 'heatmap', label: 'خريطة التكثيف (Heatmap)', icon: Layers },
            { key: 'surah-journey', label: 'رحلة السور والإنجاز', icon: Trophy },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key as ViewMode)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                viewMode === key ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {selectedStudent && (
        <>
          {showFairEvalInfo && (
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-3xl p-5 border border-indigo-850 shadow-xl space-y-4 relative overflow-hidden animate-in fade-in duration-300">
              {/* Background decorative blob */}
              <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-16 -top-16 w-48 h-48 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              
              <button
                onClick={() => setShowFairEvalInfo(false)}
                className="absolute top-4 left-4 text-indigo-200 hover:text-white transition-colors"
                title="إخفاء الإرشاد"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 bg-indigo-800/30 rounded-2xl shadow-inner">⚖️</span>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black tracking-wide" style={{ fontFamily: "var(--font-headline)" }}>
                    نظام التقييم العادل والمكافئ القياسي للأوراد
                  </h3>
                  <p className="text-[10px] text-indigo-200/80 font-bold">الآلية التربوية والتقنية لاحتساب جهود فرسان القرآن ومشايخهم</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-3.5 space-y-1">
                  <p className="text-xs font-black text-indigo-300">📊 حساب الجهد الفعلي بالآيات</p>
                  <p className="text-[10px] text-indigo-200/70 leading-relaxed font-bold">
                    لا يتساوى تقييم "ممتاز" لحفظ 3 آيات قصيرة مع 20 آية طويلة. يقوم النظام بربط التقييم بنسبة عدد الآيات التي قرأها الطالب في الحصة من إجمالي السورة، وحجم صفحاتها القياسية.
                  </p>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-3.5 space-y-1">
                  <p className="text-xs font-black text-indigo-300">⏱️ آلية الاستدراك والتأخر</p>
                  <p className="text-[10px] text-indigo-200/70 leading-relaxed font-bold">
                    إذا تخلّف الطالب عن موعد التسميع، يُمنح فرصة "الاستدراك" لاحقاً لحفظ ورده، مع احتساب معامل عقوبة التأخر (خصم 20% من تقييم الحفظ) تشجيعاً على الانضباط.
                  </p>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-3.5 space-y-1">
                  <p className="text-xs font-black text-indigo-300">🔄 الحصص التعويضية الفردية</p>
                  <p className="text-[10px] text-indigo-200/70 leading-relaxed font-bold">
                    يمكن للفرسان تعويض حصة غياب سابقة عبر جلسة تسميع فردية مع الشيخ. التعويض يمنح الطالب نقاط حضور تعويضية (+3.5) ويرفع عقوبة الغياب الكبيرة تلقائياً.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── بطاقات الإحصائيات السريعة ───────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-2xl p-4 text-center space-y-1">
              <p className="text-xl">🔥</p>
              <p className="text-xl font-black text-foreground" style={{ fontFamily: "var(--font-headline)" }}>
                {stats.streak} حصة
              </p>
              <p className="text-[10px] text-muted-foreground font-bold">الالتزام المتواصل</p>
            </div>

            <div className="bg-card border rounded-2xl p-4 text-center space-y-1">
              <p className="text-xl">📈</p>
              <p className="text-xl font-black text-foreground" style={{ fontFamily: "var(--font-headline)" }}>
                {stats.attendanceRate}%
              </p>
              <p className="text-[10px] text-muted-foreground font-bold">نسبة المواظبة</p>
            </div>

            <div className="bg-card border rounded-2xl p-4 text-center space-y-1">
              <p className="text-xl">📖</p>
              <p className="text-xl font-black text-foreground" style={{ fontFamily: "var(--font-headline)" }}>
                {stats.standardPages} صفحة
              </p>
              <p className="text-[10px] text-muted-foreground font-bold">المكافئ القياسي للحفظ</p>
            </div>

            <div className="bg-card border rounded-2xl p-4 text-center space-y-1">
              <p className="text-xl">{stats.avgGrade.emoji || '⭐'}</p>
              <p className="text-xl font-black text-foreground" style={{ fontFamily: "var(--font-headline)" }}>
                {stats.avgGrade.label}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold">معدل جودة الحفظ</p>
            </div>
          </div>

          {/* ─── رندرة التبويبات ─────────────────────────────────── */}

          {/* التبويب الأول: التقويم الشهري التفصيلي */}
          {viewMode === 'month' && (
            <div className="bg-card border rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-1.5" style={{ fontFamily: "var(--font-headline)" }}>
                  <Calendar className="w-4 h-4 text-primary" />
                  التقويم التفصيلي للحصص والتقييمات
                </h3>

                <div className="flex items-center gap-2 select-none">
                  <button
                    onClick={() => setSelectedMonthDate(subMonths(selectedMonthDate, 1))}
                    className="p-2 border rounded-xl hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="text-xs font-black min-w-[100px] text-center" style={{ fontFamily: "var(--font-headline)" }}>
                    {format(selectedMonthDate, 'MMMM yyyy', { locale: ar })}
                  </span>
                  <button
                    onClick={() => setSelectedMonthDate(addMonths(selectedMonthDate, 1))}
                    className="p-2 border rounded-xl hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* خلية عرض تفاصيل اليوم النشط */}
              {activeDay && (
                <div className="bg-primary/5 dark:bg-white/5 border border-primary/10 rounded-2xl p-4 space-y-3 relative animate-in fade-in slide-in-from-top-2 duration-300">
                  <button
                    onClick={() => setActiveDay(null)}
                    className="absolute top-3 left-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-xs font-black text-primary" style={{ fontFamily: "var(--font-headline)" }}>
                    📅 تفاصيل يوم: {format(parseISO(activeDay.date), 'EEEE dd MMMM yyyy', { locale: ar })}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {activeDay.records.map((item, idx) => {
                      const theme = getRecordTheme({ sessionNum: item.sessionNum, record: item.record, teacherId: '' });
                      return (
                        <div key={idx} className="bg-background border rounded-xl p-3 flex justify-between items-center gap-3">
                          <div className="space-y-1 min-w-0">
                            <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded">حصة {item.sessionNum === 1 ? 'أولى' : 'ثانية'}</span>
                            {theme.sName ? (
                              <p className="text-xs font-black text-foreground truncate mt-1">
                                {theme.sName} ({theme.from} - {theme.to})
                              </p>
                            ) : (
                              <p className="text-xs font-bold text-muted-foreground mt-1">
                                {theme.isGR ? 'مراجعة أوراد' : 'بدون ورد'}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground font-medium">الشيخ: {item.teacherName}</p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${theme.bg.split(' ')[0]} text-white shrink-0 shadow-xs`}>
                            {theme.badgeEmoji} {theme.badgeLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* شبكة التقويم */}
              <div className="grid grid-cols-7 gap-2 text-center select-none pt-2">
                {DAY_NAMES.map(name => (
                  <span key={name} className="text-[10px] font-bold text-muted-foreground pb-2">{name}</span>
                ))}

                {/* خلايا فارغة في بداية التقويم لمطابقة اليوم الأول في الأسبوع */}
                {Array.from({ length: getDay(startOfMonth(selectedMonthDate)) }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square opacity-0" />
                ))}

                {daysInMonthList.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const records = monthlyRecordsByDay[dateStr] || [];
                  const hasRecord = records.length > 0;

                  // إعدادات الخلية في حال وجود حصتين بحالتين مختلفتين
                  let cellStyle: React.CSSProperties = {};
                  let cellClassName = '';
                  let item1: any = undefined;
                  let item2: any = undefined;

                  if (hasRecord) {
                    if (records.length === 1) {
                      const theme = getRecordTheme(records[0]);
                      cellClassName = theme.bg;
                    } else if (records.length >= 2) {
                      item1 = getRecordTheme(records[0]);
                      item2 = getRecordTheme(records[1]);
                      const color1 = getRecordColor(records[0]);
                      const color2 = getRecordColor(records[1]);

                      if (color1 === color2) {
                        cellClassName = item1.bg;
                      } else {
                        cellClassName = 'border border-black/10 shadow-xs';
                        cellStyle = {
                          background: `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)`
                        };
                      }
                    }
                  } else {
                    cellClassName = 'bg-slate-50 dark:bg-slate-800/10 border border-slate-200 dark:border-slate-700/40';
                  }

                  return (
                    <div
                      key={dateStr}
                      onClick={() => hasRecord && handleCellClick(dateStr)}
                      style={cellStyle}
                      className={`aspect-square rounded-2xl flex flex-col justify-between p-1.5 transition-all duration-300 relative ${
                        hasRecord ? 'cursor-pointer hover:scale-[1.03] hover:shadow-sm' : ''
                      } ${cellClassName}`}
                    >
                      <span className={`text-[11px] font-bold self-start ${hasRecord ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                        {format(day, 'd')}
                      </span>

                      {/* حبوب الحصص السريعة بداخل الخلية */}
                      {hasRecord && (
                        <div className="flex gap-1 justify-center w-full mt-auto">
                          {records.length === 1 ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-black/15 shrink-0" />
                          ) : (
                            <>
                              <span className={`w-1.5 h-1.5 rounded-full ${cellStyle.background ? 'bg-white border border-gray-300' : 'bg-black/15'} shrink-0`} />
                              <span className={`w-1.5 h-1.5 rounded-full ${cellStyle.background ? 'bg-white border border-gray-300' : 'bg-black/15'} shrink-0`} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* دليل الألوان والمؤشرات */}
              <div className="border-t pt-4 flex flex-wrap items-center justify-center gap-4 select-none text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600 block" />
                  <span>ممتاز</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500 border border-blue-600 block" />
                  <span>جيد جداً</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500 border border-amber-600 block" />
                  <span>جيد</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-purple-650 border border-purple-750 block" />
                  <span>مراجعة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-sky-550 border border-sky-650 block" />
                  <span>تعويض</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-500 border border-red-650 block" />
                  <span>غياب / لم يحفظ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-purple-600 border block" />
                  <span>حصتان مختلفتان</span>
                </div>
              </div>
            </div>
          )}

          {/* التبويب الثاني: خريطة التكثيف والالتزام (Heatmap) */}
          {viewMode === 'heatmap' && (
            <div className="bg-card border rounded-3xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-black flex items-center gap-1.5" style={{ fontFamily: "var(--font-headline)" }}>
                <Layers className="w-4 h-4 text-primary" />
                خريطة التكثيف السنوي لحجم المحفوظ
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                توضح الخريطة نشاط الطالب وحجم الآيات المحفوظة في كل يوم على مدار الـ 120 يوماً الماضية، حيث تعكس الألوان الداكنة كثافة أكبر في التسميع والحفظ.
              </p>

              {/* رندرة شبكة التكثيف */}
              <div className="overflow-x-auto">
                <div className="flex gap-1.5 p-1 select-none min-w-[650px] justify-center">
                  {Array.from({ length: 17 }).map((_, colIdx) => {
                    const colDate = new Date();
                    colDate.setDate(colDate.getDate() - (16 - colIdx) * 7);

                    return (
                      <div key={colIdx} className="flex flex-col gap-1.5">
                        {Array.from({ length: 7 }).map((_, rowIdx) => {
                          const dayDate = new Date(colDate);
                          dayDate.setDate(dayDate.getDate() + rowIdx);
                          const dateStr = format(dayDate, 'yyyy-MM-dd');
                          const cell = heatmapData[dateStr];
                          const lvl = getHeatLevel(cell?.verses || 0);

                          return (
                            <div
                              key={rowIdx}
                              className={`w-7.5 h-7.5 rounded-lg border border-black/5 flex items-center justify-center text-[8px] font-bold ${HEATMAP_COLORS[lvl]}`}
                              title={`${format(dayDate, 'dd MMMM yyyy')}: ${cell?.verses || 0} آية (${cell?.sessions || 0} حصص)`}
                            >
                              {cell?.verses > 0 ? cell.verses : ''}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* دليل خريطة التكثيف */}
              <div className="flex items-center justify-center gap-2 select-none text-[10px] text-muted-foreground pt-2 border-t">
                <span>أقل حفظاً</span>
                <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800/60 block" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-100 dark:bg-emerald-900/40 block" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-200 dark:bg-emerald-800/60 block" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-300 dark:bg-emerald-700/70 block" />
                <span className="w-3.5 h-3.5 rounded bg-emerald-400 dark:bg-emerald-600/80 block" />
                <span>أكثر حفظاً (+20 آية)</span>
              </div>
            </div>
          )}

          {/* التبويب الثالث: رحلة السور والإنجاز */}
          {viewMode === 'surah-journey' && (
            <div className="bg-card border rounded-3xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-black flex items-center gap-1.5" style={{ fontFamily: "var(--font-headline)" }}>
                <Trophy className="w-4 h-4 text-primary" />
                سجل إنجاز السور والورد القرآني
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                قائمة بالحصص التاريخية التي سجلها الطالب في الحفظ والتسميع، مرتبة تنازلياً لمتابعة الخط الزمني لتقدمه.
              </p>

              {/* الجدول التفصيلي لرحلة الطالب */}
              <div className="overflow-hidden border rounded-2xl divide-y divide-border bg-background">
                {studentRecords.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground font-medium text-xs">لا يوجد أوراد مسجلة بعد في هذا الفوج.</div>
                ) : (
                  studentRecords.map(({ session, record }, idx) => {
                    const sName = surahs.find(s => s.id === (record.tasmieSurahId || record.surahId))?.name || 'سورة مجهولة';
                    const from = record.tasmieFromVerse || record.fromVerse || 0;
                    const to = record.tasmieToVerse || record.toVerse || 0;
                    const pages = calculateStandardPages(record.tasmieSurahId || record.surahId || 0, from, to);
                    const gradeTheme = getRecordTheme({ sessionNum: session.sessionNumber || 1, record, teacherId: '' });

                    return (
                      <div key={idx} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs font-black text-foreground" style={{ fontFamily: "var(--font-headline)" }}>
                            {format(parseISO(session.date), 'EEEE dd MMMM yyyy', { locale: ar })}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold">
                            نوع الحصة: {session.sessionType} ({session.sessionNumber === 1 ? 'الأولى' : 'الثانية'})
                          </p>
                        </div>

                        {to >= from && from > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📖</span>
                            <div className="text-right">
                              <p className="text-xs font-black text-foreground">{sName}</p>
                              <p className="text-[10px] text-muted-foreground font-bold">الآيات: {from} - {to} ({to - from + 1} آيات)</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground font-bold">
                            {gradeTheme.isGR ? '🔄 مراجعة أوراد وأحزاب' : '✅ حضور وانضباط فقط'}
                          </p>
                        )}

                        <div className="flex items-center gap-4 shrink-0 select-none">
                          {pages > 0 && (
                            <div className="text-center hidden sm:block">
                              <p className="text-xs font-black text-indigo-650 dark:text-indigo-400">+{pages}</p>
                              <p className="text-[9px] text-muted-foreground font-medium leading-none mt-0.5">صفحة مكافئة</p>
                            </div>
                          )}
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${gradeTheme.bg.split(' ')[0]} text-white shadow-xs`}>
                            {gradeTheme.badgeEmoji} {gradeTheme.badgeLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
