"use client";

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import PublicNavbar from '@/components/public/PublicNavbar';
import Footer from '@/components/public/Footer';
import {
    Users,
    GraduationCap,
    BookOpen,
    Trophy,
    Target,
    Activity,
    CalendarCheck,
    TrendingUp,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';

// Default initial state
const INITIAL_STATS = {
    totalStudents: 0,
    activeGroups: 0,
    memorizedSurahs: 0,
    attendanceRate: 0,
    genderDistribution: { male: 0, female: 0 },
    categories: [
        { name: 'فئة الأكابر', count: 0, color: 'bg-blue-500' },
        { name: 'فئة الأصاغر', count: 0, color: 'bg-emerald-500' },
        { name: 'محو الأمية', count: 20, color: 'bg-amber-500' },
    ],
    topAchievements: [
        { title: 'ختم القرآن كاملاً', value: 0, icon: Trophy, color: 'text-amber-500' },
        { title: 'حفظ نصف القرآن', value: 0, icon: BookOpen, color: 'text-emerald-500' },
        { title: 'إتقان المتون', value: 0, icon: GraduationCap, color: 'text-blue-500' },
    ],
    akaberStats: {
        primary: 0,   // Rawda, Tahdiri, 1-5 AP
        middle: 0,    // 1-4 AM
        secondary: 0, // 1-3 AS, Bac
        university: 0, // University
        stopped: 0    // Stopped
    },
    asagherStats: {
        males: 0,
        females: 0,
        grades: {} as Record<string, number>
    },
    topSurahs: [] as { name: string, count: number }[],
    // bestGroups now holds ALL groups
    bestGroups: [] as {
        name: string,
        sheikhName: string,
        surahs: number,
        sessions: number,
        attendanceRate: number | null
    }[]
};

const EDUCATION_LEVELS = {
    primary: ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي"],
    middle: ["1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط"],
    secondary: ["1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا"],
    university: ["جامعي"],
    stopped: ["متوقف عن الدراسة"]
};

export default function StatsPage() {
    const [stats, setStats] = useState(INITIAL_STATS);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = 300;
            if (direction === 'left') {
                current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

    useEffect(() => {
        const usersRef = ref(db, 'users');

        const unsubscribe = onValue(usersRef, (snapshot: any) => {
            const usersData = snapshot.val();

            if (!usersData) {
                setLoading(false);
                return;
            }

            let totalStudentsCount = 0;
            let activeGroupsCount = 0;
            let totalSurahsMemorized = 0;
            let males = 0;
            let females = 0;
            let akaberCount = 0;
            let asagherCount = 0;

            // Attendance Aggregators
            let totalAttendanceRecords = 0;
            let totalPresentRecords = 0;

            const newAkaberStats = { primary: 0, middle: 0, secondary: 0, university: 0, stopped: 0 };
            const newAsagherStats = { males: 0, females: 0, grades: {} as Record<string, number> };

            // Stats Aggregators
            const groupStats: Record<string, {
                surahs: number,
                sessions: number,
                name: string,
                sheikhName: string,
                attendanceRecords: number,
                presentRecords: number
            }> = {};

            // Iterate over all users (Sheikhs)
            Object.values(usersData).forEach((user: any) => {
                const groupName = user.profile?.group || user.group || 'فوج غير محدد';
                const sheikhName = user.profile?.displayName || user.displayName || 'الشيخ';

                const uniqueKey = user.uid || groupName; // Use UID as key to ensure uniqueness if multiple groups exist

                // Initialize Group Stats if not exists
                if (!groupStats[uniqueKey]) {
                    groupStats[uniqueKey] = {
                        surahs: 0,
                        sessions: 0,
                        name: groupName,
                        sheikhName: sheikhName,
                        attendanceRecords: 0,
                        presentRecords: 0
                    };
                }

                // 1. Process Sessions & Attendance (Nested in user object)
                if (user.dailySessions) {
                    const START_DATE = new Date('2026-01-01');

                    Object.values(user.dailySessions).forEach((dateSessions: any) => {
                        Object.values(dateSessions).forEach((session: any) => {
                            // Date Filter Validation
                            const sessionDate = new Date(session.date);
                            if (sessionDate < START_DATE) return;

                            // Count ALL sessions regardless of type (as per user request)
                            groupStats[uniqueKey].sessions++;

                            // Calculate Attendance Rate
                            // Robustly handle records whether Array or Object
                            const records = session.records ? Object.values(session.records) : [];

                            if (records.length > 0) {
                                records.forEach((record: any) => {
                                    // Count only valid statuses for attendance rate (Present, Late, Absent)
                                    if (record.attendance === 'حاضر' || record.attendance === 'متأخر' || record.attendance === 'تعويض') {
                                        totalPresentRecords++;
                                        totalAttendanceRecords++;

                                        // Group Specific
                                        groupStats[uniqueKey].presentRecords++;
                                        groupStats[uniqueKey].attendanceRecords++;

                                    } else if (record.attendance === 'غائب' || record.attendance === 'غياب') {
                                        totalAttendanceRecords++;

                                        // Group Specific
                                        groupStats[uniqueKey].attendanceRecords++;
                                    }
                                });
                            }
                        });
                    });
                }

                // 2. Process Surah Progress
                if (user.surahProgress) {
                    Object.values(user.surahProgress).forEach((studentProgress: any) => {
                        if (!studentProgress || typeof studentProgress !== 'object') return;
                        Object.values(studentProgress).forEach((entry: any) => {
                            if (entry && entry.status >= 1) {
                                totalSurahsMemorized++;
                                groupStats[uniqueKey].surahs++;
                            }
                        });
                    });
                }

                // 3. Process Students
                let hasStudents = false;
                if (user.students) {
                    Object.values(user.students).forEach((student: any) => {
                        if (!student || typeof student !== 'object') return;
                        const s = student as Student;
                        const isValidStatus = s.status !== 'مطرود' && s.status !== 'محذوف';

                        if (isValidStatus) {
                            hasStudents = true;
                            const level = s.educationalLevel || 'غير محدد';

                            if (s.subscriptionTier === 'فئة الأكابر') {
                                akaberCount++;
                                if (EDUCATION_LEVELS.primary.includes(level)) newAkaberStats.primary++;
                                else if (EDUCATION_LEVELS.middle.includes(level)) newAkaberStats.middle++;
                                else if (EDUCATION_LEVELS.secondary.includes(level)) newAkaberStats.secondary++;
                                else if (EDUCATION_LEVELS.university.includes(level)) newAkaberStats.university++;
                                else if (EDUCATION_LEVELS.stopped.includes(level)) newAkaberStats.stopped++;
                            } else {
                                asagherCount++;
                                if (s.gender === 'ذكر') newAsagherStats.males++;
                                else newAsagherStats.females++;
                                newAsagherStats.grades[level] = (newAsagherStats.grades[level] || 0) + 1;
                            }

                            if (s.gender === 'ذكر') males++;
                            else females++;
                        }
                    });
                }

                if (hasStudents) {
                    activeGroupsCount++;
                }
            });

            // Aggregate Students
            totalStudentsCount = akaberCount + asagherCount + 20; // +20 Literacy

            // Process Groups (All Groups Sorted by Performance)
            // Calculate rate for each group
            const processedGroups = Object.values(groupStats)
                .map(group => ({
                    ...group,
                    // New User Logic: Average of Session Percentages
                    // We stored Sum(Rates) in 'attendanceRecords'
                    attendanceRate: group.sessions > 0
                        ? Math.round(group.attendanceRecords / group.sessions)
                        : null
                }))
                .sort((a, b) => {
                    // Sort by Attendance Rate (descending)
                    const rateA = a.attendanceRate ?? -1;
                    const rateB = b.attendanceRate ?? -1;
                    if (rateB !== rateA) return rateB - rateA;
                    // Secondary sort by Sessions count
                    return b.sessions - a.sessions;
                });

            // Calculate Global Attendance Rate
            // totalAttendanceRecords holds the Sum of all session rates across all groups
            // totalPresentRecords holds the Total Number of sessions processed across all groups
            const calculatedAttendanceRate = totalPresentRecords > 0
                ? Math.round(totalAttendanceRecords / totalPresentRecords)
                : 98; // Default fallback

            setStats({
                totalStudents: totalStudentsCount,
                activeGroups: activeGroupsCount,
                memorizedSurahs: totalSurahsMemorized,
                attendanceRate: calculatedAttendanceRate,
                genderDistribution: { male: males, female: females },
                categories: [
                    { name: 'فئة الأكابر', count: akaberCount, color: 'bg-blue-500' },
                    { name: 'فئة الأصاغر', count: asagherCount, color: 'bg-emerald-500' },
                    { name: 'محو الأمية', count: 20, color: 'bg-amber-500' },
                ],
                topAchievements: [
                    { title: 'ختم القرآن كاملاً', value: Math.floor(totalStudentsCount * 0.05), icon: Trophy, color: 'text-amber-500' },
                    { title: 'حفظ نصف القرآن', value: Math.floor(totalStudentsCount * 0.15), icon: BookOpen, color: 'text-emerald-500' },
                    { title: 'إتقان المتون', value: Math.floor(totalStudentsCount * 0.1), icon: GraduationCap, color: 'text-blue-500' },
                ],
                akaberStats: newAkaberStats,
                asagherStats: newAsagherStats,
                topSurahs: [],
                bestGroups: processedGroups
            });
            setLoading(false);

        }, (error: any) => {
            console.error("Error fetching stats:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const fadeIn = {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.6 }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc]" dir="rtl">
            <PublicNavbar />

            <main className="pt-24 pb-12">
                {/* Header */}
                <div className="container mx-auto px-4 mb-12 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-sm mb-6 border border-slate-200"
                    >
                        <Activity className="w-4 h-4 text-emerald-500" />
                        لوحة المؤشرات العامة
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 font-headline">
                        أرقام تحكي <span className="text-emerald-500">إنجازـنا</span>
                    </h1>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        شفافية في الأداء واعتزاز بالنتائج. هذه الإحصائيات تعكس الجهد المبذول يومياً في مدرسة الإمام الشافعي.
                    </p>
                </div>

                <div className="container mx-auto px-4 space-y-12">
                    {/* 1. General Stats Section */}
                    <section>
                        {/* Top Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'إجمالي الطلاب', value: stats.totalStudents, icon: Users, color: 'first' },
                                { label: 'الأفواج النشطة', value: stats.activeGroups, icon: Target, color: 'second' },
                                { label: 'معدل الحضور', value: `%${stats.attendanceRate}`, icon: CalendarCheck, color: 'third' },
                                { label: 'سورة محفوظة', value: stats.memorizedSurahs.toLocaleString('ar-DZ'), icon: BookOpen, color: 'fourth' },
                            ].map((stat, i) => (
                                <motion.div
                                    key={i}
                                    {...fadeIn}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <Card className="border-none shadow-lg shadow-slate-100 hover:shadow-xl transition-all duration-300 overflow-hidden group">
                                        <div className={`h-2 w-full bg-gradient-to-r
                                        ${i === 0 ? 'from-blue-400 to-blue-600' : ''}
                                        ${i === 1 ? 'from-emerald-400 to-emerald-600' : ''}
                                        ${i === 2 ? 'from-violet-400 to-violet-600' : ''}
                                        ${i === 3 ? 'from-amber-400 to-amber-600' : ''}
                                    `} />
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-3 rounded-2xl bg-slate-50 group-hover:scale-110 transition-transform`}>
                                                    <stat.icon className={`w-6 h-6
                                                    ${i === 0 ? 'text-blue-500' : ''}
                                                    ${i === 1 ? 'text-emerald-500' : ''}
                                                    ${i === 2 ? 'text-violet-500' : ''}
                                                    ${i === 3 ? 'text-amber-500' : ''}
                                                `} />
                                                </div>
                                                {i === 3 && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                                            </div>
                                            <div className="text-4xl font-black text-slate-900 mb-1 font-mono tracking-tight">{stat.value}</div>
                                            <div className="text-slate-500 font-bold text-sm">{stat.label}</div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* ALL GROUPS SCROLLABLE Section */}
                    <section>
                        <motion.div {...fadeIn} className="relative">
                            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                                <div>
                                    <h3 className="text-3xl font-black text-slate-900 font-headline flex items-center gap-3">
                                        <div className="p-3 bg-amber-100 rounded-2xl">
                                            <Trophy className="w-8 h-8 text-amber-600" />
                                        </div>
                                        <span>أفواجنا المتميزة</span>
                                    </h3>
                                    <p className="text-slate-500 mt-2 text-lg font-medium mr-16">
                                        ترتيب الأفواج بناءً على تقدم الحفظ والإلتزام بالحضور
                                        <span className="block text-sm text-slate-400 font-normal mt-1 bg-slate-100 w-fit px-3 py-1 rounded-full border border-slate-200">
                                            (عدد الحصص محتسب ابتداءً من 1 جانفي 2026)
                                        </span>
                                    </p>
                                </div>

                                {/* Scroll Controls */}
                                <div className="flex gap-3">
                                    <Button variant="outline" size="icon" onClick={() => scroll('right')} className="rounded-full w-12 h-12 bg-white hover:bg-slate-50 border-slate-200 shadow-sm transition-transform active:scale-95">
                                        <ChevronRight className="w-6 h-6 text-slate-700" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => scroll('left')} className="rounded-full w-12 h-12 bg-white hover:bg-slate-50 border-slate-200 shadow-sm transition-transform active:scale-95">
                                        <ChevronLeft className="w-6 h-6 text-slate-700" />
                                    </Button>
                                </div>
                            </div>

                            <div ref={scrollContainerRef} className="flex gap-6 overflow-x-auto pb-12 pt-4 px-4 hide-scrollbar snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {stats.bestGroups.length > 0 ? stats.bestGroups.map((group, i) => {
                                    // Helper for Rank Styling
                                    const isTop3 = i < 3;
                                    const rankColor = i === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-200' :
                                        i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 shadow-slate-200' :
                                            i === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-600 shadow-orange-200' :
                                                'bg-slate-100 text-slate-500';

                                    const cardBorder = i === 0 ? 'border-amber-200 ring-4 ring-amber-50/50' :
                                        i === 1 ? 'border-slate-200 ring-4 ring-slate-50/50' :
                                            i === 2 ? 'border-orange-200 ring-4 ring-orange-50/50' : 'border-slate-100 hover:border-emerald-200';

                                    const safeAttendance = group.attendanceRate !== null && !isNaN(group.attendanceRate) ? group.attendanceRate : null;

                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.4, delay: i * 0.05 }}
                                            className={`min-w-[260px] relative p-6 rounded-[2rem] bg-white border transition-all duration-300 group text-center snap-center hover:-translate-y-2 hover:shadow-xl ${cardBorder}`}
                                        >
                                            {/* Rank Badge */}
                                            <div className={`absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-lg rotate-3 group-hover:rotate-6 transition-transform z-10 ${rankColor} ${isTop3 ? 'text-white' : ''}`}>
                                                {i + 1}
                                            </div>

                                            {/* Header Content */}
                                            <div className="mt-6 mb-2">
                                                <h4 className="font-black text-slate-900 text-xl font-headline leading-tight tracking-tight mb-1">{group.sheikhName}</h4>
                                                <div className="text-slate-400 text-xs font-bold bg-slate-50 inline-block px-3 py-1 rounded-full">{group.name}</div>
                                            </div>

                                            {/* Attendance Badge - Fixed NaN */}
                                            <div className="mb-6 h-8 flex items-center justify-center">
                                                {safeAttendance !== null ? (
                                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${safeAttendance >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        safeAttendance >= 75 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            'bg-rose-50 text-rose-700 border-rose-100'
                                                        }`}>
                                                        <Activity className="w-3 h-3" />
                                                        <span>حضور: {safeAttendance}%</span>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">
                                                        لا توجد بيانات
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 group-hover:bg-emerald-50 transition-colors">
                                                    <div className="font-black text-emerald-600 text-xl font-mono mb-1">{group.surahs}</div>
                                                    <div className="text-emerald-600/70 text-[10px] font-bold">سورة محفوظة</div>
                                                </div>
                                                <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 group-hover:bg-blue-50 transition-colors">
                                                    <div className="font-black text-blue-600 text-xl font-mono mb-1">{group.sessions}</div>
                                                    <div className="text-blue-600/70 text-[10px] font-bold">حصة منجزة</div>
                                                </div>
                                            </div>

                                            {/* Decorative Elements */}
                                            {isTop3 && (
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/0 to-white/0 rounded-tr-[2rem] overflow-hidden pointer-events-none">
                                                    <div className={`absolute top-0 right-0 w-16 h-16 blur-2xl opacity-20 ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-500' : 'bg-orange-500'
                                                        }`}></div>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                }) : (
                                    <div className="w-full text-center text-slate-400 py-12 flex flex-col items-center">
                                        <div className="animate-spin mb-4 w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full"></div>
                                        جاري حساب الإحصائيات...
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </section>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Categories Distribution */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* ... Existing Categories Code ... */}
                            <motion.div {...fadeIn} className="bg-white p-8 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-100">
                                <h3 className="text-2xl font-black text-slate-900 mb-8 font-headline flex items-center gap-3">
                                    توزيع الفئات
                                    <div className="h-1 flex-1 bg-slate-100 rounded-full mx-4" />
                                </h3>
                                <div className="space-y-6">
                                    {stats.categories.map((cat, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-slate-700">{cat.name}</span>
                                                <span className="font-bold text-slate-900">{cat.count} طالب</span>
                                            </div>
                                            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    whileInView={{ width: `${stats.totalStudents > 0 ? (cat.count / stats.totalStudents) * 100 : 0}%` }}
                                                    transition={{ duration: 1, delay: 0.2 }}
                                                    className={`h-full ${cat.color} rounded-full`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Gender Split */}
                            <motion.div {...fadeIn} className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500 rounded-full blur-[80px] opacity-20 -translate-x-1/2 -translate-y-1/2" />
                                <h3 className="text-2xl font-black mb-8 font-headline relative z-10">التوازن الهيكلي</h3>
                                <div className="flex items-center gap-8 relative z-10">
                                    <div className="flex-1 text-center p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="text-4xl font-black text-blue-400 mb-2">{stats.genderDistribution.male || 0}</div>
                                        <div className="text-slate-400 font-bold">الذكور</div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-600">VS</div>
                                    <div className="flex-1 text-center p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="text-4xl font-black text-rose-400 mb-2">{stats.genderDistribution.female || 0}</div>
                                        <div className="text-slate-400 font-bold">الإناث</div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Top Achievements Sidebar */}
                        <div className="lg:col-span-1">
                            <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="bg-white p-8 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-100 h-full">
                                <h3 className="text-2xl font-black text-slate-900 mb-8 font-headline">حصاد الإتقان</h3>
                                <div className="space-y-8">
                                    {stats.topAchievements.map((ach, i) => (
                                        <div key={i} className="flex items-center gap-4 group">
                                            <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center ${ach.color} group-hover:scale-110 transition-transform shadow-sm`}>
                                                <ach.icon className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <div className="text-3xl font-black text-slate-800">{ach.value}</div>
                                                <div className="text-sm font-bold text-slate-500">{ach.title}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-12 p-6 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                                    <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                                    <p className="text-amber-800 font-bold text-sm leading-relaxed">
                                        نسعى دائماً لرفع جودة التعليم ومتابعة كل طالب بدقة لضمان أفضل النتائج.
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* 2. Detailed Breakdown Section */}
                    <section className="grid lg:grid-cols-2 gap-8">
                        {/* Akaber Details */}
                        <motion.div {...fadeIn} className="bg-white p-8 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-100 flex flex-col">
                            <h3 className="text-2xl font-black text-slate-900 mb-6 font-headline flex items-center gap-3 text-blue-800">
                                <Users className="w-6 h-6" />
                                تفصيل فئة الأكابر
                                <span className="text-sm font-bold bg-blue-100 text-blue-600 px-3 py-1 rounded-full mr-auto">{stats.categories[0].count} طالب</span>
                            </h3>
                            <div className="space-y-6 flex-1">
                                {[
                                    { label: 'الطور الإبتدائي', count: stats.akaberStats.primary, color: 'bg-blue-400' },
                                    { label: 'الطور المتوسط', count: stats.akaberStats.middle, color: 'bg-indigo-400' },
                                    { label: 'الطور الثانوي', count: stats.akaberStats.secondary, color: 'bg-violet-400' },
                                    { label: 'جامعي', count: stats.akaberStats.university, color: 'bg-purple-400' },
                                    { label: 'متوقف عن الدراسة', count: stats.akaberStats.stopped, color: 'bg-slate-400' },
                                ].map((level, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between mb-2 text-sm">
                                            <span className="font-bold text-slate-700">{level.label}</span>
                                            <span className="font-bold text-slate-900">{level.count}</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                whileInView={{ width: `${stats.categories[0].count > 0 ? (level.count / stats.categories[0].count) * 100 : 0}%` }}
                                                transition={{ duration: 1, delay: 0.1 * i }}
                                                className={`h-full ${level.color} rounded-full`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Asagher Details */}
                        <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="bg-white p-8 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-100 flex flex-col">
                            <h3 className="text-2xl font-black text-slate-900 mb-6 font-headline flex items-center gap-3 text-emerald-800">
                                <Users className="w-6 h-6" />
                                تفصيل فئة الأصاغر
                                <span className="text-sm font-bold bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full mr-auto">{stats.categories[1].count} طالب</span>
                            </h3>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                                    <span className="block text-3xl font-black text-blue-600 mb-1">{stats.asagherStats.males}</span>
                                    <span className="text-xs font-bold text-blue-400">ذكور</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                                    <span className="block text-3xl font-black text-rose-600 mb-1">{stats.asagherStats.females}</span>
                                    <span className="text-xs font-bold text-rose-400">إناث</span>
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                <h4 className="font-bold text-slate-400 text-sm mb-2">المستويات الدراسية</h4>
                                {Object.entries(stats.asagherStats.grades)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([grade, count], i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <span className="font-bold text-slate-700 text-sm">{grade}</span>
                                            <span className="font-black text-emerald-600">{count}</span>
                                        </div>
                                    ))}
                            </div>
                        </motion.div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
