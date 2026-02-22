"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { format, parse, parseISO, subDays, addDays, isSameDay, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AttendanceStatus, PerformanceLevel, BehaviorLevel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Save, FileText, UserCheck, AlertTriangle, ArrowRight, ArrowLeft, Trash2, BookOpen, Smile, RotateCcw, TimerOff, MessageSquare, CheckCircle, Copy, Trophy, Cloud, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { surahs } from '@/lib/surahs';
import { db } from '@/lib/firebase';
import { ref as dbRef, get } from 'firebase/database';

function RegisterSessionContent() {
    const { user, isSuperAdmin } = useAuth();
    const { students, dailySessions, loading, getSessionsForDay, addDailySession, deleteDailySession, getSessionById } = useStudentContext();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const isAdmin5 = user?.email === 'admin5@gmail.com';

    const dateParam = searchParams.get('date');
    const sessionNumParam = searchParams.get('session');
    const ownerIdParam = searchParams.get('ownerId');

    const selectedDay = useMemo(() => {
        if (!dateParam) return new Date();
        // SAFE PARSING: Parse and Set to NOON
        const d = parse(dateParam, 'yyyy-MM-dd', new Date());
        d.setHours(12, 0, 0, 0);
        return d;
    }, [dateParam]);
    const sessionToOpen = useMemo(() => (sessionNumParam === '2' ? 2 : 1) as 1 | 2, [sessionNumParam]);

    const isManagement = user?.role === 'management';

    // Determine the effective owner ID (either specified in URL for admins, or current user)
    const effectiveOwnerId = useMemo(() => {
        if ((isSuperAdmin || isAdmin5 || isManagement) && ownerIdParam) {
            return ownerIdParam;
        }
        return user?.uid;
    }, [isSuperAdmin, isAdmin5, isManagement, ownerIdParam, user]);

    const [sessionType, setSessionType] = useState<'حصة أساسية' | 'حصة تعويضية' | 'يوم عطلة' | 'غياب الشيخ' | 'حصة أنشطة' | 'حصة إضافية'>('حصة أساسية');
    const [teacherAbsenceReason, setTeacherAbsenceReason] = useState('');
    const [substituteTeacher, setSubstituteTeacher] = useState('');
    const [activityType, setActivityType] = useState('');
    const [activityDescription, setActivityDescription] = useState('');
    const [surahId, setSurahId] = useState<number>(26); // Default Search (الشعراء)
    const [fromVerse, setFromVerse] = useState<number>(1);
    const [toVerse, setToVerse] = useState<number>(1);
    const [isReview, setIsReview] = useState(false);
    const [isCounterStopped, setIsCounterStopped] = useState(false);

    // Admin5 Talqin Wird
    const [talqinSurahId, setTalqinSurahId] = useState<number>(26);
    const [talqinFromVerse, setTalqinFromVerse] = useState<number>(1);
    const [talqinToVerse, setTalqinToVerse] = useState<number>(1);

    // Admin5 Tasmie Wird
    const [tasmieSurahId, setTasmieSurahId] = useState<number>(26);
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

    // Swipe navigation refs
    const touchStartX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
    const isSwiping = useRef(false);

    const surahOptions: SearchableSelectOption[] = useMemo(() => surahs.map(s => ({ value: s.id.toString(), label: `${s.id}. ${s.name}` })), []);

    const activeStudents = useMemo(() =>
        (students ?? []).filter(s => {
            // If specific owner is targeted, filter by that owner. Otherwise fall back to group name check or super admin view.
            if (effectiveOwnerId && effectiveOwnerId !== user?.uid) {
                return s.ownerId === effectiveOwnerId && s.status === "نشط";
            }
            const isGroupMatch = isSuperAdmin ? true : s.groupName === user?.group;
            return s.status === "نشط" && isGroupMatch;
        }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
        [students, isSuperAdmin, user, effectiveOwnerId]);

    // Calculate Past Wirds for Catch-up (Admin5 only)
    const pastWirds = useMemo(() => {
        if (!isAdmin5 || !dailySessions) return [];

        const currentSessionDate = selectedDay;
        // Flatten sessions from context
        const allSessions = Object.values(dailySessions).flatMap(day => Object.values(day as Record<string, any>));

        return allSessions
            .filter(s => {
                const sDate = parse(s.date, 'yyyy-MM-dd', new Date());
                // Only past sessions, basic/extra type, and has surah info
                return sDate < currentSessionDate &&
                    (s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة إضافية') &&
                    s.surahId;
            })
            .sort((a, b) => b.date.localeCompare(a.date)) // Newest first
            .map(s => {
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
            });
    }, [isAdmin5, dailySessions, selectedDay]);

    const DRAFT_KEY = useMemo(() => {
        return selectedDay ? `session_draft_${format(selectedDay, 'yyyy-MM-dd')}_s${sessionToOpen}` : null;
    }, [selectedDay, sessionToOpen]);

    useEffect(() => {
        // Load initial data logic
        const loadFromFirebase = async () => {
            // 1. Immediate State Reset on Date Change to prevent leakage
            setLoadedDate(null);
            setAttendanceRecords({});
            setCurrentSessionId(null);
            setSessionType('حصة أساسية'); // Default reset

            if (!selectedDay || !user) return;

            try {
                const dateStr = format(selectedDay, 'yyyy-MM-dd');

                // 🔍 Detect session owner from context (if viewing as admin)
                let sessionOwnerId = effectiveOwnerId || user.uid;

                if (!ownerIdParam) {
                    const contextSessions = getSessionsForDay(dateStr);
                    const existingContextSession = contextSessions.find((s: any) => s.sessionNumber == sessionToOpen);
                    if (existingContextSession && existingContextSession.ownerId) {
                        sessionOwnerId = existingContextSession.ownerId;
                    }
                }

                const sessionsRef = dbRef(db, `users/${sessionOwnerId}/dailySessions/${dateStr}`);
                const snapshot = await get(sessionsRef);

                let existingSession = null;
                if (snapshot.exists()) {
                    const sessions = snapshot.val();
                    existingSession = Object.values(sessions).find((s: any) => s.sessionNumber === sessionToOpen);
                }

                if (existingSession) {
                    const session = existingSession as any;
                    // DB Data Exists - Load from Firebase
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
                    session.records?.forEach((record: any) => {
                        records[record.studentId] = {
                            attendance: record.attendance,
                            memorization: record.memorization,
                            behavior: record.behavior,
                            notes: record.notes,
                            review: record.review,
                            surahId: record.surahId,
                            fromVerse: record.fromVerse,
                            toVerse: record.toVerse,
                            catchUpRecords: record.catchUpRecords || [] // Load catch-up
                        };
                    });
                    setAttendanceRecords(records);
                } else {
                    // No DB Data
                    // FIX: Disabled Local Storage Drafts per user request to prevent data leakage
                    /*
                    const isEditingOther = effectiveOwnerId && effectiveOwnerId !== user?.uid;
                    const savedDraft = (DRAFT_KEY && !isEditingOther) ? localStorage.getItem(DRAFT_KEY) : null;

                    if (savedDraft) {
                        try {
                            const draft = JSON.parse(savedDraft);
                            setCurrentSessionId(draft.id || null);
                            setSessionType(draft.sessionType || 'حصة أساسية');
                            setTeacherAbsenceReason(draft.teacherAbsenceReason || '');
                            setSubstituteTeacher(draft.substituteTeacher || '');
                            setActivityType(draft.activityType || '');
                            setActivityDescription(draft.activityDescription || '');
                            setSurahId(draft.surahId || 26);
                            setFromVerse(draft.fromVerse || 1);
                            setToVerse(draft.toVerse || 1);
                            setIsReview(draft.isReview || false);
                            setAttendanceRecords(draft.attendanceRecords || {});
                            toast({ title: "مسودة محفوظة", description: "تم استرجاع بيانات غير محفوظة من المتصفح." });
                        } catch (e) {
                            console.error("Failed to parse draft", e);
                        }
                    } else {
                    */
                    setCurrentSessionId(null); // Truly new
                    setAttendanceRecords({}); // FIX: Reset records to prevent leakage from previous day

                    // FIX: Stopped defaulting to Holiday on Thu/Fri per user request
                    setSessionType(sessionToOpen === 1 ? 'حصة أساسية' : 'حصة إضافية');

                    // Logic for admin5 auto-increment - DISABLED per user request for "Empty Sessions"
                    /*
                    if (isAdmin5 && sessionToOpen === 1) {
                        const allSessions = Object.values(dailySessions || {}).flatMap(day => Object.values(day as Record<string, any>));
                        const sortedSessions = allSessions
                            .filter(s => s.sessionType === 'حصة أساسية' && s.surahId && !s.isReview)
                            .sort((a, b) => b.date.localeCompare(a.date));

                        const latestSession = sortedSessions[0];
                        if (latestSession) {
                            const currentSurah = surahs.find(s => s.id === latestSession.surahId);
                            if (latestSession.toVerse && currentSurah && latestSession.toVerse < currentSurah.verses) {
                                setSurahId(latestSession.surahId);
                                setFromVerse(latestSession.toVerse + 1);
                                setToVerse(latestSession.toVerse + 1);
                            } else {
                                setSurahId((latestSession.surahId % 114) + 1);
                                setFromVerse(1);
                                setToVerse(1);
                            }
                        } else {
                            setSurahId(26);
                            setFromVerse(1);
                            setToVerse(1);
                        }
                    }
                    */
                    //}
                }
            } catch (error) {
                console.error("Error loading session from Firebase:", error);
                toast({ title: "خطأ", description: "فشل تحميل البيانات من الخادم.", variant: "destructive" });
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
    }, [loading, selectedDay, sessionToOpen, user]);

    const handleSessionTypeChange = (val: any) => {
        setSessionType(val);
        setIsDirty(true);
    };

    const handleUpdateRecord = (studentId: string, field: keyof AttendanceRecord, value: any) => {
        setIsDirty(true);
        setAttendanceRecords(prev => {
            const currentRecord = prev[studentId] || {
                studentId,
                attendance: '' as AttendanceStatus,
                memorization: '' as PerformanceLevel,
                behavior: '' as BehaviorLevel,
                notes: '',
                review: false
            };

            const updatedRecord = {
                ...currentRecord,
                [field]: value,
                attendance: field === 'attendance' ? value : (currentRecord.attendance || 'حاضر')
            };

            // Auto-set evaluation to "لم يحفظ" when marking present in basic session
            if (field === 'attendance' && value === 'حاضر' && sessionType === 'حصة أساسية' && !updatedRecord.memorization) {
                updatedRecord.memorization = 'لم يحفظ';
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
            activeStudents.forEach(student => {
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
            activeStudents.forEach(student => {
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
            activeStudents.forEach(student => {
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
            activeStudents.forEach(student => {
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

    const debouncedSessionData = useDebounce(sessionData, 1500); // Auto-save after 1.5s of inactivity

    // Shared Save Logic
    const performSave = async (data: typeof sessionData): Promise<void> => {
        if (!selectedDay || !user) return;
        const dateStr = format(selectedDay, 'yyyy-MM-dd');

        // Race Condition Guard: Ensure we are saving data for the currently loaded day
        // If loadedDate doesn't match dateStr, it means we navigated away but this save (from debounce) fired late.
        if (loadedDate !== dateStr) {
            console.warn("Save prevented: Race condition detected. Loaded:", loadedDate, "Target:", dateStr);
            return;
        }

        // Use LOCKED ID if available, otherwise find existing or generate deterministic
        let id = currentSessionId;

        if (!id) {
            const existingSessions = getSessionsForDay(dateStr);
            const existingSession = existingSessions.find(s => s.sessionNumber == sessionToOpen);
            id = existingSession ? existingSession.id : `${dateStr}-s${sessionToOpen}`;
            setCurrentSessionId(id); // Lock it for future saves in this session
        }

        // ✅ CRITICAL: قراءة البيانات القديمة من Firebase ودمجها مع الجديدة
        let existingRecords: any[] = [];
        try {
            // 🔍 Detect session owner
            let sessionOwnerId = effectiveOwnerId || user?.uid;

            if (!ownerIdParam) {
                const contextSessions = getSessionsForDay(dateStr);
                const existingContextSession = contextSessions.find((s: any) => s.id === id);
                if (existingContextSession && existingContextSession.ownerId) {
                    sessionOwnerId = existingContextSession.ownerId;
                }
            }

            const sessionsRef = dbRef(db, `users/${sessionOwnerId}/dailySessions/${dateStr}`);
            const snapshot = await get(sessionsRef);
            if (snapshot.exists()) {
                const sessions = snapshot.val();
                const existingSession = Object.values(sessions).find((s: any) => s.id === id);
                if (existingSession && (existingSession as any).records) {
                    existingRecords = (existingSession as any).records;
                }
            }
        } catch (error) {
            console.error("Error reading existing records:", error);
        }

        // دمج البيانات القديمة مع الجديدة
        const mergedRecords: Record<string, any> = {};

        // أولاً: تحميل جميع البيانات القديمة
        existingRecords.forEach((record: any) => {
            mergedRecords[record.studentId] = record;
        });

        // ثانياً: تحديث/إضافة البيانات الجديدة
        Object.entries(data.attendanceRecords).forEach(([studentId, d]: [string, any]) => {
            if (d.attendance) { // فقط إذا كان هناك attendance
                mergedRecords[studentId] = {
                    ...d,
                    sessionId: id,
                    studentId,
                    surahId: isAdmin5 ? (data.isCounterStopped ? null : data.talqinSurahId) : (d.surahId || null),
                    fromVerse: isAdmin5 ? (data.isCounterStopped ? null : data.talqinFromVerse) : (d.fromVerse || null),
                    toVerse: isAdmin5 ? (data.isCounterStopped ? null : data.talqinToVerse) : (d.toVerse || null),
                    talqinSurahId: isAdmin5 ? data.talqinSurahId : null,
                    talqinFromVerse: isAdmin5 ? data.talqinFromVerse : null,
                    talqinToVerse: isAdmin5 ? data.talqinToVerse : null,
                    tasmieSurahId: isAdmin5 ? data.tasmieSurahId : null,
                    tasmieFromVerse: isAdmin5 ? data.tasmieFromVerse : null,
                    tasmieToVerse: isAdmin5 ? data.tasmieToVerse : null,
                    catchUpRecords: d.catchUpRecords || [], // Save catch-up records
                };
            }
        });

        // تحويل إلى array
        const recordsArray = Object.values(mergedRecords);

        const sessionPayload: any = {
            id,
            date: dateStr,
            sessionNumber: sessionToOpen,
            sessionType: data.sessionType,
            teacherAbsenceReason: data.sessionType === 'غياب الشيخ' ? data.teacherAbsenceReason : null,
            substituteTeacher: (data.sessionType === 'غياب الشيخ' && data.substituteTeacher) ? data.substituteTeacher : null,
            activityType: (data.sessionType === 'حصة أنشطة' && data.activityType) ? data.activityType : null,
            activityDescription: (data.sessionType === 'حصة أنشطة' && data.activityDescription) ? data.activityDescription : null,
            surahId: isAdmin5 ? data.surahId : null,
            fromVerse: isAdmin5 ? (data.isCounterStopped ? null : data.talqinFromVerse) : null,
            toVerse: isAdmin5 ? (data.isCounterStopped ? null : data.talqinToVerse) : null,
            isReview: isAdmin5 ? data.isReview : false,
            isCounterStopped: isAdmin5 ? data.isCounterStopped : false,
            talqinSurahId: isAdmin5 ? data.talqinSurahId : null,
            talqinFromVerse: isAdmin5 ? data.talqinFromVerse : null,
            talqinToVerse: isAdmin5 ? data.talqinToVerse : null,
            tasmieSurahId: isAdmin5 ? data.tasmieSurahId : null,
            tasmieFromVerse: isAdmin5 ? data.tasmieFromVerse : null,
            tasmieToVerse: isAdmin5 ? data.tasmieToVerse : null,
            records: recordsArray
        };

        // Pass effectiveOwnerId if it differs from current user (i.e. Admin actions)
        const targetOwner = (effectiveOwnerId && effectiveOwnerId !== user?.uid) ? effectiveOwnerId : undefined;
        console.log('📝 Saving Session:', { effectiveOwnerId, currentUserId: user?.uid, targetOwner, ownerIdParam });
        await addDailySession(sessionPayload, targetOwner);
    };

    // Save Draft to LocalStorage whenever debounced data changes
    useEffect(() => {
        if (DRAFT_KEY && debouncedSessionData && (isDirty || currentSessionId)) {
            const draft = {
                ...debouncedSessionData,
                id: currentSessionId // IMPORTANT: Persist the ID
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        }
    }, [debouncedSessionData, DRAFT_KEY, isDirty, currentSessionId]);

    // Auto-Save Effect
    useEffect(() => {
        if (loading || isInitialLoad || !isDirty) return;

        const autoSave = async () => {
            setIsSaving(true);
            try {
                await performSave(debouncedSessionData);
                setLastSaved(new Date());
                setIsDirty(false);
            } catch (error) {
                console.error("Auto-save failed:", error);
            } finally {
                setIsSaving(false);
            }
        };

        autoSave();
    }, [debouncedSessionData]); // Dependencies handled by useDebounce

    const handleReturn = async () => {
        if (isDirty || isSaving) {
            setIsSaving(true);
            try {
                await performSave(sessionData); // Force final save
                toast({ title: "تم الحفظ", description: "تم حفظ التغييرات قبل الخروج." });
            } catch (e) {
                console.error("Save on exit failed", e);
                toast({ title: "تنبيه", description: "قد لا تكون بعض التغييرات محفوظة.", variant: "destructive" });
            } finally {
                setIsSaving(false);
            }
        } else if (lastSaved) {
            toast({ title: "محفوظ", description: "جميع البيانات محفوظة." });
        }
        router.push('/sessions');
    };

    // Navigate to previous/next day
    const navigateToDay = async (direction: -1 | 1) => {
        if (isNavigating || isSaving) return;
        setIsNavigating(true);

        try {
            // Save current data before navigating
            if (isDirty) {
                setIsSaving(true);
                try {
                    await performSave(sessionData);
                } catch (e) {
                    console.error("Save before navigate failed", e);
                    toast({ title: "تنبيه", description: "قد لا تكون بعض التغييرات محفوظة.", variant: "destructive" });
                } finally {
                    setIsSaving(false);
                }
            }

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
                const existingContextSession = contextSessions.find((s: any) => s.sessionNumber == sessionToOpen);
                if (existingContextSession && existingContextSession.ownerId) {
                    sessionOwnerId = existingContextSession.ownerId;
                }
            }

            const sessionsRef = dbRef(db, `users/${sessionOwnerId}/dailySessions/${dateStr}`);
            const snapshot = await get(sessionsRef);

            if (snapshot.exists()) {
                const sessions = snapshot.val();
                const existingSession = Object.values(sessions).find((s: any) => s.sessionNumber === sessionToOpen);

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
                    session.records?.forEach((record: any) => {
                        records[record.studentId] = {
                            attendance: record.attendance,
                            memorization: record.memorization,
                            behavior: record.behavior,
                            notes: record.notes,
                            review: record.review,
                            surahId: record.surahId,
                            fromVerse: record.fromVerse,
                            toVerse: record.toVerse,
                            catchUpRecords: record.catchUpRecords || []
                        };
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
            await performSave(sessionData); // Save immediate state
            toast({
                title: "تم الحفظ",
                description: `تم حفظ بيانات الحصة بنجاح.`,
            });
            router.push('/sessions');
        } catch (error) {
            console.error("Error saving session:", error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ البيانات.", variant: "destructive" });
            setIsSaving(false);
        }
    };

    const [copiedDaily, setCopiedDaily] = useState(false);
    const [copiedHarvest, setCopiedHarvest] = useState(false);

    const messages = useMemo(() => {
        if (!isAdmin5 || (sessionType !== 'حصة أساسية' && sessionType !== 'حصة تعويضية' && sessionType !== 'حصة إضافية')) return { daily: "", harvest: "" };

        const dateStr = format(selectedDay, 'EEEE dd-MM-yyyy', { locale: ar });
        const dayOfWeek = format(selectedDay, 'EEEE', { locale: ar });
        const isSaturday = dayOfWeek === "السبت";
        const currentSurah = surahs.find(s => s.id === surahId);
        const isCompletion = toVerse === currentSurah?.verses;
        const pad = (num: number) => num < 10 ? `0${num} ` : num.toString();

        const getRecitedList = () => activeStudents
            .filter(s => {
                const record = attendanceRecords[s.id];
                return record && record.memorization && record.memorization !== "لا يوجد" && (record.attendance === 'حاضر' || record.attendance === 'متأخر');
            })
            .map(s => `* ${s.fullName}* : ${attendanceRecords[s.id].memorization || ''} `);

        const getLateList = () => activeStudents
            .filter(s => {
                const record = attendanceRecords[s.id];
                return record && record.attendance === 'متأخر';
            })
            .map(s => `* ${s.fullName}* `);

        const getAbsentList = () => activeStudents
            .filter(s => {
                const record = attendanceRecords[s.id];
                return record && record.attendance === 'غياب';
            })
            .map(s => `* ${s.fullName}* `);

        const header = "السلام عليكم ورحمة الله وبركاته";
        const dateLine = `اليوم ${dateStr} `;
        const recitedStudents = getRecitedList();

        // Message 1: Daily Progress
        let dailyContent = "";
        if (isCounterStopped) {
            dailyContent = `(العداد موقوف لهذا اليوم)\n`;
        } else {
            const tasmieSurah = surahs.find(s => s.id === tasmieSurahId);
            const isTasmieCompletion = tasmieToVerse === tasmieSurah?.verses;

            if (isTasmieCompletion) {
                dailyContent = `قائمة الطلبة الذين إستظهروا ورد التسميع (سورة ${tasmieSurah?.name || ''}) : \n`;
            } else {
                dailyContent = `قائمة الطلبة الذين إستظهروا ورد التسميع من الآية(${pad(tasmieFromVerse)}) إلى الآية(${pad(tasmieToVerse)}) من سورة ${tasmieSurah?.name || ''} : \n`;
            }
        }
        dailyContent += recitedStudents.length > 0 ? recitedStudents.join('\n') : "لا يوجد";

        const lateStudents = getLateList();
        const absentStudents = getAbsentList();

        if (lateStudents.length > 0) {
            dailyContent += `\n-------------\nقائمة الطلبة المتأخرين: \n${lateStudents.join('\n')} `;
        }

        if (absentStudents.length > 0) {
            dailyContent += `\n-------------\nقائمة الطلبة الغائبين: \n${absentStudents.join('\n')} `;
        }

        // --- Add Catch-up Section to Daily Message ---
        const catchUpGroups: Record<string, string[]> = {};

        activeStudents.forEach(s => {
            const record = attendanceRecords[s.id];
            if (record && record.catchUpRecords && record.catchUpRecords.length > 0) {
                record.catchUpRecords.forEach(c => {
                    const key = `${c.surahName} (${c.fromVerse}-${c.toVerse}) - ${c.date}`;
                    if (!catchUpGroups[key]) catchUpGroups[key] = [];
                    catchUpGroups[key].push(s.fullName);
                });
            }
        });

        if (Object.keys(catchUpGroups).length > 0) {
            dailyContent += `\n\n-------------\n📋 تم تعويض الأوراد التالية:\n`;
            Object.entries(catchUpGroups).forEach(([key, students]) => {
                dailyContent += `\n🔸 ${key}:\n`;
                students.forEach((name, i) => {
                    dailyContent += `${i + 1}. ${name}\n`;
                });
            });
        }

        const dailyMessage = `${header} \n${dateLine} \n${dailyContent} `;

        let harvestMessage = "";
        if (isSaturday) {
            // Find Historical Range: last Sat to last Wed
            const lastSatDate = subDays(selectedDay, 7);
            const lastWedDate = subDays(selectedDay, 3);

            let harvestFrom = 0;
            let harvestTo = 0;
            let harvestSurah = currentSurah?.name || "";

            const allSessions = Object.values(dailySessions || {}).flatMap(day => Object.values(day as Record<string, any>));
            const weekSessions = allSessions.filter(s => {
                const sDate = parse(s.date, 'yyyy-MM-dd', new Date());
                return sDate >= lastSatDate && sDate <= lastWedDate && s.sessionType === 'حصة أساسية' && s.surahId;
            }).sort((a, b) => a.date.localeCompare(b.date));

            if (weekSessions.length > 0) {
                harvestFrom = weekSessions[0].fromVerse || 0;
                harvestTo = weekSessions[weekSessions.length - 1].toVerse || 0;
                const hSurah = surahs.find(s => s.id === weekSessions[0].surahId);
                harvestSurah = hSurah ? hSurah.name : harvestSurah;
            }

            let harvestContent = `قائمة الطلاب الذين إستظهروا الحصيلة الأسبوعية / سورة ${harvestSurah} من الآية(${pad(harvestFrom)}) إلى(${pad(harvestTo)}) : \n`;
            harvestContent += recitedStudents.length > 0 ? recitedStudents.join('\n') : "لا يوجد";

            const notRecitedStudents = activeStudents
                .filter(s => {
                    const record = attendanceRecords[s.id];
                    const isPresent = record && (record.attendance === 'حاضر' || record.attendance === 'متأخر');
                    const hasRecited = record && record.memorization && record.memorization !== "لم يحفظ" && record.memorization !== "لا يوجد";
                    return isPresent && !hasRecited;
                })
                .map(s => `* ${s.fullName}* `);

            if (notRecitedStudents.length > 0) {
                harvestContent += `\n\nقائمة الطلاب الذين لم يستظهروا الحصيلة الأسبوعية: \n`;
                harvestContent += notRecitedStudents.join('\n');
            }
            harvestMessage = `${header} \n${dateLine} \n${harvestContent} `;
        }

        return { daily: dailyMessage, harvest: harvestMessage };
    }, [isAdmin5, sessionType, selectedDay, surahId, fromVerse, toVerse, activeStudents, attendanceRecords, dailySessions]);

    const handleCopyDaily = () => {
        navigator.clipboard.writeText(messages.daily);
        setCopiedDaily(true);
        toast({ title: "تم النسخ", description: "تم نسخ رسالة الورد اليومي." });
        setTimeout(() => setCopiedDaily(false), 2000);
    };

    const handleCopyHarvest = () => {
        if (messages.harvest) {
            navigator.clipboard.writeText(messages.harvest);
            setCopiedHarvest(true);
            toast({ title: "تم النسخ", description: "تم نسخ رسالة الحصيلة الأسبوعية." });
            setTimeout(() => setCopiedHarvest(false), 2000);
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

    if (loading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div
            className="container mx-auto p-4 max-w-4xl space-y-6 pb-24 rtl"
            dir="rtl"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <header className="bg-card p-4 rounded-2xl shadow-sm border space-y-3">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/sessions')} className="rounded-xl">
                        <ArrowRight className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg md:text-xl font-headline font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
                            <span className="truncate">تسجيل حصة: {format(selectedDay, 'd MMMM yyyy', { locale: ar })}</span>
                            {effectiveOwnerId && effectiveOwnerId !== user?.uid && (
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full mr-2 shrink-0">
                                    نيابة عن شيخ
                                </span>
                            )}
                        </h1>
                        <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-xs text-muted-foreground font-body">
                                رقم الحصة: <span className="font-bold text-primary">{sessionToOpen}</span> (يوم {format(selectedDay, 'EEEE', { locale: ar })})
                            </p>
                            {isSaving ? (
                                <span className="text-[10px] text-primary flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full animate-pulse">
                                    <Cloud className="h-3 w-3" /> جاري الحفظ...
                                </span>
                            ) : lastSaved ? (
                                <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full transition-all">
                                    <Cloud className="h-3 w-3" /> تم الحفظ
                                </span>
                            ) : null}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isRefreshing || isSaving}
                                className="h-7 rounded-lg text-[10px] font-bold"
                                title="تحديث البيانات من الخادم"
                            >
                                <RefreshCw className={cn("h-3 w-3 ml-1", isRefreshing && "animate-spin")} />
                                {isRefreshing ? "جاري التحديث..." : "تحديث"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Day Navigation Bar */}
                <div className="flex items-center justify-between bg-muted/40 rounded-xl px-1.5 sm:px-2 py-1 border border-border/50">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToDay(-1)}
                        disabled={isNavigating || isSaving}
                        className="h-10 rounded-lg font-bold text-[11px] sm:text-xs gap-0.5 sm:gap-1 hover:bg-primary/10 active:bg-primary/20 transition-all px-2 sm:px-3"
                    >
                        <ChevronRight className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{format(addDays(selectedDay, -1), 'EEEE', { locale: ar })}</span>
                        <span className="sm:hidden">السابق</span>
                    </Button>

                    <div className="flex flex-col items-center gap-0 text-center min-w-0 px-1">
                        <span className="text-[11px] sm:text-xs font-bold text-primary leading-tight">
                            {format(selectedDay, 'EEEE', { locale: ar })}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">
                            {format(selectedDay, 'dd/MM', { locale: ar })}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToDay(1)}
                        disabled={isNavigating || isSaving}
                        className="h-10 rounded-lg font-bold text-[11px] sm:text-xs gap-0.5 sm:gap-1 hover:bg-primary/10 active:bg-primary/20 transition-all px-2 sm:px-3"
                    >
                        <span className="hidden sm:inline">{format(addDays(selectedDay, 1), 'EEEE', { locale: ar })}</span>
                        <span className="sm:hidden">التالي</span>
                        <ChevronLeft className="h-4 w-4 shrink-0" />
                    </Button>
                </div>
                {isNavigating && (
                    <div className="flex items-center justify-center gap-2 text-xs text-primary animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" /> جاري الانتقال...
                    </div>
                )}
            </header>

            <section className="bg-card p-4 rounded-2xl shadow-sm border space-y-4">
                {(sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية' || sessionType === 'حصة إضافية') && (
                    <SessionStatsWidget students={activeStudents} records={attendanceRecords} />
                )}

                <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                    <div className="space-y-1 flex-1 w-full">
                        <Label className="text-xs text-muted-foreground font-bold">نوع الحصة</Label>
                        <Select value={sessionType} onValueChange={handleSessionTypeChange} dir="rtl">
                            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
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
                        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                            <Button onClick={handleMarkAllPresent} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 h-10 rounded-xl flex-1 md:flex-none font-bold text-xs">
                                <UserCheck className="ml-2 h-4 w-4" /> تحضير الجميع
                            </Button>
                            <Button onClick={handleMarkAllQuiet} variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 h-10 rounded-xl flex-1 md:flex-none font-bold text-xs">
                                <Smile className="ml-2 h-4 w-4" /> هدوء الجميع
                            </Button>
                            <Button onClick={handleMarkAllReview} variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 h-10 rounded-xl flex-1 md:flex-none font-bold text-xs">
                                <RotateCcw className="ml-2 h-4 w-4" /> مراجعة الجميع
                            </Button>
                            <Button onClick={handleMarkAllGood} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 h-10 rounded-xl flex-1 md:flex-none font-bold text-xs">
                                <CheckCircle className="ml-2 h-4 w-4" /> جيد الجميع
                            </Button>
                        </div>
                    )}
                </div>

                {isAdmin5 && (sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية' || sessionType === 'حصة إضافية') && (
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
                            students={activeStudents}
                            records={attendanceRecords}
                            onUpdateRecord={handleUpdateRecord}
                            sessionType={sessionType}
                            pastWirds={pastWirds}
                        />
                    </div>
                )}
            </main>

            {isAdmin5 && messages.daily && (
                <div className="space-y-4">
                    <section className="bg-card p-4 rounded-2xl shadow-sm border space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <MessageSquare className="h-5 w-5" />
                                <span>رسالة الورد اليومي (WhatsApp)</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyDaily}
                                className={cn(
                                    "h-9 rounded-xl font-bold transition-all",
                                    copiedDaily ? "bg-green-50 text-green-700 border-green-200" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
                                )}
                            >
                                {copiedDaily ? <CheckCircle className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
                                {copiedDaily ? "تم النسخ" : "نسخ الرسالة"}
                            </Button>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-xl text-sm font-body whitespace-pre-wrap leading-relaxed border border-dashed text-right" dir="rtl">
                            {messages.daily}
                        </div>
                    </section>

                    {messages.harvest && (
                        <section className="bg-emerald-50/50 p-4 rounded-2xl shadow-sm border border-emerald-100 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                                    <Trophy className="h-5 w-5 text-emerald-600" />
                                    <span>رسالة الحصيلة الأسبوعية (WhatsApp)</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyHarvest}
                                    className={cn(
                                        "h-9 rounded-xl font-bold transition-all",
                                        copiedHarvest ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-emerald-100/50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-100"
                                    )}
                                >
                                    {copiedHarvest ? <CheckCircle className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
                                    {copiedHarvest ? "تم النسخ" : "نسخ الحصيلة"}
                                </Button>
                            </div>
                            <div className="bg-white/60 p-4 rounded-xl text-sm font-body whitespace-pre-wrap leading-relaxed border border-emerald-100 text-right text-emerald-900" dir="rtl">
                                {messages.harvest}
                            </div>
                            <p className="text-[10px] text-emerald-600/70 text-center italic">
                                ظهرت هذه الرسالة لأن اليوم هو السبت، وهي تلخص عمل الأسبوع الماضي (السبت-الأربعاء).
                            </p>
                        </section>
                    )}
                </div>
            )}

            <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t p-4 z-50">
                <div className="container mx-auto max-w-4xl flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleReturn} className="h-11 rounded-xl px-6">
                            <ArrowRight className="ml-2 h-4 w-4" /> رجوع
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} className="h-11 rounded-xl px-4 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
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
