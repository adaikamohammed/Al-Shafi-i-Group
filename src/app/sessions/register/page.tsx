"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { format, parse, parseISO, subDays, addDays, isSameDay, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn, arabicCompare } from '@/lib/utils';
import { AttendanceStatus, PerformanceLevel, BehaviorLevel, Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Save, FileText, UserCheck, AlertTriangle, ArrowRight, ArrowLeft, Trash2, BookOpen, Smile, RotateCcw, TimerOff, MessageSquare, CheckCircle, Copy, Trophy, Cloud, RefreshCw, ChevronLeft, ChevronRight, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { surahs } from '@/lib/surahs';
import { db } from '@/lib/firebase';
import { ref as dbRef, get } from 'firebase/database';
import { isEffectiveOnline, executeWithTimeout } from '@/lib/offlineSyncEngine';

function RegisterSessionContent() {
    const { user, isSuperAdmin } = useAuth();
    const { students, dailySessions, loading, allUsers, getSessionsForDay, addDailySession, deleteDailySession, getSessionById, updateSheikhGroupSettings, updateStudent } = useStudentContext();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const isAdmin5 = user?.email === 'admin5@gmail.com';
    const ownerIdParam = searchParams.get('ownerId');



    const dateParam = searchParams.get('date');
    const sessionNumParam = searchParams.get('session');

    const selectedDay = useMemo(() => {
        if (!dateParam) {
            const d = new Date();
            d.setHours(12, 0, 0, 0);
            return d;
        }
        // SAFE PARSING: Parse and Set to NOON
        const d = parse(dateParam, 'yyyy-MM-dd', new Date());
        d.setHours(12, 0, 0, 0);
        return d;
    }, [dateParam]);
    const isManagement = user?.role === 'management';

    // Determine the effective owner ID (either specified in URL for admins, or current user)
    const effectiveOwnerId = useMemo(() => {
        if ((isSuperAdmin || isManagement) && ownerIdParam) {
            return ownerIdParam;
        }
        return user?.uid;
    }, [isSuperAdmin, isManagement, ownerIdParam, user]);

    const activeSheikhId = effectiveOwnerId || '';

    const activeSheikh = useMemo(() => {
        return (allUsers || []).find(u => u.uid === activeSheikhId) || null;
    }, [allUsers, activeSheikhId]);

    const groupMode = useMemo(() => {
        return activeSheikh?.settings?.groupMemorizationMode || 'not_set';
    }, [activeSheikh]);

    const groupSurahConfig = useMemo(() => {
        return activeSheikh?.settings?.groupSurah;
    }, [activeSheikh]);

    const isUnifiedMode = groupMode === 'unified';

    const sessionToOpen = useMemo(() => {
        const rawSession = sessionNumParam === '2' ? 2 : 1;
        if (rawSession === 2 && dateParam) {
            const sessionOwnerId = effectiveOwnerId || user?.uid;
            const contextSessions = getSessionsForDay(dateParam);
            const hasSession1 = contextSessions.some((s: any) => {
                const ownerMatches = s.ownerId === sessionOwnerId;
                const num = s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                return ownerMatches && num === 1;
            });
            if (!hasSession1) {
                return 1; // Force to session 1 if session 1 doesn't exist
            }
        }
        return rawSession as 1 | 2;
    }, [sessionNumParam, dateParam, getSessionsForDay, effectiveOwnerId, user]);

    const [sessionType, setSessionType] = useState<'حصة أساسية' | 'حصة تعويضية' | 'يوم عطلة' | 'غياب الشيخ' | 'حصة أنشطة' | 'حصة إضافية'>('حصة أساسية');
    const [teacherAbsenceReason, setTeacherAbsenceReason] = useState('');
    const [substituteTeacher, setSubstituteTeacher] = useState('');
    const [activityType, setActivityType] = useState('');
    const [activityDescription, setActivityDescription] = useState('');
    const [surahId, setSurahId] = useState<number>(0); // يُحدَّث ديناميكياً من آخر حصة
    const [fromVerse, setFromVerse] = useState<number>(1);
    const [toVerse, setToVerse] = useState<number>(1);
    const [isReview, setIsReview] = useState(false);
    const [isCounterStopped, setIsCounterStopped] = useState(false);

    // Admin5 Talqin Wird
    const [talqinSurahId, setTalqinSurahId] = useState<number>(0); // يُحدَّث ديناميكياً
    const [talqinFromVerse, setTalqinFromVerse] = useState<number>(1);
    const [talqinToVerse, setTalqinToVerse] = useState<number>(1);

    // Admin5 Tasmie Wird
    const [tasmieSurahId, setTasmieSurahId] = useState<number>(0); // يُحدَّث ديناميكياً
    const [tasmieFromVerse, setTasmieFromVerse] = useState<number>(1);
    const [tasmieToVerse, setTasmieToVerse] = useState<number>(1);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [loadedDate, setLoadedDate] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);

    // Active session and stable function refs
    const activeSessionKeyRef = useRef<string | null>(null);
    const getSessionsForDayRef = useRef(getSessionsForDay);
    getSessionsForDayRef.current = getSessionsForDay;

    // Swipe navigation refs
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
    const isSwiping = useRef(false);

    const surahOptions: SearchableSelectOption[] = useMemo(() => surahs.map(s => ({ value: s.id.toString(), label: `${s.id}. ${s.name}` })), []);

    const activeStudents = useMemo(() => {
        const sessionDate = selectedDay;
        return (students ?? []).filter((s): s is Student => {
            if (!s || typeof s !== 'object') return false;
            // لا يظهر الطالب إذا كانت الحصة قبل تاريخ انضمامه للفوج
            if (sessionDate && s.registrationDate) {
                const regDate = s.registrationDate instanceof Date
                    ? s.registrationDate
                    : new Date(s.registrationDate as any);
                const regDateNoon = new Date(regDate);
                regDateNoon.setHours(0, 0, 0, 0);
                const sessionDateNoon = new Date(sessionDate);
                sessionDateNoon.setHours(0, 0, 0, 0);
                if (sessionDateNoon < regDateNoon) return false;
            }
            // If specific owner is targeted, filter by that owner. Otherwise fall back to group name check or super admin view.
            if (effectiveOwnerId && effectiveOwnerId !== user?.uid) {
                return s.ownerId === effectiveOwnerId && s.status === "نشط";
            }
            const isGroupMatch = isSuperAdmin ? true : s.groupName === user?.group;
            return s.status === "نشط" && isGroupMatch;
        }).sort((a, b) => arabicCompare(a?.fullName || '', b?.fullName || ''));
    }, [students, isSuperAdmin, user, effectiveOwnerId, selectedDay]);

    // Combined list: Active Students + Students who have a record in this specific session
    // This solves the "Empty Sessions" issue for students who became inactive.
    const sessionStudents = useMemo(() => {
        const studentIdsWithRecords = new Set(Object.keys(attendanceRecords));
        if (studentIdsWithRecords.size === 0) return activeStudents;

        const studentsWithRecords = (students ?? []).filter(s => studentIdsWithRecords.has(s.id));
        
        // Merge and deduplicate
        const merged = [...activeStudents];
        studentsWithRecords.forEach(s => {
            if (!merged.find(m => m.id === s.id)) {
                merged.push(s);
            }
        });

        return merged.sort((a, b) => arabicCompare(a.fullName, b.fullName));
    }, [activeStudents, attendanceRecords, students]);

    // Calculate Past Wirds for Catch-up (Admin5 only)
    const pastWirds = useMemo(() => {
        if (!isAdmin5 || !dailySessions) return [];

        const currentSessionDate = selectedDay;
        // Flatten sessions from context
        const allSessions = Object.values(dailySessions).flatMap(day => Object.values(day as Record<string, any>));

        return allSessions
            .filter(s => {
                // EXTREMELY SAFE GUARD: Ensure s.date exists and is a valid format
                if (!s || typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s.date)) return false;

                try {
                    const sDate = parse(s.date, 'yyyy-MM-dd', new Date());
                    // Only past sessions, basic/extra type, and has surah info
                    return sDate < currentSessionDate &&
                        (s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة إضافية') &&
                        s.surahId;
                } catch (e) {
                    return false;
                }
            })
            .sort((a, b) => {
                try {
                    return b.date.localeCompare(a.date);
                } catch (e) {
                    return 0;
                }
            }) // Newest first
            .map(s => {
                try {
                    const surah = surahs.find(su => su.id === s.surahId);
                    const sDate = parse(s.date, 'yyyy-MM-dd', new Date());
                    // Get IDs of students who were present (attended & memorized)
                    const presentStudentIds: string[] = (s.records || [])
                        .filter((r: any) => r.attendance === 'حاضر' || r.attendance === 'متأخر')
                        .map((r: any) => r.studentId);
                    return {
                        date: s.date,
                        dayName: format(sDate, 'EEEE', { locale: ar }),
                        sessionNumber: s.sessionNumber,
                        surahId: s.surahId,
                        surahName: surah?.name || 'سورة مجهولة',
                        fromVerse: s.fromVerse,
                        toVerse: s.toVerse,
                        presentStudentIds,
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(item => item !== null);
    }, [isAdmin5, dailySessions, selectedDay]);

    /**
     * studentAbsenceHistory — قائمة أيام الغياب لكل طالب
     * تُستخدم لإظهار الخيارات في نافذة تسجيل التعويض.
     * لا تؤثر على نظام الحصص الجماعية.
     */
    const studentAbsenceHistory = useMemo(() => {
        const result: Record<string, Array<{ date: string; label: string }>> = {};
        if (!dailySessions) return result;

        Object.entries(dailySessions).forEach(([date, sessionsForDay]) => {
            if (!sessionsForDay || typeof sessionsForDay !== 'object') return;
            // تخطّي الحصص المستقبلية واليوم الحالي
            try {
                const d = parseISO(date);
                if (selectedDay && d >= selectedDay) return;
            } catch { return; }

            Object.values(sessionsForDay as Record<string, any>).forEach((session: any) => {
                if (!session) return;
                const sType = session.sessionType;
                // تخطّي أيام العطل وغياب الشيخ بدون مستخلف
                if (sType === 'يوم عطلة' || (sType === 'غياب الشيخ' && !session.substituteTeacher)) return;

                const records = Array.isArray(session.records)
                    ? session.records
                    : session.records ? Object.values(session.records) : [];

                records.forEach((record: any) => {
                    if (record.attendance === 'غائب' || record.attendance === 'غياب') {
                        if (!result[record.studentId]) result[record.studentId] = [];
                        // منع التكرار لنفس التاريخ
                        if (!result[record.studentId].some(r => r.date === date)) {
                            try {
                                const d = parseISO(date);
                                result[record.studentId].push({
                                    date,
                                    label: format(d, 'EEEE dd/MM/yyyy', { locale: ar })
                                });
                            } catch { /* skip invalid dates */ }
                        }
                    }
                });
            });
        });

        // ترتيب تنازلي (الأحدث أولاً) والاحتفاظ بآخر 20 غياباً لكل طالب
        Object.keys(result).forEach(sid => {
            result[sid].sort((a, b) => b.date.localeCompare(a.date));
            result[sid] = result[sid].slice(0, 20);
        });

        return result;
    }, [dailySessions, selectedDay]);

    const DRAFT_KEY = useMemo(() => {
        return selectedDay ? `session_draft_${format(selectedDay, 'yyyy-MM-dd')}_s${sessionToOpen}` : null;
    }, [selectedDay, sessionToOpen]);

    /**
     * computeNextSurahData — دالة ذكية لحساب بيانات الأوراد للحصة الجديدة
     * تقرأ آخر حصة أساسية مسجلة وتحسب:
     * - ورد التلقين: السورة التي يجب تصحيحها اليوم
     *   • إذا انتهت السورة → السورة التالية من آية 1
     *   • إذا لم تنتهِ → نفس السورة من آخر آية وصلنا إليها
     * - ورد التسميع: آخر ورد تلقين (أي ما صُحِّح بالأمس)
     */
    const computeNextSurahData = React.useCallback((sessions: Record<string, Record<string, any>>) => {
        // 1. استخرج كل الحصص وافلترها
        const allSessions = Object.values(sessions)
            .flatMap(day => Object.values(day as Record<string, any>))
            .filter(s => {
                if (!s || typeof s.date !== 'string') return false;
                return (s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة إضافية') && s.talqinSurahId;
            })
            .sort((a, b) => b.date.localeCompare(a.date)); // تنازلي: الأحدث أولاً

        if (allSessions.length === 0) {
            // لا توجد حصص سابقة → ابدأ من الشعراء (النقطة الافتراضية الأولى)
            return {
                talqinSurahId: 26, talqinFromVerse: 1, talqinToVerse: 1,
                tasmieSurahId: 26, tasmieFromVerse: 1, tasmieToVerse: 1,
                surahId: 26
            };
        }

        // آخر حصة = ورد التسميع (ما سيُسمَّع اليوم = ما تُلُقِّن بالأمس)
        const lastSession = allSessions[0];
        const lastTalqinSurahId: number = lastSession.talqinSurahId;
        const lastTalqinToVerse: number = lastSession.talqinToVerse || lastSession.toVerse || 1;
        const lastSurahData = surahs.find(s => s.id === lastTalqinSurahId);
        const totalVerses = lastSurahData?.verses || 999;

        // ورد التسميع = آخر ورد تلقين
        const tasmieSurahId = lastTalqinSurahId;
        const tasmieFromVerse = lastSession.talqinFromVerse || lastSession.fromVerse || 1;
        const tasmieToVerse = lastTalqinToVerse;

        // ورد التلقين = الاستمرار من حيث توقفنا
        let newTalqinSurahId: number;
        let newTalqinFromVerse: number;
        let newTalqinToVerse: number;

        if (lastTalqinToVerse >= totalVerses) {
            // ✅ انتهت السورة! انتقل للسورة التالية
            const nextSurahId = (lastTalqinSurahId % 114) + 1;
            newTalqinSurahId = nextSurahId;
            newTalqinFromVerse = 1;
            newTalqinToVerse = 1;
        } else {
            // السورة لم تنتهِ بعد → ابقَ فيها
            newTalqinSurahId = lastTalqinSurahId;
            newTalqinFromVerse = lastTalqinToVerse;
            newTalqinToVerse = lastTalqinToVerse;
        }

        return {
            talqinSurahId: newTalqinSurahId,
            talqinFromVerse: newTalqinFromVerse,
            talqinToVerse: newTalqinToVerse,
            tasmieSurahId,
            tasmieFromVerse,
            tasmieToVerse,
            surahId: newTalqinSurahId
        };
    }, []);

    useEffect(() => {
        // Load initial data logic - Local First & Offline Ready
        const loadFromFirebase = async () => {
            if (!selectedDay || !user) return;

            const dateStr = format(selectedDay, 'yyyy-MM-dd');

            // 🔍 Detect session owner from context (if viewing as admin)
            let sessionOwnerId = effectiveOwnerId || user.uid;

            if (!ownerIdParam) {
                const contextSessions = getSessionsForDayRef.current(dateStr);
                const existingContextSession = contextSessions.find((s: any) => {
                    const num = s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                    return num === sessionToOpen;
                });
                if (existingContextSession && existingContextSession.ownerId) {
                    sessionOwnerId = existingContextSession.ownerId;
                }
            }

            const currentKey = `${dateStr}-s${sessionToOpen}-${sessionOwnerId}`;
            // 🛡️ CRITICAL GUARD: If this session is ALREADY loaded in the editor, NEVER reset or wipe the user's state!
            if (activeSessionKeyRef.current === currentKey) {
                return;
            }
            activeSessionKeyRef.current = currentKey;

            // 1. Reset state ONLY on genuine session/date switch
            setLoadedDate(null);
            setAttendanceRecords({});
            setCurrentSessionId(null);
            setSessionType('حصة أساسية'); // Default reset

            try {
                // دالة تطبيق بيانات الحصة على الواجهة
                const applySessionData = (session: any) => {
                    setCurrentSessionId(session.id); // LOCK ID
                    setSessionType(session.sessionType as any);
                    setTeacherAbsenceReason(session.teacherAbsenceReason || '');
                    setSubstituteTeacher(session.substituteTeacher || '');
                    setActivityType(session.activityType || '');
                    setActivityDescription(session.activityDescription || '');
                    if (session.surahId) setSurahId(session.surahId);
                    if (session.fromVerse) setFromVerse(session.fromVerse);
                    if (session.toVerse) setToVerse(session.toVerse);
                    if (session.isReview) setIsReview(session.isReview);
                    setIsCounterStopped(session.isCounterStopped || false);

                    if (session.talqinSurahId) setTalqinSurahId(session.talqinSurahId);
                    if (session.talqinFromVerse) setTalqinFromVerse(session.talqinFromVerse);
                    if (session.talqinToVerse) setTalqinToVerse(session.talqinToVerse);

                    if (session.tasmieSurahId) setTasmieSurahId(session.tasmieSurahId);
                    if (session.tasmieFromVerse) setTasmieFromVerse(session.tasmieFromVerse);
                    if (session.tasmieToVerse) setTasmieToVerse(session.tasmieToVerse);

                    const records: any = {};
                    const rawRecords = Array.isArray(session.records)
                        ? session.records
                        : (session.records && typeof session.records === 'object')
                            ? Object.values(session.records)
                            : [];
                    rawRecords.forEach((record: any) => {
                        if (record && record.studentId) {
                            records[record.studentId] = {
                                attendance: record.attendance,
                                memorization: record.memorization,
                                behavior: record.behavior,
                                bonus: record.bonus || '',
                                negativeBonus: record.negativeBonus || '',
                                notes: record.notes || '',
                                review: record.review,
                                isDelayed: record.isDelayed || false,
                                surahId: record.surahId,
                                fromVerse: record.fromVerse,
                                toVerse: record.toVerse,
                                catchUpRecords: record.catchUpRecords || [],
                                makeupSessions: record.makeupSessions || []
                            };
                        }
                    });
                    setAttendanceRecords(records);
                };

                // أولاً: البحث في الذاكرة المحلية (Context / IndexedDB) لتحميل فوري 0ms
                const localSessions = getSessionsForDayRef.current(dateStr);
                let existingSession: any = localSessions.find((s: any) => {
                    const num = s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                    return num === sessionToOpen;
                });

                if (existingSession) {
                    applySessionData(existingSession);
                }

                // ثانياً: إذا كان متصلاً بالإنترنت فقط، محاولة قراءة آخر تحديث سحابي
                if (isEffectiveOnline()) {
                    try {
                        const sessionsRef = dbRef(db, `users/${sessionOwnerId}/dailySessions/${dateStr}`);
                        const snapshot: any = await executeWithTimeout(get(sessionsRef), 2200);

                        if (snapshot && snapshot.exists()) {
                            const val = snapshot.val();
                            let sessionsDict: Record<string, any> = {};
                            if (val && typeof val === 'object') {
                                if ('date' in val && ('records' in val || 'sessionType' in val)) {
                                    const sessionId = val.id || `${dateStr}-s1`;
                                    sessionsDict[sessionId] = {
                                        ...val,
                                        id: sessionId,
                                        sessionNumber: val.sessionNumber !== undefined ? Number(val.sessionNumber) : 1
                                    };
                                } else {
                                    sessionsDict = val;
                                }
                            }
                            const cloudSession = Object.values(sessionsDict).find((s: any) => {
                                const num = s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                                return num === sessionToOpen;
                            });

                            if (cloudSession) {
                                existingSession = cloudSession;
                                applySessionData(cloudSession);
                            }
                        }
                    } catch (e) {
                        // هادئ: في حال بطء أو انقطاع النت، نستمر بالبيانات المحلية بدون أي رسالة خطأ
                    }
                }

                if (!existingSession) {
                    // لا توجد حصة سابقة -> تهيئة حصة جديدة فارغة
                    setCurrentSessionId(null);
                    setAttendanceRecords({});
                    setSessionType(sessionToOpen === 1 ? 'حصة أساسية' : 'حصة إضافية');

                    if (isUnifiedMode && groupSurahConfig && sessionToOpen === 1) {
                        const targetSurahId = groupSurahConfig.surahId;
                        const lastTo = groupSurahConfig.lastTalqinTo || groupSurahConfig.currentVerse || 0;
                        const lastFrom = groupSurahConfig.lastTalqinFrom || 1;

                        setSurahId(targetSurahId);
                        setTalqinSurahId(targetSurahId);

                        const surahData = surahs.find(s => s.id === targetSurahId);
                        const total = surahData?.verses || 286;

                        if (lastTo >= total) {
                            const nextId = (targetSurahId % 114) + 1;
                            setTalqinSurahId(nextId);
                            setTalqinFromVerse(1);
                            setTalqinToVerse(1);
                        } else {
                            setTalqinFromVerse(lastTo + 1);
                            setTalqinToVerse(lastTo + 1);
                        }

                        setTasmieSurahId(targetSurahId);
                        setTasmieFromVerse(lastFrom);
                        setTasmieToVerse(lastTo);
                    } else if (isAdmin5 && sessionToOpen === 1) {
                        let sessionsSource: Record<string, Record<string, any>> = dailySessions || {};
                        const nextData = computeNextSurahData(sessionsSource);
                        setSurahId(nextData.surahId);
                        setTalqinSurahId(nextData.talqinSurahId);
                        setTalqinFromVerse(nextData.talqinFromVerse);
                        setTalqinToVerse(nextData.talqinToVerse);
                        setTasmieSurahId(nextData.tasmieSurahId);
                        setTasmieFromVerse(nextData.tasmieFromVerse);
                        setTasmieToVerse(nextData.tasmieToVerse);
                    }
                }
            } catch (error) {
                console.warn("Session local init notice:", error);
            } finally {
                setIsInitialLoad(false);
                setIsDirty(false);
                setIsNavigating(false);
                // 2. Mark this date as fully loaded
                if (selectedDay) {
                    setLoadedDate(format(selectedDay, 'yyyy-MM-dd'));
                }
            }
        };

        loadFromFirebase();
    }, [loading, selectedDay, sessionToOpen, user?.uid, ownerIdParam, effectiveOwnerId]);

    const handleSessionTypeChange = (val: any) => {
        setSessionType(val);
        setIsDirty(true);
    };

    const handleUpdateRecord = (studentId: string, field: keyof AttendanceRecord | Partial<AttendanceRecord>, value?: any) => {
        setIsDirty(true);
        setAttendanceRecords(prev => {
            const currentRecord = prev[studentId] || {
                studentId,
                attendance: '' as AttendanceStatus,
                memorization: '' as PerformanceLevel,
                behavior: '' as BehaviorLevel,
                bonus: '',
                notes: '',
                review: false
            };

            const patch = typeof field === 'object' ? field : { [field]: value };
            const updatedRecord = {
                ...currentRecord,
                ...patch
            };

            if (patch.attendance === undefined && !currentRecord.attendance && (patch.memorization || patch.behavior)) {
                updatedRecord.attendance = 'حاضر';
            }

            // Auto-set evaluation to "لم يحفظ" when marking present or late in basic session
            if ((patch.attendance === 'حاضر' || patch.attendance === 'متأخر') && sessionType === 'حصة أساسية' && !updatedRecord.memorization) {
                updatedRecord.memorization = 'لم يحفظ';
            }

            // Clear review, behavior, memorization, and bonus when marking as absent
            if (patch.attendance === 'غائب' || patch.attendance === 'غياب') {
                updatedRecord.review = false;
                updatedRecord.behavior = '';
                updatedRecord.memorization = '' as PerformanceLevel;
                updatedRecord.isDelayed = false;
                updatedRecord.bonus = '';
                updatedRecord.negativeBonus = '';
            }

            return {
                ...prev,
                [studentId]: updatedRecord
            };
        });
    };

    const handleMarkAllPresent = () => {
        setIsDirty(true);
        setAttendanceRecords(prev => {
            const newRecords = { ...prev };
            sessionStudents.forEach(student => {
                const currentRecord = newRecords[student.id] || {
                    memorization: '' as PerformanceLevel,
                    behavior: '' as BehaviorLevel,
                    notes: '',
                    review: false
                };

                newRecords[student.id] = {
                    ...currentRecord,
                    studentId: student.id,
                    attendance: 'حاضر',
                    // Auto-set evaluation to "لم يحفظ" in basic session if not already set
                    memorization: (sessionType === 'حصة أساسية' && !currentRecord.memorization)
                        ? 'لم يحفظ'
                        : currentRecord.memorization
                };
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم تحضير جميع الطلاب كـ 'حاضر'" });
    };

    const handleMarkAllQuiet = () => {
        setIsDirty(true);
        setAttendanceRecords(prev => {
            const newRecords = { ...prev };
            sessionStudents.forEach(student => {
                const existing = newRecords[student.id] || { studentId: student.id, attendance: 'حاضر' as AttendanceStatus, memorization: '' as PerformanceLevel, behavior: '' as BehaviorLevel, notes: '', review: false };
                if (existing.attendance === 'حاضر' || existing.attendance === 'متأخر') {
                    newRecords[student.id] = { ...existing, behavior: 'هادئ' };
                }
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم ضبط سلوك جميع الحاضرين كـ 'هادئ'" });
    };

    const handleMarkAllReview = () => {
        setIsDirty(true);
        setAttendanceRecords(prev => {
            const newRecords = { ...prev };
            sessionStudents.forEach(student => {
                const existing = newRecords[student.id] || { studentId: student.id, attendance: 'حاضر' as AttendanceStatus, memorization: '' as PerformanceLevel, behavior: '' as BehaviorLevel, notes: '', review: false };
                if (existing.attendance === 'حاضر' || existing.attendance === 'متأخر') {
                    newRecords[student.id] = { ...existing, review: true };
                }
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم تفعيل وضع المراجعة للجميع." });
    };

    const handleMarkAllGood = () => {
        setIsDirty(true);
        setAttendanceRecords(prev => {
            const newRecords = { ...prev };
            sessionStudents.forEach(student => {
                const existing = newRecords[student.id] || { studentId: student.id, attendance: 'حاضر' as AttendanceStatus, memorization: '' as PerformanceLevel, behavior: '' as BehaviorLevel, notes: '', review: false };
                if (existing.attendance === 'حاضر' || existing.attendance === 'متأخر') {
                    newRecords[student.id] = { ...existing, memorization: 'جيد' };
                }
            });
            return newRecords;
        });
        toast({ title: "تم", description: "تم تقييم جميع الحاضرين بـ 'جيد'" });
    };

    // Auto-Save Implementation
    const sessionData = useMemo(() => ({
        sessionType,
        teacherAbsenceReason,
        substituteTeacher,
        activityType,
        activityDescription,
        surahId,
        fromVerse,
        toVerse,
        isReview,
        isCounterStopped,
        talqinSurahId,
        talqinFromVerse,
        talqinToVerse,
        tasmieSurahId,
        tasmieFromVerse,
        tasmieToVerse,
        attendanceRecords
    }), [sessionType, teacherAbsenceReason, substituteTeacher, activityType, activityDescription, surahId, fromVerse, toVerse, isReview, isCounterStopped, talqinSurahId, talqinFromVerse, talqinToVerse, tasmieSurahId, tasmieFromVerse, tasmieToVerse, attendanceRecords]);

    // Ref to always hold the latest session data without triggering re-renders
    const sessionDataRef = useRef(sessionData);
    sessionDataRef.current = sessionData;

    const isDirtyRef = useRef(isDirty);
    isDirtyRef.current = isDirty;

    // Shared Save Logic
    const performSave = async (dataToSave?: typeof sessionData, silent = false): Promise<void> => {
        if (!selectedDay || !user) return;
        const data = dataToSave || sessionDataRef.current;
        const dateStr = format(selectedDay, 'yyyy-MM-dd');
        let sessionOwnerId: string | undefined = effectiveOwnerId || user?.uid;

        // Race Condition Guard: Ensure we are saving data for the currently loaded day
        if (loadedDate && loadedDate !== dateStr) {
            console.warn("Save prevented: Race condition detected. Loaded:", loadedDate, "Target:", dateStr);
            return;
        }

        // Use LOCKED ID if available, otherwise find existing or generate deterministic
        let id = currentSessionId;

        if (!id) {
            const existingSessions = getSessionsForDayRef.current(dateStr);
            const existingSession = existingSessions.find(s => {
                const num = s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                return num === sessionToOpen;
            });
            id = existingSession ? existingSession.id : `${dateStr}-s${sessionToOpen}`;
            setCurrentSessionId(id); // Lock it for future saves in this session
        }

        let existingSessionCreatedAt: string | undefined = undefined;

        // استخراج السجلات ومعلومات الجلسة السابقة محلياً للحفاظ على تاريخ الإنشاء وصاحب الحصة
        const localContextSessions = getSessionsForDayRef.current(dateStr);
        const existingLocal = localContextSessions.find((s: any) => s.id === id || (Number(s.sessionNumber || 1) === sessionToOpen));
        if (existingLocal) {
            if (existingLocal.createdAt) {
                existingSessionCreatedAt = existingLocal.createdAt;
            }
            if (existingLocal.ownerId && !ownerIdParam) {
                sessionOwnerId = existingLocal.ownerId;
            }
        }

        // بناء سجلات الطلاب مباشرة من أحدث حالة مسجلة على الواجهة
        const recordsArray: any[] = [];
        Object.entries(data.attendanceRecords).forEach(([studentId, d]: [string, any]) => {
            if (d && d.attendance) { // فقط إذا كان هناك حضور مسجل
                recordsArray.push({
                    ...d,
                    sessionId: id,
                    studentId,
                    surahId: (d.surahId !== undefined && d.surahId !== null && d.surahId !== 0) ? d.surahId : ((isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? (data.isCounterStopped ? null : data.talqinSurahId) : null),
                    fromVerse: (d.fromVerse !== undefined && d.fromVerse !== null) ? d.fromVerse : ((isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? (data.isCounterStopped ? null : data.talqinFromVerse) : null),
                    toVerse: (d.toVerse !== undefined && d.toVerse !== null) ? d.toVerse : ((isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? (data.isCounterStopped ? null : data.talqinToVerse) : null),
                    talqinSurahId: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.talqinSurahId : null,
                    talqinFromVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.talqinFromVerse : null,
                    talqinToVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.talqinToVerse : null,
                    tasmieSurahId: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.tasmieSurahId : null,
                    tasmieFromVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.tasmieFromVerse : null,
                    tasmieToVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.tasmieToVerse : null,
                    catchUpRecords: d.catchUpRecords || [],
                    makeupSessions: d.makeupSessions || [],
                });
            }
        });

        const sessionPayload: any = {
            id,
            date: dateStr,
            sessionNumber: sessionToOpen,
            sessionType: data.sessionType,
            teacherAbsenceReason: data.sessionType === 'غياب الشيخ' ? data.teacherAbsenceReason : null,
            substituteTeacher: (data.sessionType === 'غياب الشيخ' && data.substituteTeacher) ? data.substituteTeacher : null,
            activityType: (data.sessionType === 'حصة أنشطة' && data.activityType) ? data.activityType : null,
            activityDescription: (data.sessionType === 'حصة أنشطة' && data.activityDescription) ? data.activityDescription : null,
            surahId: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.surahId : null,
            fromVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? (data.isCounterStopped ? null : data.talqinFromVerse) : null,
            toVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? (data.isCounterStopped ? null : data.talqinToVerse) : null,
            isReview: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.isReview : false,
            isCounterStopped: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.isCounterStopped : false,
            talqinSurahId: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.talqinSurahId : null,
            talqinFromVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.talqinFromVerse : null,
            talqinToVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.talqinToVerse : null,
            tasmieSurahId: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.tasmieSurahId : null,
            tasmieFromVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.tasmieFromVerse : null,
            tasmieToVerse: (isUnifiedMode || groupMode === 'hybrid' || isAdmin5) ? data.tasmieToVerse : null,
            records: recordsArray,
            ...(existingSessionCreatedAt ? { createdAt: existingSessionCreatedAt } : {})
        };

        // Pass effectiveOwnerId if it differs from current user (i.e. Admin actions)
        const targetOwner = (effectiveOwnerId && effectiveOwnerId !== user?.uid) ? effectiveOwnerId : undefined;
        try {
            await addDailySession(sessionPayload, targetOwner, { silent });

            if ((isUnifiedMode || groupMode === 'hybrid') && sessionOwnerId && data.talqinSurahId && data.talqinToVerse) {
                try {
                    await updateSheikhGroupSettings(sessionOwnerId, undefined, {
                        surahId: data.talqinSurahId,
                        currentVerse: data.talqinToVerse,
                        lastTalqinFrom: data.talqinFromVerse,
                        lastTalqinTo: data.talqinToVerse,
                        startedAt: groupSurahConfig?.startedAt || new Date().toISOString().split('T')[0]
                    });
                } catch (settErr) {
                    console.warn('Could not sync sheikh settings immediately:', settErr);
                }
            }

            if (!silent) {
                toast({
                    title: isEffectiveOnline() ? "✅ تم حفظ الحصة" : "⚡ تم الحفظ محلياً بنجاح",
                    description: isEffectiveOnline()
                        ? "تم حفظ الحصة وتحديث التقييمات بنجاح في السحابة."
                        : "تم تشفير وحفظ بيانات الحصة محلياً وستُرفع تلقائياً للسحابة فور توفر الإنترنت.",
                    duration: 3000,
                });
            }
        } catch (error: any) {
            console.error('Failed to save session:', error);
            if (!silent) {
                toast({
                    title: "❌ فشل حفظ الحصة",
                    description: `حدث خطأ أثناء الحفظ: ${error.message || error}`,
                    variant: "destructive",
                    duration: 3000,
                });
            }
            throw error;
        }
    };

    const handleManualSave = async () => {
        setIsSaving(true);
        try {
            const dataToSave = sessionDataRef.current;
            await performSave(dataToSave, false);
            setLastSaved(new Date());
            setIsDirty(false);
        } catch (e) {
            console.error("Manual save failed:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReturn = async () => {
        if (isDirtyRef.current) {
            const shouldSave = confirm("توجد تعديلات مسجلة على هذه الحصة.\n\nهل تريد حفظ الحصة قبل الخروج؟");
            if (shouldSave) {
                setIsSaving(true);
                try {
                    await performSave(sessionDataRef.current, false);
                    setIsDirty(false);
                } catch (e) {
                    console.error("Save on exit failed", e);
                    return; // منع الخروج في حال فشل الحفظ
                } finally {
                    setIsSaving(false);
                }
            }
        }
        const returnUrl = ownerIdParam ? `/sessions?ownerId=${ownerIdParam}` : '/sessions';
        router.push(returnUrl);
    };

    // Navigate to previous/next day
    const navigateToDay = async (direction: -1 | 1) => {
        if (isNavigating || isSaving) return;

        if (isDirtyRef.current) {
            const shouldSave = confirm("توجد تعديلات مسجلة على هذه الحصة.\n\nهل تريد حفظ الحصة قبل الانتقال؟");
            if (shouldSave) {
                setIsSaving(true);
                try {
                    await performSave(sessionDataRef.current, false);
                    setIsDirty(false);
                } catch (e) {
                    console.error("Save before navigate failed", e);
                    return;
                } finally {
                    setIsSaving(false);
                }
            }
        }

        setIsNavigating(true);
        try {
            const newDate = addDays(selectedDay, direction);
            const newDateStr = format(newDate, 'yyyy-MM-dd');

            const queryParams = new URLSearchParams();
            queryParams.set('date', newDateStr);
            queryParams.set('session', sessionToOpen.toString());
            if (ownerIdParam) {
                queryParams.set('ownerId', ownerIdParam);
            }

            router.push(`/sessions/register?${queryParams.toString()}`);
        } catch (error) {
            console.error("Navigation error:", error);
            setIsNavigating(false);
        }
    };

    // Swipe handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        isSwiping.current = false;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;

        // Only trigger if horizontal swipe is dominant and exceeds threshold
        if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            // RTL layout: swipe right = previous day, swipe left = next day
            if (deltaX > 0) {
                navigateToDay(-1); // Swipe right → previous day
            } else {
                navigateToDay(1);  // Swipe left → next day
            }
        }
    };

    // Manual Refresh: إعادة تحميل البيانات مباشرة من Firebase
    const handleRefresh = async () => {
        if (!user || !selectedDay) return;

        setIsRefreshing(true);
        try {
            const dateStr = format(selectedDay, 'yyyy-MM-dd');

            // 🔍 Detect session owner from context
            let sessionOwnerId = effectiveOwnerId || user.uid;

            if (!ownerIdParam) {
                const contextSessions = getSessionsForDay(dateStr);
                const existingContextSession = contextSessions.find((s: any) => {
                    const num = s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                    return num === sessionToOpen;
                });
                if (existingContextSession && existingContextSession.ownerId) {
                    sessionOwnerId = existingContextSession.ownerId;
                }
            }

            const sessionsRef = dbRef(db, `users/${sessionOwnerId}/dailySessions/${dateStr}`);
            const snapshot = await get(sessionsRef);

            if (snapshot.exists()) {
                const val = snapshot.val();
                let sessionsDict: Record<string, any> = {};
                if (val && typeof val === 'object') {
                    if ('date' in val && ('records' in val || 'sessionType' in val)) {
                        // Old structure
                        const sessionId = val.id || `${dateStr}-s1`;
                        sessionsDict[sessionId] = {
                            ...val,
                            id: sessionId,
                            sessionNumber: val.sessionNumber !== undefined ? Number(val.sessionNumber) : 1
                        };
                    } else {
                        sessionsDict = val;
                    }
                }
                const existingSession = Object.values(sessionsDict).find((s: any) => {
                    const num = s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                    return num === sessionToOpen;
                });

                if (existingSession) {
                    const session = existingSession as any;
                    // تحميل البيانات المحدثة
                    setCurrentSessionId(session.id);
                    setSessionType(session.sessionType);
                    setTeacherAbsenceReason(session.teacherAbsenceReason || '');
                    setSubstituteTeacher(session.substituteTeacher || '');
                    setActivityType(session.activityType || '');
                    setActivityDescription(session.activityDescription || '');
                    if (session.surahId) setSurahId(session.surahId);
                    if (session.fromVerse) setFromVerse(session.fromVerse);
                    if (session.toVerse) setToVerse(session.toVerse);
                    if (session.isReview) setIsReview(session.isReview);
                    setIsCounterStopped(session.isCounterStopped || false);

                    if (session.talqinSurahId) setTalqinSurahId(session.talqinSurahId);
                    if (session.talqinFromVerse) setTalqinFromVerse(session.talqinFromVerse);
                    if (session.talqinToVerse) setTalqinToVerse(session.talqinToVerse);

                    if (session.tasmieSurahId) setTasmieSurahId(session.tasmieSurahId);
                    if (session.tasmieFromVerse) setTasmieFromVerse(session.tasmieFromVerse);
                    if (session.tasmieToVerse) setTasmieToVerse(session.tasmieToVerse);

                    const records: any = {};
                    const rawRecords = Array.isArray(session.records)
                        ? session.records
                        : (session.records && typeof session.records === 'object')
                            ? Object.values(session.records)
                            : [];
                    rawRecords.forEach((record: any) => {
                        if (record && record.studentId) {
                            records[record.studentId] = {
                                attendance: record.attendance,
                                memorization: record.memorization,
                                behavior: record.behavior,
                                notes: record.notes,
                                review: record.review,
                                isDelayed: record.isDelayed || false,
                                surahId: record.surahId,
                                fromVerse: record.fromVerse,
                                toVerse: record.toVerse,
                                catchUpRecords: record.catchUpRecords || [],
                                makeupSessions: record.makeupSessions || []
                            };
                        }
                    });
                    setAttendanceRecords(records);

                    setIsDirty(false);
                    setLastSaved(new Date());
                    toast({ title: "✅ تم التحديث", description: "تم تحميل أحدث البيانات من الخادم بنجاح." });
                } else {
                    toast({ title: "تنبيه", description: "لم يتم العثور على بيانات لهذه الحصة.", variant: "destructive" });
                }
            } else {
                toast({ title: "تنبيه", description: "لا توجد حصص مسجلة في هذا التاريخ.", variant: "destructive" });
            }
        } catch (error) {
            console.error("Refresh error:", error);
            toast({ title: "خطأ", description: "فشل تحميل البيانات. يرجى المحاولة مرة أخرى.", variant: "destructive" });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleManualSaveAndExit = async () => {
        setIsSaving(true);
        try {
            await performSave(sessionData, true); // Save immediate state
            toast({
                title: "تم الحفظ بنجاح ✅",
                description: "هل تريد إرسال تقارير الحصة للأولياء عبر واتساب؟",
                action: (
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="font-bold shrink-0 font-headline bg-white text-slate-900 hover:bg-slate-100"
                        onClick={() => {
                            const dateStr = format(selectedDay, 'yyyy-MM-dd');
                            router.push(`/parent-communication?mode=bulk&type=daily&date=${dateStr}`);
                        }}
                    >
                        إرسال التقارير
                    </Button>
                ),
                duration: 7000,
            });
            const returnUrl = ownerIdParam ? `/sessions?ownerId=${ownerIdParam}` : '/sessions';
            router.push(returnUrl);
        } catch (error) {
            console.error("Error saving session:", error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ البيانات.", variant: "destructive" });
            setIsSaving(false);
        }
    };


    const handleDelete = async () => {
        if (confirm('هل أنت متأكد من حذف بيانات هذه الحصة؟')) {
            const sessionIdToDelete = currentSessionId || getSessionsForDay(format(selectedDay, 'yyyy-MM-dd')).find(s => s.sessionNumber === sessionToOpen)?.id;

            if (sessionIdToDelete) {
                // Pass effectiveOwnerId if it differs from current user
                const targetOwner = (effectiveOwnerId && effectiveOwnerId !== user?.uid) ? effectiveOwnerId : undefined;
                console.log('🗑️ Deleting Session:', { sessionIdToDelete, targetOwner, effectiveOwnerId, date: format(selectedDay, 'yyyy-MM-dd') });

                // CRITICAL FIX: Must pass the date explicitly because session ID is a UUID and doesn't contain the date
                const dateStr = format(selectedDay, 'yyyy-MM-dd');
                await deleteDailySession(sessionIdToDelete, dateStr, targetOwner);

                toast({ title: "تم الحذف", description: "تم حذف بيانات الحصة بنجاح." });
                router.push('/sessions');
            } else {
                toast({ title: "خطأ", description: "لا يمكن العثور على معرف الحصة للحذف.", variant: "destructive" });
            }
        }
    };

    // Diagnostic Alert: If Admin and no ownerId param, warn them
    useEffect(() => {
        if ((isSuperAdmin || isAdmin5 || isManagement) && !ownerIdParam) {
            toast({
                title: "تنبيه نظام",
                description: "أنت تقوم بالتعديل باسمك الشخصي وليس باسم شيخ محدد. تأكد من اختيار الشيخ من القائمة السابقة.",
                variant: "destructive",
                duration: 5000
            });
        }
    }, [isSuperAdmin, isAdmin5, isManagement, ownerIdParam, toast]);

    // ─── حساب آخر نقطة توقف لكل طالب ──────────────────
    const studentLastProgress = useMemo(() => {
        const progressMap = new Map<string, { surahId: number; toVerse: number }>();
        if (!dailySessions || !activeSheikhId) return progressMap;

        // 1. Flatten all sessions for this sheikh
        const allSessions: any[] = Object.values(dailySessions)
            .flatMap(day => Object.values(day as Record<string, any>))
            .filter(s => s && s.ownerId === activeSheikhId);

        // 2. Sort sessions descending (newest first)
        allSessions.sort((a, b) => {
            if (a.date === b.date) {
                return (b.sessionNumber || 1) - (a.sessionNumber || 1);
            }
            return b.date.localeCompare(a.date);
        });

        // 3. Filter only PAST sessions
        const selectedDateStr = format(selectedDay, 'yyyy-MM-dd');
        const pastSessions = allSessions.filter(s => {
            if (s.date < selectedDateStr) return true;
            if (s.date === selectedDateStr && s.sessionNumber < sessionToOpen) return true;
            return false;
        });

        // 4. Fill the map with the latest surah/verse for each student
        const SESSION_TYPES_WITH_SURAH = ['حصة أساسية', 'حصة تعويضية', 'حصة إضافية'];
        for (const sess of pastSessions) {
            if (!SESSION_TYPES_WITH_SURAH.includes(sess.sessionType)) continue;
            const globalSurah = sess.surahId;
            const globalToVs = sess.toVerse;

            const recs = Array.isArray(sess.records) 
                ? sess.records 
                : sess.records ? Object.values(sess.records) : [];

            for (const rec of recs) {
                if (progressMap.has(rec.studentId)) continue; // We only want the latest
                if (!['حاضر', 'متأخر', 'تعويض'].includes(rec.attendance)) continue;

                if (rec.surahId && rec.toVerse) {
                    progressMap.set(rec.studentId, { surahId: rec.surahId, toVerse: rec.toVerse });
                } else if (globalSurah && globalToVs) {
                    progressMap.set(rec.studentId, { surahId: globalSurah, toVerse: globalToVs });
                }
            }
        }

        return progressMap;
    }, [dailySessions, activeSheikhId, selectedDay, sessionToOpen]);

    const handleUpdateStudentReviewMode = async (studentId: string, isReviewing: boolean) => {
        try {
            const student = students.find(s => s.id === studentId);
            if (student && updateStudent) {
                await updateStudent(studentId, { isReviewing }, student.ownerId);
            }
        } catch (err) {
            console.error("Failed to update student review mode:", err);
        }
    };

    // Tasmie/Talqin BeforeUnload Guard to prevent data loss
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    if (loading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div
            className="container mx-auto p-2 sm:p-4 max-w-4xl space-y-3 sm:space-y-6 pb-28 rtl"
            dir="rtl"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <header className="bg-card p-3 sm:p-4 rounded-2xl shadow-sm border space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-2 sm:gap-4">
                    <Button variant="ghost" size="icon" onClick={handleReturn} className="rounded-xl shrink-0 h-9 w-9 sm:h-10 sm:w-10">
                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm sm:text-base md:text-xl font-headline font-bold flex items-center gap-1.5 sm:gap-2">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                            <span className="truncate">تسجيل حصة: {format(selectedDay, 'd MMMM yyyy', { locale: ar })}</span>
                            {effectiveOwnerId && effectiveOwnerId !== user?.uid && (
                                <span className="text-[10px] sm:text-xs bg-amber-100 text-amber-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full mr-1.5 shrink-0">
                                    نيابة عن شيخ
                                </span>
                            )}
                        </h1>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-0.5">
                            <p className="text-[11px] sm:text-xs text-muted-foreground font-body">
                                رقم الحصة: <span className="font-bold text-primary">{sessionToOpen}</span> (يوم {format(selectedDay, 'EEEE', { locale: ar })})
                            </p>
                            {isSaving ? (
                                <span className="text-[9px] sm:text-[10px] text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full animate-pulse font-bold">
                                    <Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...
                                </span>
                            ) : isDirty ? (
                                <span className="text-[9px] sm:text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 px-2 py-0.5 rounded-full font-bold">
                                    ✏️ تعديلات قيد التسجيل
                                </span>
                            ) : lastSaved ? (
                                <span className="text-[9px] sm:text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> {isEffectiveOnline() ? "متزامن مع السحابة" : "محفوظ محلياً (أوفلاين)"}
                                </span>
                            ) : null}
                            {isDirty && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleManualSave}
                                    disabled={isSaving}
                                    className="h-6 sm:h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] sm:text-[10px] font-black px-2.5 shadow-sm gap-1 animate-pulse"
                                >
                                    <Save className="h-3 w-3" />
                                    <span>حفظ الحصة</span>
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isRefreshing || isSaving}
                                className="h-6 sm:h-7 rounded-lg text-[9px] sm:text-[10px] font-bold px-2"
                                title="تحديث البيانات من الخادم"
                            >
                                <RefreshCw className={cn("h-3 w-3 ml-1", isRefreshing && "animate-spin")} />
                                {isRefreshing ? "جاري التحديث..." : "تحديث"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Day Navigation Bar */}
                <div className="flex items-center justify-between bg-muted/40 rounded-xl px-1 sm:px-2 py-1 border border-border/50">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToDay(-1)}
                        disabled={isNavigating || isSaving}
                        className="h-8 sm:h-10 rounded-lg font-bold text-[10px] sm:text-xs gap-0.5 sm:gap-1 hover:bg-primary/10 active:bg-primary/20 transition-all px-1.5 sm:px-3"
                    >
                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="hidden sm:inline">{format(addDays(selectedDay, -1), 'EEEE', { locale: ar })}</span>
                        <span className="sm:hidden">السابق</span>
                    </Button>

                    <div className="flex flex-col items-center gap-0 text-center min-w-0 px-1">
                        <span className="text-[10px] sm:text-xs font-bold text-primary leading-tight">
                            {format(selectedDay, 'EEEE', { locale: ar })}
                        </span>
                        <span className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">
                            {format(selectedDay, 'dd/MM', { locale: ar })}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToDay(1)}
                        disabled={isNavigating || isSaving}
                        className="h-8 sm:h-10 rounded-lg font-bold text-[10px] sm:text-xs gap-0.5 sm:gap-1 hover:bg-primary/10 active:bg-primary/20 transition-all px-1.5 sm:px-3"
                    >
                        <span className="hidden sm:inline">{format(addDays(selectedDay, 1), 'EEEE', { locale: ar })}</span>
                        <span className="sm:hidden">التالي</span>
                        <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    </Button>
                </div>
                {isNavigating && (
                    <div className="flex items-center justify-center gap-2 text-xs text-primary animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" /> جاري الانتقال...
                    </div>
                )}
            </header>

            {groupMode === 'not_set' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 animate-in fade-in duration-300 rtl" dir="rtl">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div className="space-y-0.5 text-right">
                            <p className="text-xs font-black text-amber-800 dark:text-amber-300">إعداد نمط الحفظ للفوج غير مكتمل</p>
                            <p className="text-[10px] font-medium text-amber-700/80 dark:text-amber-400/80">لم تقم بتحديد النمط التشغيلي للفوج (موحد أو فردي) بعد. يرجى ضبط الإعدادات لتفعيل التعبئة التلقائية للورد واقتراح الآيات الذكي.</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => router.push('/management/groups')}
                        variant="outline"
                        size="sm"
                        className="border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[10px] shrink-0"
                    >
                        ضبط الإعدادات
                    </Button>
                </div>
            )}

            <section className="bg-card p-3 sm:p-4 rounded-2xl shadow-sm border space-y-3 sm:space-y-4">
                {(sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية' || sessionType === 'حصة إضافية') && (
                    <SessionStatsWidget students={sessionStudents} records={attendanceRecords} />
                )}

                <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-end justify-between">
                    <div className="space-y-1 flex-1 w-full">
                        <Label className="text-xs text-muted-foreground font-bold">نوع الحصة</Label>
                        <Select value={sessionType} onValueChange={handleSessionTypeChange} dir="rtl">
                            <SelectTrigger className="h-9 sm:h-10 rounded-xl text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="حصة أساسية">حصة أساسية</SelectItem>
                                <SelectItem value="حصة أنشطة">حصة أنشطة 🏃‍♂️</SelectItem>
                                {sessionToOpen === 2 && <SelectItem value="حصة إضافية">حصة إضافية ➕</SelectItem>}
                                <SelectItem value="يوم عطلة">يوم عطلة</SelectItem>
                                <SelectItem value="غياب الشيخ">غياب الشيخ</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية' || sessionType === 'حصة إضافية' || sessionType === 'حصة أنشطة' || (sessionType === 'غياب الشيخ' && substituteTeacher)) && (
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 w-full md:w-auto justify-end">
                            <Button onClick={handleMarkAllPresent} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 h-9 sm:h-10 rounded-xl font-bold text-[11px] sm:text-xs justify-center">
                                <UserCheck className="ml-1.5 h-3.5 w-3.5 shrink-0" /> تحضير الجميع
                            </Button>
                            <Button onClick={handleMarkAllQuiet} variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 h-9 sm:h-10 rounded-xl font-bold text-[11px] sm:text-xs justify-center">
                                <Smile className="ml-1.5 h-3.5 w-3.5 shrink-0" /> هدوء الجميع
                            </Button>
                            <Button onClick={handleMarkAllReview} variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 h-9 sm:h-10 rounded-xl font-bold text-[11px] sm:text-xs justify-center">
                                <RotateCcw className="ml-1.5 h-3.5 w-3.5 shrink-0" /> مراجعة الجميع
                            </Button>
                            <Button onClick={handleMarkAllGood} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 h-9 sm:h-10 rounded-xl font-bold text-[11px] sm:text-xs justify-center">
                                <CheckCircle className="ml-1.5 h-3.5 w-3.5 shrink-0" /> جيد الجميع
                            </Button>
                        </div>
                    )}
                </div>

                {(isUnifiedMode || groupMode === 'hybrid' || isAdmin5) && (sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية' || sessionType === 'حصة إضافية') && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-800 font-bold">
                                <BookOpen className="h-5 w-5" />
                                <span>{isCounterStopped ? "العداد موقوف" : `بيانات الأوراد الجماعية`}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => {
                                        const newStopped = !isCounterStopped;
                                        setIsCounterStopped(newStopped);
                                        // admin5: auto-toggle review mode with counter
                                        if (isAdmin5) setIsReview(newStopped);
                                        setIsDirty(true);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-9 px-3 rounded-lg font-bold text-[11px] transition-all border-2",
                                        isCounterStopped
                                            ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                                            : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                    )}
                                >
                                    {isCounterStopped ? <TimerOff className="ml-1.5 h-3.5 w-3.5" /> : <RefreshCw className="ml-1.5 h-3.5 w-3.5" />}
                                    {isCounterStopped ? "تشغيل العداد" : "توقيف العداد"}
                                </Button>
                                <Button
                                    onClick={() => {
                                        setIsReview(!isReview);
                                        setIsDirty(true);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-9 px-3 rounded-lg font-bold text-[11px] transition-all border-2",
                                        isReview
                                            ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                                            : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                    )}
                                    title={isReview ? "هذه الآيات للمراجعة فقط ولا تضاف للرصيد" : "هذه الآيات حفظ جديد وتضاف للرصيد"}
                                >
                                    {isReview ? <RotateCcw className="ml-1.5 h-3.5 w-3.5" /> : <Trophy className="ml-1.5 h-3.5 w-3.5" />}
                                    {isReview ? "وضع مراجعة" : "وضع حفظ"}
                                </Button>
                            </div>
                        </div>

                        {!isCounterStopped && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                {/* Wird Al-Talqin */}
                                <div className="p-3 bg-white/50 rounded-lg border border-emerald-100 space-y-2">
                                    <Label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">ورد التلقين (يُصحح اليوم)</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                        <div className="col-span-1 md:col-span-2">
                                            <SearchableSelect
                                                options={surahOptions}
                                                value={talqinSurahId.toString()}
                                                onValueChange={(val) => {
                                                    setTalqinSurahId(parseInt(val));
                                                    setIsDirty(true);
                                                }}
                                                placeholder="اختر السورة"
                                                className="h-9 bg-white border-emerald-100"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                value={talqinFromVerse}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setTalqinFromVerse(isNaN(val) ? '' as any : val);
                                                    setIsDirty(true);
                                                }}
                                                className="h-9 bg-white border-emerald-100"
                                                placeholder="من"
                                            />
                                            <Input
                                                type="number"
                                                value={talqinToVerse}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setTalqinToVerse(isNaN(val) ? '' as any : val);
                                                    setIsDirty(true);
                                                }}
                                                className="h-9 bg-white border-emerald-100"
                                                placeholder="إلى"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Wird Al-Tasmie */}
                                <div className="p-3 bg-white/50 rounded-lg border border-emerald-100 space-y-2">
                                    <Label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">ورد التسميع (تلقين الأمس)</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                        <div className="col-span-1 md:col-span-2">
                                            <SearchableSelect
                                                options={surahOptions}
                                                value={tasmieSurahId.toString()}
                                                onValueChange={(val) => {
                                                    setTasmieSurahId(parseInt(val));
                                                    setIsDirty(true);
                                                }}
                                                placeholder="اختر السورة"
                                                className="h-9 bg-white border-emerald-100"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                value={tasmieFromVerse}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setTasmieFromVerse(isNaN(val) ? '' as any : val);
                                                    setIsDirty(true);
                                                }}
                                                className="h-9 bg-white border-emerald-100"
                                                placeholder="من"
                                            />
                                            <Input
                                                type="number"
                                                value={tasmieToVerse}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setTasmieToVerse(isNaN(val) ? '' as any : val);
                                                    setIsDirty(true);
                                                }}
                                                className="h-9 bg-white border-emerald-100"
                                                placeholder="إلى"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {sessionType === 'غياب الشيخ' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">سبب الغياب</Label>
                            <Input value={teacherAbsenceReason} onChange={(e) => setTeacherAbsenceReason(e.target.value)} placeholder="السبب..." className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">المستخلف (اختياري)</Label>
                            <Input value={substituteTeacher} onChange={(e) => setSubstituteTeacher(e.target.value)} placeholder="اسم البديل" className="h-10 rounded-xl" />
                        </div>
                    </div>
                )}

                {sessionType === 'حصة أنشطة' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">نوع النشاط</Label>
                            <Input value={activityType} onChange={(e) => setActivityType(e.target.value)} placeholder="مثال: كرة قدم..." className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">نبذة مختصرة</Label>
                            <Input value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} placeholder="وصف للنشاط..." className="h-10 rounded-xl" />
                        </div>
                    </div>
                )}
            </section>

            {/* دليل استخدام خاصية الاستدراك والتعويض */}
            <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    type="button"
                    className="w-full flex items-center justify-between p-4 font-headline font-bold text-sm text-primary hover:bg-muted/30 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-primary" />
                        <span>💡 دليل استخدام خاصيتي الاستدراك والتعويض</span>
                    </div>
                    {showExplanation ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                </button>

                {showExplanation && (
                    <div className="p-4 border-t bg-muted/10 space-y-4 text-xs md:text-sm font-body text-foreground animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* الاستدراك */}
                            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-amber-800">
                                    <span className="flex items-center justify-center w-5 h-5 bg-amber-100 rounded-full text-xs">1</span>
                                    <span>خاصية الاستدراك (التسميع المتأخر)</span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed text-[11px] md:text-xs">
                                    تُستخدم عندما لا يتمكن الطالب من استظهار ورده (حفظه الجديد) في يومه المحدد، ويقوم بتسميعه في حصة لاحقة ليلتحق بزملائه.
                                </p>
                                <div className="pt-2 border-t border-amber-200/50 flex flex-wrap gap-2 text-[10px] md:text-xs">
                                    <span className="font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md">العلامة: خصم 20% من الحفظ</span>
                                    <span className="text-amber-800">يُضرب تقييم الحفظ في معامل عقوبة التأخر (0.8)</span>
                                </div>
                            </div>

                            {/* التعويض */}
                            <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-4 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-teal-800">
                                    <span className="flex items-center justify-center w-5 h-5 bg-teal-100 rounded-full text-xs">2</span>
                                    <span>خاصية التعويض (تعويض غياب سابق)</span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed text-[11px] md:text-xs">
                                    تُستخدم عند حضور الطالب في يوم غير رسمي أو قيامه بتسميع إضافي لتعويض يوم غاب فيه في الماضي (تظهر الأيام المتاحة للتعويض تلقائياً).
                                </p>
                                <div className="pt-2 border-t border-teal-200/50 flex flex-wrap gap-2 text-[10px] md:text-xs">
                                    <span className="font-bold text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded-md">العلامة: +3.5 نقاط حضور</span>
                                    <span className="text-teal-800">ترفع عقوبة الغياب (-10 نقاط) وتمنح نقاط حضور تعويضية</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-dashed text-center">
                            💡 <strong>ملاحظة:</strong> كلا الخاصيتين مفعلتان لجميع الحسابات لمساعدة الطلاب على تدارك ما فاتهم وتجنب خصم النقاط.
                        </div>
                    </div>
                )}
            </div>

            <main className="bg-card rounded-2xl shadow-sm border min-h-[400px]">
                {(sessionType === 'يوم عطلة' || (sessionType === 'غياب الشيخ' && !substituteTeacher)) ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                        <div className="p-6 bg-amber-100 rounded-full text-amber-600">
                            <AlertTriangle className="h-12 w-12" />
                        </div>
                        <h3 className="text-xl font-bold font-headline">لا يوجد تسجيل حضور</h3>
                        <p className="text-muted-foreground font-body max-w-sm text-sm">
                            {sessionType === 'يوم عطلة' ? 'هذا اليوم عطلة رسمية.' : 'يرجى تسجيل سبب الغياب أعلاه.'}
                        </p>
                    </div>
                ) : (
                    <div className="p-4">
                        <AttendanceList
                            students={sessionStudents}
                            records={attendanceRecords}
                            onUpdateRecord={handleUpdateRecord}
                            sessionType={sessionType}
                            pastWirds={pastWirds}
                            studentAbsenceHistory={studentAbsenceHistory}
                            groupMode={groupMode}
                            studentLastProgress={studentLastProgress}
                            onUpdateStudentReviewMode={handleUpdateStudentReviewMode}
                        />
                    </div>
                )}
            </main>



            <footer className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t p-2.5 sm:p-4 z-50 shadow-lg">
                <div className="container mx-auto max-w-4xl flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={handleManualSave}
                            disabled={isSaving}
                            className={cn(
                                "h-11 sm:h-12 rounded-2xl px-5 sm:px-8 font-black text-xs sm:text-sm shadow-md gap-2 transition-all active:scale-95 touch-manipulation select-none cursor-pointer",
                                isDirty
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-500/25 shadow-emerald-500/20 shadow-lg"
                                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>جاري الحفظ محلياً...</span>
                                </>
                            ) : isDirty ? (
                                <>
                                    <Save className="h-4 w-4" />
                                    <span>💾 حفظ الحصة الآن</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    <span>حفظ الحصة</span>
                                </>
                            )}
                        </Button>

                        {/* Status text in footer */}
                        <div className="hidden xs:flex items-center gap-1.5 text-[11px] sm:text-xs">
                            {isSaving ? (
                                <span className="text-primary font-bold flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...
                                </span>
                            ) : isDirty ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                    ✏️ تعديلات غير محفوظة
                                </span>
                            ) : lastSaved ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    {isEffectiveOnline() ? "متزامن" : "محفوظ محلياً"}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleReturn}
                            disabled={isSaving}
                            className="h-10 sm:h-11 rounded-xl px-3 sm:px-5 font-bold text-xs sm:text-sm"
                        >
                            <ArrowRight className="ml-1 sm:ml-1.5 h-4 w-4" /> رجوع
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isSaving}
                            className="h-10 sm:h-11 rounded-xl px-2.5 sm:px-3.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                            title="حذف الحصة"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default function RegisterSessionPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <RegisterSessionContent />
        </Suspense>
    );
}
