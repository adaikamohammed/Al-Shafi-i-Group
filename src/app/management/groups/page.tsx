"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Users, UserCheck, TrendingUp, Search, Layers, Settings, ListFilter, CheckCircle2, ChevronRight, Loader2, Save } from 'lucide-react';
import { cn, isSheikhMenUser, isSheikhWomenUser, isStudentInMenSheikhs, isStudentInWomenUstadhats } from '@/lib/utils';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';
import { GroupSelector } from '@/components/management/GroupSelector';
import { surahs } from '@/lib/surahs';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useToast } from '@/hooks/use-toast';

export default function GroupsMonitoringPage() {
    const { students, dailySessions, allUsers, selectedGroup, setSelectedGroup, updateSheikhGroupSettings, updateStudent } = useStudentContext();
    const { user, isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();

    // حالات حفظ وتعديل السور الفردية للطلاب
    const [individualSurahs, setIndividualSurahs] = useState<Record<string, number>>({});
    const [isSavingIndividual, setIsSavingIndividual] = useState<Record<string, boolean>>({});

    const isAdmin00 = user?.email === 'admin00@gmail.com' || user?.email === 'abdallah.shafii@gmail.com';
    const isPrincipal = isSuperAdmin || isManagement || isAdmin00;

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    // ─── إعداد التبويبات (Tabs) ───────────────────────────────────
    const [activeTab, setActiveTab] = useState<'settings' | 'monitoring'>('settings');

    // قائمة المشايخ
    const allTeachers = useMemo(() => {
        return allUsers.filter(u => u.role === 'sheikh');
    }, [allUsers]);

    // تحديد الشيخ النشط المختار للإعدادات
    const activeSheikhId = useMemo(() => {
        if (!isPrincipal) return user?.uid || '';
        // بالنسبة للمدير: إذا كان الفلتر المختار شيخ معين نستخدمه، وإلا نختار أول شيخ في القائمة
        if (selectedGroup && selectedGroup !== 'all' && !selectedGroup.endsWith('_all')) {
            const sheikh = allTeachers.find(u => u.uid === selectedGroup);
            if (sheikh) return sheikh.uid;
        }
        return allTeachers[0]?.uid || '';
    }, [isPrincipal, selectedGroup, allTeachers, user?.uid]);

    const activeSheikh = useMemo(() => {
        return allTeachers.find(u => u.uid === activeSheikhId) || null;
    }, [allTeachers, activeSheikhId]);

    // قراءة الإعدادات الحالية للشيخ المختار
    const groupMode = activeSheikh?.settings?.groupMemorizationMode || 'not_set';
    const groupSurahConfig = activeSheikh?.settings?.groupSurah;

    // حالات تعديل إعدادات الفوج
    const [selectedMode, setSelectedMode] = useState<'unified' | 'individual' | 'hybrid' | 'not_set'>('not_set');
    const [selectedSurahId, setSelectedSurahId] = useState<number>(0);
    const [currentVerse, setCurrentVerse] = useState<number>(1);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // تحديث الحالات عند تغيير الشيخ المختار أو إعداداته
    useEffect(() => {
        if (activeSheikh) {
            setSelectedMode(groupMode);
            if (groupSurahConfig) {
                setSelectedSurahId(groupSurahConfig.surahId || 0);
                setCurrentVerse(groupSurahConfig.currentVerse || 1);
            } else {
                setSelectedSurahId(0);
                setCurrentVerse(1);
            }
        }
    }, [activeSheikhId, groupMode, groupSurahConfig, activeSheikh]);

    // ─── التحديث الجماعي للطلاب ──────────────────────────────────
    const [checkedStudents, setCheckedStudents] = useState<Record<string, boolean>>({});
    const [batchSurahId, setBatchSurahId] = useState<number>(0);
    const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);

    // طلاب الفوج النشط المختار
    const activeGroupStudents = useMemo(() => {
        if (!activeSheikhId) return [];
        return students.filter(s => s.ownerId === activeSheikhId && s.status === 'نشط');
    }, [students, activeSheikhId]);

    // حساب آخر تقدم للطلاب من الحصص اليومية
    const studentProgress = useMemo(() => {
        const progressMap = new Map<string, { surahId: number; fromVerse?: number; toVerse: number }>();
        if (!dailySessions) return progressMap;

        // 1. تسطيح كل الحصص
        const allSessions: any[] = Object.values(dailySessions)
            .flatMap(day => Object.values(day as Record<string, any>));

        // 2. ترتيب الحصص تنازلياً (الأحدث أولاً)
        allSessions.sort((a, b) => {
            if (a.date === b.date) {
                return (b.sessionNumber || 1) - (a.sessionNumber || 1);
            }
            return b.date.localeCompare(a.date);
        });

        // 3. تعبئة خريطة التقدم بآخر ورد لكل طالب
        const SESSION_TYPES_WITH_SURAH = ['حصة أساسية', 'حصة تعويضية', 'حصة إضافية'];
        for (const sess of allSessions) {
            if (!SESSION_TYPES_WITH_SURAH.includes(sess.sessionType)) continue;
            const globalSurah = sess.surahId;
            const globalToVs = sess.toVerse;

            const recs = Array.isArray(sess.records) 
                ? sess.records 
                : sess.records ? Object.values(sess.records) : [];

            for (const rec of recs) {
                if (progressMap.has(rec.studentId)) continue;
                if (!['حاضر', 'متأخر', 'تعويض'].includes(rec.attendance)) continue;

                if (rec.surahId && rec.toVerse) {
                    progressMap.set(rec.studentId, { surahId: rec.surahId, fromVerse: rec.fromVerse, toVerse: rec.toVerse });
                } else if (globalSurah && globalToVs) {
                    progressMap.set(rec.studentId, { surahId: globalSurah, fromVerse: sess.fromVerse, toVerse: globalToVs });
                }
            }
        }

        return progressMap;
    }, [dailySessions]);

    const toggleStudentCheck = (studentId: string) => {
        setCheckedStudents(prev => ({
            ...prev,
            [studentId]: !prev[studentId]
        }));
    };

    const toggleAllStudents = (checked: boolean) => {
        const next: Record<string, boolean> = {};
        if (checked) {
            activeGroupStudents.forEach(s => {
                next[s.id] = true;
            });
        }
        setCheckedStudents(next);
    };

    const isAllChecked = useMemo(() => {
        if (activeGroupStudents.length === 0) return false;
        return activeGroupStudents.every(s => checkedStudents[s.id]);
    }, [activeGroupStudents, checkedStudents]);

    const handleSaveGroupSettings = async () => {
        if (!activeSheikhId) {
            toast({
                title: "تنبيه",
                description: "لم يتم تحديد معرّف الشيخ للتعديل.",
                variant: "destructive"
            });
            return;
        }
        setIsSavingSettings(true);
        try {
            console.log("Saving group settings for sheikh:", activeSheikhId, "Mode:", selectedMode);
            const targetSurah = (selectedMode === 'unified' || selectedMode === 'hybrid') && selectedSurahId > 0 ? {
                surahId: selectedSurahId,
                currentVerse: currentVerse,
                startedAt: groupSurahConfig?.startedAt || new Date().toISOString().split('T')[0]
            } : undefined;

            await updateSheikhGroupSettings(activeSheikhId, selectedMode, targetSurah);
            
            toast({
                title: "✅ تم حفظ الإعدادات",
                description: "تم تحديث إعدادات نمط الفوج والورد بنجاح.",
            });
        } catch (error: any) {
            console.error("Error saving group settings:", error);
            toast({
                title: "❌ فشل حفظ الإعدادات",
                description: error.message || "حدث خطأ غير متوقع أثناء الحفظ.",
                variant: "destructive"
            });
        } finally {
            setIsSavingSettings(false);
        }
    };

    // تطبيق التعديل الجماعي لسورة الطلاب
    const handleApplyBatchUpdate = async () => {
        const studentIds = Object.keys(checkedStudents).filter(id => checkedStudents[id]);
        if (studentIds.length === 0) {
            toast({
                title: "تنبيه",
                description: "الرجاء اختيار طالب واحد على الأقل للتحديث الجماعي.",
                variant: "destructive"
            });
            return;
        }
        if (batchSurahId === 0) {
            toast({
                title: "تنبيه",
                description: "الرجاء اختيار السورة المستهدفة للطلاب.",
                variant: "destructive"
            });
            return;
        }

        setIsUpdatingBatch(true);
        try {
            const promises = studentIds.map(id => {
                const student = students.find(s => s.id === id);
                if (!student) return Promise.resolve();
                return updateStudent(id, { currentSurahId: batchSurahId }, student.ownerId);
            });
            await Promise.all(promises);
            toast({
                title: "✅ تم التحديث الجماعي",
                description: `تم تحديث السورة الحالية لعدد ${studentIds.length} طلاب بنجاح.`
            });
            setCheckedStudents({});
        } catch (error: any) {
            toast({
                title: "❌ فشل التحديث",
                description: error.message || "حدث خطأ أثناء التحديث الجماعي."
            });
        }
        setIsUpdatingBatch(false);
    };

    // ─── معالجة إحصائيات التبويب الثاني (مراقبة الأفواج الإدارية) ───
    const groupsData = useMemo(() => {
        const groups: Record<string, any> = {};

        // تصفية المشايخ لتطابق خيار الفوج المحدد
        const filteredSheikhs = allUsers.filter(u => u.role === 'sheikh').filter(sheikh => {
            if (selectedGroup === 'sheikhs_all') return isSheikhMenUser(sheikh);
            if (selectedGroup === 'ustadhats_all') return isSheikhWomenUser(sheikh);
            return true;
        });

        // تهيئة المجموعات
        filteredSheikhs.forEach(sheikh => {
            groups[sheikh.group || 'غير محدد'] = {
                groupName: sheikh.group || 'غير محدد',
                sheikhName: sheikh.displayName,
                studentCount: 0,
                activeCount: 0,
                lastActivity: sheikh.joinDate || 'غير معروف'
            };
        });

        // حساب عدد الطلاب
        students.forEach(student => {
            if (selectedGroup === 'sheikhs_all' && !isStudentInMenSheikhs(student, allUsers)) return;
            if (selectedGroup === 'ustadhats_all' && !isStudentInWomenUstadhats(student, allUsers)) return;

            const gName = student.groupName || 'غير محدد';
            if (!groups[gName]) {
                groups[gName] = {
                    groupName: gName,
                    sheikhName: 'غير محدد',
                    studentCount: 0,
                    activeCount: 0,
                    lastActivity: 'غير معروف'
                };
            }
            groups[gName].studentCount++;
            if (student.status === 'نشط') groups[gName].activeCount++;
        });

        return Object.values(groups).filter(g => {
            if (selectedGroup === 'all' || selectedGroup === 'sheikhs_all' || selectedGroup === 'ustadhats_all') return true;
            const selectedSheikh = allUsers.find(u => u.uid === selectedGroup);
            return selectedSheikh ? g.groupName === selectedSheikh.group : true;
        });
    }, [students, allUsers, selectedGroup]);

    const surahOptions = useMemo(() => {
        return surahs.map(s => ({ value: s.id.toString(), label: `${s.id}. ${s.name}` }));
    }, []);

    return (
        <ProtectedPage>
            <div className="mx-auto p-4 md:p-6 lg:p-8 space-y-6 pb-32 w-full max-w-none animate-in fade-in slide-in-from-bottom-4 duration-700 rtl" dir="rtl">
                
                {/* الرأس واختيار الفوج */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-5 border rounded-3xl">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-headline font-bold flex items-center gap-2">
                            <Layers className="text-primary w-7 h-7" />
                            إدارة الأفواج وضبط الورد
                        </h1>
                        <p className="text-muted-foreground font-body text-xs mt-1">
                            {isPrincipal ? "لوحة الإدارة للتحكم في أنماط الحفظ وإعدادات الورد الجماعي والفردي." : "اضبط الورد الموحد لطلاب فوجك وحدث تقدمهم الجماعي بسهولة."}
                        </p>
                    </div>
                    {isPrincipal && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground">عرض وإدارة:</span>
                            <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />
                        </div>
                    )}
                </div>

                {/* شريط تبديل التبويبات */}
                <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit select-none">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                            activeTab === 'settings' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        ضبط الورد وإعدادات الأفواج
                    </button>
                    <button
                        onClick={() => setActiveTab('monitoring')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                            activeTab === 'monitoring' ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        إحصائيات ومراقبة الأفواج
                    </button>
                </div>

                {/* ─── التبويب الأول: إعدادات الورد والعمل الجماعي ──────────────── */}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        {/* معلومات الفوج النشط */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            
                            {/* كارد نمط الحفظ للفوج */}
                            <Card className="lg:col-span-1 border rounded-3xl shadow-sm">
                                <CardHeader className="pb-3 border-b border-muted">
                                    <CardTitle className="text-sm font-black flex items-center gap-2">
                                        <Settings className="w-4 h-4 text-primary" />
                                        إعدادات نمط الفوج
                                    </CardTitle>
                                    {activeSheikh && (
                                        <CardDescription className="text-[11px] font-bold text-indigo-650 dark:text-indigo-400">
                                            فوج: {activeSheikh.group || 'غير محدد'} ({activeSheikh.displayName})
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="p-5 space-y-4">
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-foreground block">نمط المتابعة والحفظ:</label>
                                        <select
                                            value={selectedMode}
                                            onChange={(e) => setSelectedMode(e.target.value as any)}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-muted-foreground/20 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
                                        >
                                            <option value="not_set">غير محدد (يتطلب الإعداد)</option>
                                            <option value="individual">نمط فردي (كل طالب بورد مستقل)</option>
                                            <option value="unified">نمط موحد (ورد جماعي للفوج كامل)</option>
                                            <option value="hybrid">نمط هجين (ورد افتراضي للفوج مع إمكانية التعديل الفردي)</option>
                                        </select>
                                    </div>

                                    {(selectedMode === 'unified' || selectedMode === 'hybrid') && (
                                        <div className="space-y-3 p-3 bg-primary/5 dark:bg-white/5 border border-primary/10 rounded-2xl animate-in fade-in duration-300">
                                            <p className="text-[10px] font-black text-primary">📖 ضبط الورد الموحد/الافتراضي للفوج:</p>
                                            
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-muted-foreground">السورة المستهدفة:</label>
                                                <select
                                                    value={selectedSurahId}
                                                    onChange={(e) => {
                                                        setSelectedSurahId(Number(e.target.value));
                                                        setCurrentVerse(1);
                                                    }}
                                                    className="w-full bg-background border border-muted-foreground/15 rounded-lg px-2.5 py-2 text-xs font-semibold focus:outline-none"
                                                >
                                                    <option value={0}>اختر السورة...</option>
                                                    {surahs.map(s => (
                                                        <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-muted-foreground">آخر آية تم تلقينها (البداية القادمة):</label>
                                                <input
                                                    type="number"
                                                    value={currentVerse}
                                                    min={1}
                                                    max={surahs.find(s => s.id === selectedSurahId)?.verses || 286}
                                                    onChange={(e) => setCurrentVerse(Number(e.target.value))}
                                                    className="w-full bg-background border border-muted-foreground/15 rounded-lg px-2.5 py-2 text-xs font-semibold focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleSaveGroupSettings}
                                        disabled={isSavingSettings}
                                        className="w-full rounded-xl font-bold text-xs py-2.5 mt-2"
                                    >
                                        {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ إعدادات الفوج"}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* كارد تعديل تقدم الطلاب وتحديث السورة */}
                            <Card className="lg:col-span-2 xl:col-span-3 border rounded-3xl shadow-sm">
                                <CardHeader className="pb-3 border-b border-muted flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                    <div>
                                        <CardTitle className="text-sm font-black flex items-center gap-2">
                                            <ListFilter className="w-4 h-4 text-primary" />
                                            طلاب الفوج والتعديل الجماعي
                                        </CardTitle>
                                        <CardDescription className="text-[10px] font-medium text-muted-foreground mt-0.5">
                                            حدد الطلاب لتعديل السورة التي يحفظونها حالياً دفعة واحدة.
                                        </CardDescription>
                                    </div>
                                    
                                    {/* ضبط السورة للطلاب المحددين */}
                                    <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-xl self-start">
                                        <select
                                            value={batchSurahId}
                                            onChange={(e) => setBatchSurahId(Number(e.target.value))}
                                            className="bg-background border border-muted-foreground/15 rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none"
                                        >
                                            <option value={0}>السورة المستهدفة...</option>
                                            {surahs.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <Button
                                            onClick={handleApplyBatchUpdate}
                                            disabled={isUpdatingBatch || Object.keys(checkedStudents).filter(k => checkedStudents[k]).length === 0}
                                            size="sm"
                                            className="text-[10px] font-black px-3 py-1.5 rounded-lg shrink-0"
                                        >
                                            {isUpdatingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "تطبيق جماعي"}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {activeGroupStudents.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground font-medium text-xs">لا يوجد طلاب نشطون في هذا الفوج حالياً.</div>
                                    ) : (
                                        <>
                                            {/* Table for larger screens */}
                                            <div className="hidden sm:block overflow-x-auto">
                                                <table className="w-full text-right min-w-[750px]">
                                                    <thead className="text-[10px] opacity-60 bg-slate-50 dark:bg-white/5 border-b font-black">
                                                        <tr>
                                                            <th className="px-5 py-3 text-center w-12">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isAllChecked}
                                                                    onChange={(e) => toggleAllStudents(e.target.checked)}
                                                                    className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                                                />
                                                            </th>
                                                            <th className="px-5 py-3">اسم الطالب</th>
                                                            <th className="px-5 py-3">آخر تقدم مسجل</th>
                                                            <th className="px-5 py-3">السورة المستهدفة الفردية</th>
                                                            <th className="px-5 py-3 text-center">حفظ</th>
                                                            <th className="px-5 py-3">حجم الورد المعتاد</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border">
                                                        {activeGroupStudents.map((student) => {
                                                             const lastProg = studentProgress.get(student.id);
                                                             const curSurahName = lastProg ? (surahs.find(s => s.id === lastProg.surahId)?.name || 'غير محددة') : 'غير محددة';
                                                             return (
                                                                 <tr key={student.id} className="hover:bg-muted/10 transition-colors text-xs">
                                                                     <td className="px-5 py-3 text-center">
                                                                         <input
                                                                             type="checkbox"
                                                                             checked={!!checkedStudents[student.id]}
                                                                             onChange={() => toggleStudentCheck(student.id)}
                                                                             className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                                                         />
                                                                     </td>
                                                                     <td className="px-5 py-3 font-bold">{student.fullName}</td>
                                                                     <td className="px-5 py-3 font-black text-primary">
                                                                          {lastProg ? `${curSurahName} (${lastProg.fromVerse || 1} - ${lastProg.toVerse})` : <span className="opacity-45">لا يوجد تقدم بعد</span>}
                                                                     </td>
                                                                     <td className="px-5 py-2">
                                                                         <select
                                                                             value={individualSurahs[student.id] ?? student.currentSurahId ?? 0}
                                                                             onChange={(e) => {
                                                                                 const val = Number(e.target.value);
                                                                                 setIndividualSurahs(prev => ({ ...prev, [student.id]: val }));
                                                                             }}
                                                                             className="bg-background border border-muted-foreground/15 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none w-36"
                                                                         >
                                                                             <option value={0}>اختر السورة...</option>
                                                                             {surahs.map(s => (
                                                                                 <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                                                                             ))}
                                                                         </select>
                                                                     </td>
                                                                     <td className="px-5 py-2 text-center">
                                                                         <Button
                                                                             size="sm"
                                                                             variant="ghost"
                                                                             className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-colors rounded-lg mx-auto"
                                                                             disabled={isSavingIndividual[student.id]}
                                                                             onClick={async () => {
                                                                                 const targetSurahId = individualSurahs[student.id] ?? student.currentSurahId;
                                                                                 if (!targetSurahId) {
                                                                                     toast({
                                                                                         title: "تنبيه",
                                                                                         description: "الرجاء اختيار السورة المستهدفة أولاً.",
                                                                                         variant: "destructive"
                                                                                     });
                                                                                     return;
                                                                                 }
                                                                                 setIsSavingIndividual(prev => ({ ...prev, [student.id]: true }));
                                                                                 try {
                                                                                     await updateStudent(student.id, { currentSurahId: targetSurahId }, student.ownerId);
                                                                                     toast({
                                                                                         title: "✅ تم حفظ السورة",
                                                                                         description: `تم تحديث السورة المستهدفة للطالب ${student.fullName} بنجاح.`
                                                                                     });
                                                                                 } catch (error: any) {
                                                                                     toast({
                                                                                         title: "❌ خطأ في الحفظ",
                                                                                         description: error.message || "حدث خطأ أثناء الحفظ."
                                                                                     });
                                                                                 } finally {
                                                                                     setIsSavingIndividual(prev => ({ ...prev, [student.id]: false }));
                                                                                 }
                                                                             }}
                                                                         >
                                                                             {isSavingIndividual[student.id] ? (
                                                                                 <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                                                             ) : (
                                                                                 <Save className="w-3.5 h-3.5 text-emerald-650" />
                                                                             )}
                                                                         </Button>
                                                                     </td>
                                                                     <td className="px-5 py-3 opacity-75">{student.dailyMemorizationAmount}</td>
                                                                 </tr>
                                                             );
                                                         })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Cards for mobile screens */}
                                            <div className="block sm:hidden p-4 space-y-3">
                                                <div className="flex items-center justify-between pb-2 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border mb-2">
                                                    <span className="text-xs font-black opacity-60">تحديد كل طلاب الفوج</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isAllChecked}
                                                        onChange={(e) => toggleAllStudents(e.target.checked)}
                                                        className="w-4 h-4 rounded accent-primary cursor-pointer"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 gap-2.5">
                                                    {activeGroupStudents.map((student) => {
                                                        const lastProg = studentProgress.get(student.id);
                                                        const curSurahName = lastProg ? (surahs.find(s => s.id === lastProg.surahId)?.name || 'غير مححددة') : 'غير محددة';
                                                        return (
                                                            <div
                                                                key={student.id}
                                                                className={cn(
                                                                    "flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer",
                                                                    checkedStudents[student.id]
                                                                        ? "bg-primary/5 border-primary/30"
                                                                        : "bg-background border-border hover:bg-muted/5"
                                                                )}
                                                            >
                                                                <div className="space-y-2 text-right w-full">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-xs font-black text-foreground">{student.fullName}</p>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!checkedStudents[student.id]}
                                                                            onChange={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleStudentCheck(student.id);
                                                                            }}
                                                                            className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] font-bold text-muted-foreground">
                                                                        الورد المعتاد: <span className="opacity-75">{student.dailyMemorizationAmount}</span>
                                                                    </p>
                                                                    <p className="text-[10px] font-black text-primary">
                                                                        آخر تقدم: {lastProg ? `${curSurahName} (${lastProg.fromVerse || 1} - ${lastProg.toVerse})` : 'لا يوجد تقدم بعد'}
                                                                    </p>
                                                                    
                                                                    {/* اختيار السورة الفردي للجوال */}
                                                                    <div className="flex items-center gap-2 pt-2 border-t border-dashed mt-2" onClick={(e) => e.stopPropagation()}>
                                                                        <span className="text-[10px] font-bold text-muted-foreground shrink-0">السورة:</span>
                                                                        <select
                                                                            value={individualSurahs[student.id] ?? student.currentSurahId ?? 0}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                setIndividualSurahs(prev => ({ ...prev, [student.id]: val }));
                                                                            }}
                                                                            className="flex-1 bg-background border border-muted-foreground/15 rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none"
                                                                        >
                                                                            <option value={0}>اختر السورة...</option>
                                                                            {surahs.map(s => (
                                                                                <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-colors rounded-lg shrink-0"
                                                                            disabled={isSavingIndividual[student.id]}
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                const targetSurahId = individualSurahs[student.id] ?? student.currentSurahId;
                                                                                if (!targetSurahId) {
                                                                                    toast({
                                                                                        title: "تنبيه",
                                                                                        description: "الرجاء اختيار السورة المستهدفة أولاً.",
                                                                                        variant: "destructive"
                                                                                    });
                                                                                    return;
                                                                                }
                                                                                setIsSavingIndividual(prev => ({ ...prev, [student.id]: true }));
                                                                                try {
                                                                                    await updateStudent(student.id, { currentSurahId: targetSurahId }, student.ownerId);
                                                                                    toast({
                                                                                        title: "✅ تم حفظ السورة",
                                                                                        description: `تم تحديث السورة المستهدفة للطالب ${student.fullName} بنجاح.`
                                                                                    });
                                                                                } catch (error: any) {
                                                                                    toast({
                                                                                        title: "❌ خطأ في الحفظ",
                                                                                        description: error.message || "حدث خطأ أثناء الحفظ."
                                                                                    });
                                                                                } finally {
                                                                                    setIsSavingIndividual(prev => ({ ...prev, [student.id]: false }));
                                                                                }
                                                                            }}
                                                                        >
                                                                            {isSavingIndividual[student.id] ? (
                                                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                                                            ) : (
                                                                                <Save className="w-3.5 h-3.5 text-emerald-650" />
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                        </div>
                    </div>
                )}

                {/* ─── التبويب الثاني: لوحة مراقبة وإحصائيات الأفواج الإدارية ───────── */}
                {activeTab === 'monitoring' && (
                    <div className="space-y-6">
                        {/* بطاقات الإحصائيات السريعة */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className={cn("border-none shadow-sm", theme.isLight ? "bg-white" : "bg-white/5")}>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-500/20 rounded-2xl">
                                            <Shield className="h-6 w-6 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs opacity-60">إجمالي الأفواج</p>
                                            <h3 className="text-xl font-black font-headline">{groupsData.length}</h3>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className={cn("border-none shadow-sm", theme.isLight ? "bg-white" : "bg-white/5")}>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-emerald-500/20 rounded-2xl">
                                            <Users className="h-6 w-6 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs opacity-60">متوسط الطلاب/فوج</p>
                                            <h3 className="text-xl font-black font-headline">
                                                {groupsData.length > 0 ? Math.round(students.length / groupsData.length) : 0}
                                            </h3>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className={cn("border-none shadow-sm", theme.isLight ? "bg-white" : "bg-white/5")}>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-500/20 rounded-2xl">
                                            <TrendingUp className="h-6 w-6 text-purple-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs opacity-60">معدل النشاط العام</p>
                                            <h3 className="text-xl font-black font-headline">94%</h3>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* جدول الأفواج */}
                        <Card className={cn("border rounded-3xl overflow-hidden shadow-xs bg-card")}>
                            <CardHeader className="p-5 border-b">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-sm font-black font-headline">قائمة الأفواج والمجموعات</CardTitle>
                                        <CardDescription className="text-[10px] text-muted-foreground mt-0.5">جدول متابعة أعداد الطلاب ومعدل النشاط لكل معلم.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right min-w-[650px]">
                                        <thead className="text-[10px] opacity-60 bg-slate-50 dark:bg-white/5 font-black border-b">
                                            <tr>
                                                <th className="px-6 py-4">اسم الفوج</th>
                                                <th className="px-6 py-4">الشيخ المسؤول</th>
                                                <th className="px-6 py-4 text-center">عدد الطلبة</th>
                                                <th className="px-6 py-4 text-center">النشطون</th>
                                                <th className="px-6 py-4 text-center">آخر نشاط</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border text-xs">
                                            {groupsData.map((group, idx) => (
                                                <tr key={idx} className="hover:bg-muted/10 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                            {group.groupName}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-body opacity-80">{group.sheikhName}</td>
                                                    <td className="px-6 py-4 text-center font-bold">{group.studentCount}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-[10px] font-bold text-emerald-500">{group.activeCount}</span>
                                                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-emerald-500 rounded-full"
                                                                    style={{ width: `${(group.activeCount / (group.studentCount || 1)) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-[10px] opacity-40 font-body">{group.lastActivity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </ProtectedPage>
    );
}
