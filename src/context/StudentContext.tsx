

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import type { Student, DailySession, DailyReport, Payment, AppSettings, SurahMastery, PointsConfig, Reward, BadgeConfig, DailyRecord, Covenant, PreRegistration, AppUser, PaymentStatus, SurahMasteryEntry, AdminLog } from '@/lib/types';
import { isWithinInterval, parseISO, isValid, isAfter, subDays } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '@/lib/firebase';
import { ref, set, onValue, off, remove, DatabaseReference, update, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { sanitizeData } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';

const DEFAULT_POINTS_CONFIG: PointsConfig = {
  attendance: { 'حاضر': 5, 'متأخر': 2, 'تعويض': 1.5, 'غائب': -10 },
  evaluation: { 'ممتاز': 10, 'جيد جداً': 7, 'جيد': 5, 'متوسط': 2, 'ضعيف': -5 },
  behavior: { 'هادئ': 3, 'متوسط': 0, 'غير منضبط': -10 },
  review: { 'completed': 1 },
  surah: { 'memorized': 20, 'mastered': 50 },
  covenantCompleted: 15,
};

const DEFAULT_REWARDS: Reward[] = [
  { id: 'weekly_reader', name: 'لقب قارئ الأسبوع', cost: 500, icon: "Star", description: 'تعزيز الثقة بالنفس أمام الزملاء.', requiredRank: 5 },
  { id: 'review_exempt', name: 'إعفاء من تسميع مراجعة', cost: 1000, icon: "Medal", description: 'مكافأة على الحفظ المتقن السابق.', requiredRank: 3 },
  { id: 'leader_for_day', name: 'قائد الفوج لليوم', cost: 800, icon: "UserCheck", description: 'تنمية المهارات القيادية لدى الطالب.', requiredRank: 2 },
  { id: 'physical_gift', name: 'هدية عينية (مصحف/قلم)', cost: 3000, icon: "Gift", description: 'تشجيع مادي ملموس.' },
];

const DEFAULT_BADGES: BadgeConfig[] = [
  { id: 'mastery_king', name: 'ملك الإتقان', icon: 'Crown', threshold: 1000, metric: 'masteryScore' },
];

const TIER_PRICES = {
  renewal: { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 },
};

const DEFAULT_SETTINGS: AppSettings = {
  seasonStartDate: new Date(new Date().getFullYear(), 8, 1).toISOString(), // Default to Sep 1st of current year
  prices: TIER_PRICES,
  points: DEFAULT_POINTS_CONFIG,
  rewards: DEFAULT_REWARDS,
  badges: DEFAULT_BADGES,
  registrationFees: {}
};

interface HallOfFameData {
  commitmentKing: { id?: string; name?: string; streak: number; photoURL?: string; };
  academicKing: { id?: string; name?: string; streak: number; photoURL?: string; };
  behaviorKing: { id?: string; name?: string; streak: number; photoURL?: string; };
  suraGuardian: { id?: string; name?: string; count: number; photoURL?: string; };
  persistentTeacher: { streak: number; };
  givingRecord: { count: number; };
}


interface StudentContextType {
  students: Student[];
  preRegistrations: PreRegistration[];
  allUsers: AppUser[];
  dailySessions: Record<string, Record<string, DailySession>>;
  dailyReports: { [date: string]: { [reportId: string]: DailyReport } };
  surahProgress: Record<string, SurahMastery>;
  payments: Payment[];
  settings: AppSettings;
  hallOfFame: HallOfFameData | null;
  adminLogs: AdminLog[];
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'> & { photoFile?: File | null, ownerId: string, groupName: string }) => Promise<void>;
  updateStudent: (studentId: string, updatedData: Partial<Student> & { photoFile?: File | null }, ownerId: string) => Promise<void>;
  deleteStudent: (studentId: string, ownerId: string) => void;
  deleteAllStudents: () => void;
  deleteMultipleStudents: (studentsToDelete: { id: string, ownerId: string }[]) => void;
  addDailySession: (session: DailySession) => Promise<void>;
  deleteDailySession: (sessionId: string) => void;
  getSessionsForDay: (date: string) => DailySession[];
  getSessionById: (sessionId: string) => DailySession | undefined;
  getRecordsForDateRange: (startDate: string, endDate: string) => Record<string, DailySession[]>;
  importStudents: (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => void;
  importPreRegistrations: (newPreRegs: Omit<PreRegistration, 'id'>[]) => void;
  updatePreRegistration: (regId: string, data: Partial<PreRegistration> & { photoFile?: File | null }, isEditing: boolean) => Promise<void>;
  bulkUpdatePreRegistrations: (ids: string[], data: Partial<PreRegistration>) => void;
  deleteAllPreRegistrations: () => void;
  deleteMultiplePreRegistrations: (ids: string[]) => void;
  saveDailyReport: (reportData: Partial<DailyReport>, reportIdToUpdate?: string) => Promise<void>;
  deleteDailyReport: (reportId: string, date: string) => Promise<void>;
  toggleSurahStatus: (studentId: string, surahId: number) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  updatePaymentStatus: (paymentId: string, status: PaymentStatus, amount: number) => Promise<void>;
  saveSettings: (newSettings: AppSettings) => Promise<void>;
  generateDemoData: () => Promise<void>;
  shareStudentRecord: (studentId: string, historyData: any) => Promise<void>;
  saveAdminLog: (log: Omit<AdminLog, 'id' | 'timestamp'>) => Promise<void>;
  deleteAdminLog: (log: AdminLog) => Promise<void>;
  getNextTicketNumber: () => Promise<number>;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user: authContextUser, loading: authLoading, isSuperAdmin, isManagement, role } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [preRegistrations, setPreRegistrations] = useState<PreRegistration[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [dailySessions, setDailySessions] = useState<Record<string, Record<string, DailySession>>>({});
  const [dailyReports, setDailyReports] = useState<{ [date: string]: { [reportId: string]: DailyReport } }>({});
  const [surahProgress, setSurahProgress] = useState<Record<string, SurahMastery>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!authContextUser) {
      setLoading(false);
      setStudents([]);
      setDailySessions({});
      setDailyReports({});
      setSurahProgress({});
      setPayments([]);
      setSettingsState(DEFAULT_SETTINGS);
      setPreRegistrations([]);
      setAllUsers([]);
      setAdminLogs([]);
      return;
    }

    setLoading(true);

    let dataRef: DatabaseReference;
    let preRegsRef: DatabaseReference;
    let dataListener: () => void;
    let preRegsListener: () => void;

    // Only fetch allUsers list for management/super_admin or if specifically needed
    let allUsersRef: DatabaseReference | null = null;
    let allUsersListener: (() => void) | null = null;

    if (isSuperAdmin || isManagement) {
      console.log(`[StudentContext] Setting up allUsers listener for role: ${role}`);
      allUsersRef = ref(db, 'users');
      allUsersListener = onValue(allUsersRef, (snapshot) => {
        const usersData = snapshot.val();
        const usersArray = usersData ? Object.entries(usersData).map(([uid, data]: [string, any]) => ({
          uid,
          ...data.profile
        })) : [];
        setAllUsers(usersArray);
      }, (error) => {
        console.error(`Firebase read failed for allUsers (role: ${role}): ${error.message}`);
      });
    }


    const processStudentData = (studentData: any, uid: string, groupName?: string): Student => ({
      ...studentData,
      id: studentData.id,
      ownerId: uid,
      groupName: groupName || 'غير محدد',
      birthDate: studentData.birthDate ? parseISO(studentData.birthDate) : new Date(),
      registrationDate: studentData.registrationDate ? parseISO(studentData.registrationDate) : new Date(),
      updatedAt: studentData.updatedAt ? parseISO(studentData.updatedAt) : new Date(),
      covenants: studentData.covenants ? Object.values(studentData.covenants) : [],
    });

    const processPreRegData = (preReg: any): PreRegistration => ({
      ...preReg,
      requestedAt: preReg.requestedAt && isValid(parseISO(preReg.requestedAt)) ? parseISO(preReg.requestedAt) : preReg.requestedAt,
      birthDate: preReg.birthDate && isValid(parseISO(preReg.birthDate)) ? parseISO(preReg.birthDate) : preReg.birthDate,
    });

    // Only fetch pre_registrations for management/super_admin
    if (isSuperAdmin || isManagement) {
      preRegsRef = ref(db, 'pre_registrations');
      preRegsListener = onValue(preRegsRef, (snapshot) => {
        const data = snapshot.val();
        const preRegsArray: PreRegistration[] = data ? Object.entries(data).map(([id, r]) => processPreRegData({ id, ...(r as any) })) : [];
        setPreRegistrations(preRegsArray);
      }, (error) => {
        if (error.message.includes('permission_denied')) {
          console.warn(`[StudentContext] Permission denied for ${role} on /pre_registrations.`);
        } else {
          console.error(`Firebase read failed for pre_registrations: ${error.message}`);
        }
      });
    }


    if (isSuperAdmin || isManagement) {
      dataRef = ref(db, 'users');
      dataListener = onValue(dataRef, (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          return;
        }
        const allUsersData = snapshot.val();
        let allStudents: Student[] = [];
        let allSessions: Record<string, Record<string, DailySession>> = {};
        let allReports: { [date: string]: { [reportId: string]: DailyReport } } = {};
        let allProgress: Record<string, SurahMastery> = {};
        let allPayments: Payment[] = [];
        let allAdminLogs: AdminLog[] = [];
        let finalSettings: AppSettings = DEFAULT_SETTINGS;

        if (allUsersData[authContextUser.uid]?.settings) {
          finalSettings = {
            ...DEFAULT_SETTINGS,
            ...allUsersData[authContextUser.uid].settings
          }
        }

        for (const uid in allUsersData) {
          const userData = allUsersData[uid];
          if (userData.students) {
            const userStudents = Object.entries(userData.students).map(([id, s]: [string, any]) =>
              processStudentData({ ...s, id }, uid, userData.profile?.group)
            );
            allStudents.push(...userStudents);
          }
          if (userData.dailySessions) Object.assign(allSessions, userData.dailySessions);
          if (userData.dailyReports) {
            for (const date in userData.dailyReports) {
              if (!allReports[date]) allReports[date] = {};
              Object.assign(allReports[date], userData.dailyReports[date]);
            }
          }
          if (userData.surahProgress) Object.assign(allProgress, userData.surahProgress);
          if (userData.payments) {
            const userPayments = Object.entries(userData.payments).map(([id, p]) => ({ id, ...(p as Omit<Payment, 'id'>) }));
            allPayments.push(...userPayments);
          }
          if (userData.admin_logs) {
            const userLogs = Object.entries(userData.admin_logs).map(([id, l]) => ({ id, ...(l as Omit<AdminLog, 'id'>) }));
            allAdminLogs.push(...userLogs);
          }
        }
        setStudents(allStudents);
        setDailySessions(allSessions);
        setDailyReports(allReports);
        setSurahProgress(allProgress);
        setPayments(allPayments);
        setAdminLogs(allAdminLogs);
        setSettingsState(finalSettings);
        setLoading(false);
      }, (error) => {
        if (error.message.includes('permission_denied')) {
          console.warn(`[StudentContext] Permission denied for ${role} on /users. Falling back to personal data.`);
        } else {
          console.error(`Firebase read failed for ${role}: ${error.message}`);
        }
        setLoading(false);
      });

    } else {
      dataRef = ref(db, `users/${authContextUser.uid}`);
      dataListener = onValue(dataRef, (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          setStudents([]); setDailySessions({}); setDailyReports({});
          setSurahProgress({}); setPayments([]); setSettingsState(DEFAULT_SETTINGS);
          return;
        }
        const data = snapshot.val();
        let userStudents: Student[] = [];
        if (data.students) {
          userStudents = Object.entries(data.students).map(([id, s]: [string, any]) =>
            processStudentData({ ...s, id }, authContextUser.uid, data.profile?.group)
          );
        }
        const paymentsArray = data.payments ? Object.entries(data.payments).map(([id, p]) => ({ id, ...(p as Omit<Payment, 'id'>) })) : [];
        const adminLogsArray = data.admin_logs ? Object.entries(data.admin_logs).map(([id, l]) => ({ id, ...(l as Omit<AdminLog, 'id'>) })) : [];
        const userSettings = data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS;

        setStudents(userStudents);
        setDailySessions(data.dailySessions || {});
        setDailyReports(data.dailyReports || {});
        setSurahProgress(data.surahProgress || {});
        setPayments(paymentsArray);
        setAdminLogs(adminLogsArray);
        setSettingsState(userSettings);
        setLoading(false);
      }, (error) => {
        console.error(`Firebase read failed for user ${authContextUser.uid}: ${error.message}`);
        setLoading(false);
      });
    }

    return () => {
      if (dataRef && dataListener) off(dataRef, 'value', dataListener);
      if (preRegsRef && preRegsListener) off(preRegsRef, 'value', preRegsListener);
      if (allUsersRef && allUsersListener) off(allUsersRef, 'value', allUsersListener);
    };
  }, [authContextUser, authLoading, isSuperAdmin, isManagement]);


  // Hall of Fame Logic
  const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

  const allSortedSessions = useMemo(() => {
    if (!dailySessions) return [];
    return Object.values(dailySessions)
      .flatMap(day => Object.values(day))
      .filter(session => session && session.date)
      .sort((a, b) => {
        try {
          return parseISO(a.date).getTime() - parseISO(b.date).getTime()
        } catch (e) { return 0 }
      });
  }, [dailySessions]);

  const commitmentKing = useMemo(() => {
    if (allSortedSessions.length === 0 || activeStudents.length === 0) return { id: undefined, name: undefined, streak: 0, photoURL: undefined };
    const sortedBasicSessions = allSortedSessions.filter(s => s.sessionType === 'حصة أساسية');
    if (sortedBasicSessions.length === 0) return { id: undefined, name: undefined, streak: 0, photoURL: undefined };
    let maxStreak = 0; let king: Student | undefined = undefined;
    activeStudents.forEach(student => {
      let currentStreak = 0; let studentMaxStreak = 0;
      sortedBasicSessions.forEach(session => {
        if (parseISO(session.date) < student.registrationDate) return;
        const record = (session.records || []).find(r => r.studentId === student.id);
        if (record && record.attendance === 'حاضر') currentStreak++;
        else { studentMaxStreak = Math.max(studentMaxStreak, currentStreak); currentStreak = 0; }
      });
      studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
      if (studentMaxStreak > maxStreak) { maxStreak = studentMaxStreak; king = student; }
    });
    return { id: king?.id, name: king?.fullName, streak: maxStreak, photoURL: king?.photoURL };
  }, [activeStudents, allSortedSessions]);

  const academicKing = useMemo(() => {
    if (allSortedSessions.length === 0 || activeStudents.length === 0) return { id: undefined, name: undefined, streak: 0, photoURL: undefined };
    const sortedBasicSessions = allSortedSessions.filter(s => s.sessionType === 'حصة أساسية');
    let maxStreak = 0; let king: Student | undefined = undefined;
    activeStudents.forEach(student => {
      let currentStreak = 0; let studentMaxStreak = 0;
      sortedBasicSessions.forEach(session => {
        if (parseISO(session.date) < student.registrationDate) return;
        const record = (session.records || []).find(r => r.studentId === student.id);
        if (record && record.memorization === 'ممتاز') currentStreak++;
        else { studentMaxStreak = Math.max(studentMaxStreak, currentStreak); currentStreak = 0; }
      });
      studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
      if (studentMaxStreak > maxStreak) { maxStreak = studentMaxStreak; king = student; }
    });
    return { id: king?.id, name: king?.fullName, streak: maxStreak, photoURL: king?.photoURL };
  }, [activeStudents, allSortedSessions]);

  const behaviorKing = useMemo(() => {
    if (allSortedSessions.length === 0 || activeStudents.length === 0) return { id: undefined, name: undefined, streak: 0, photoURL: undefined };
    const sortedBasicSessions = allSortedSessions.filter(s => s.sessionType === 'حصة أساسية');
    let maxStreak = 0; let king: Student | undefined = undefined;
    activeStudents.forEach(student => {
      let currentStreak = 0; let studentMaxStreak = 0;
      sortedBasicSessions.forEach(session => {
        if (parseISO(session.date) < student.registrationDate) return;
        const record = (session.records || []).find(r => r.studentId === student.id);
        if (record && record.behavior === 'هادئ') currentStreak++;
        else { studentMaxStreak = Math.max(studentMaxStreak, currentStreak); currentStreak = 0; }
      });
      studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
      if (studentMaxStreak > maxStreak) { maxStreak = studentMaxStreak; king = student; }
    });
    return { id: king?.id, name: king?.fullName, streak: maxStreak, photoURL: king?.photoURL };
  }, [activeStudents, allSortedSessions]);

  const suraGuardian = useMemo(() => {
    if (activeStudents.length === 0 || !surahProgress) {
      return { id: undefined, name: undefined, count: 0, photoURL: undefined };
    }

    const thirtyDaysAgo = subDays(new Date(), 30);
    let maxCount = 0;
    let guardian: Student | undefined = undefined;

    activeStudents.forEach(student => {
      const studentProgress = surahProgress[student.id];
      if (!studentProgress) return;

      const recentCompletions = Object.values(studentProgress).filter(entry => {
        if (entry.status > 0 && entry.completedAt) {
          try {
            const completionDate = parseISO(entry.completedAt);
            return isAfter(completionDate, thirtyDaysAgo);
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      if (recentCompletions.length > maxCount) {
        maxCount = recentCompletions.length;
        guardian = student;
      }
    });

    return { id: guardian?.id, name: guardian?.fullName, count: maxCount, photoURL: guardian?.photoURL };
  }, [activeStudents, surahProgress]);

  const persistentTeacher = useMemo(() => {
    if (allSortedSessions.length === 0) return { streak: 0 };
    let maxStreak = 0; let currentStreak = 0;
    const uniqueDates = [...new Set(allSortedSessions.map(s => s.date))].sort();
    uniqueDates.forEach(date => {
      const sessionsForDay = allSortedSessions.filter(s => s.date === date);
      const isTeacherAbsent = sessionsForDay.some(s => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher);
      if (!isTeacherAbsent) currentStreak++;
      else { maxStreak = Math.max(maxStreak, currentStreak); currentStreak = 0; }
    });
    maxStreak = Math.max(maxStreak, currentStreak);
    return { streak: maxStreak };
  }, [allSortedSessions]);

  const givingRecord = useMemo(() => {
    if (allSortedSessions.length === 0 || !settings) return { count: 0 };
    const seasonStartDate = settings.seasonStartDate ? parseISO(settings.seasonStartDate) : null;
    const extraSessions = allSortedSessions.filter(s => {
      if (s.sessionType !== 'حصة تعويضية') return false;
      if (seasonStartDate) { const sessionDate = parseISO(s.date); return isAfter(sessionDate, seasonStartDate); }
      return true;
    });
    return { count: extraSessions.length };
  }, [allSortedSessions, settings]);

  const hallOfFame = useMemo<HallOfFameData | null>(() => ({
    commitmentKing, academicKing, behaviorKing, suraGuardian, persistentTeacher, givingRecord
  }), [commitmentKing, academicKing, behaviorKing, suraGuardian, persistentTeacher, givingRecord]);

  const previousHallOfFame = useRef<HallOfFameData | null>(hallOfFame);

  useEffect(() => {
    if (loading || !hallOfFame || !previousHallOfFame.current) {
      previousHallOfFame.current = hallOfFame;
      return;
    };
    const checkRecordChange = (newRecord: any, oldRecord: any, category: string) => {
      if (newRecord?.id && oldRecord?.id && newRecord.id !== oldRecord.id && newRecord.name) {
        toast({
          title: `👑 إنجاز جديد!`,
          description: `${newRecord.name} حطم الرقم القياسي في: ${category}!`,
        });
      }
    };
    checkRecordChange(hallOfFame.commitmentKing, previousHallOfFame.current.commitmentKing, 'ملك الالتزام');
    checkRecordChange(hallOfFame.academicKing, previousHallOfFame.current.academicKing, 'الخمسة المتتالية');
    checkRecordChange(hallOfFame.behaviorKing, previousHallOfFame.current.behaviorKing, 'سفير الأدب');
    checkRecordChange(hallOfFame.suraGuardian, previousHallOfFame.current.suraGuardian, 'حارس السور');
    previousHallOfFame.current = hallOfFame;
  }, [hallOfFame, toast]);


  const addStudent = async (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'> & { photoFile?: File | null, ownerId: string, groupName: string }): Promise<void> => {
    if (!authContextUser) return;

    const ownerId = (isSuperAdmin || isManagement) ? studentData.ownerId : authContextUser.uid;
    if (!ownerId) return;

    const studentId = uuidv4();
    let photoURL = studentData.photoURL || '';

    if (studentData.photoFile) {
      const imageRef = storageRef(storage, `student_photos/${studentId}`);
      await uploadBytes(imageRef, studentData.photoFile);
      photoURL = await getDownloadURL(imageRef);
    }

    const { photoFile, ...restOfStudentData } = studentData;

    const newStudent: Omit<Student, 'id'> & { id: string } = {
      ...(restOfStudentData as any),
      id: studentId,
      ownerId: ownerId,
      groupName: studentData.groupName,
      memorizedSurahsCount: 0,
      subscriptionTier: studentData.subscriptionTier || 'فئة الأصاغر',
      updatedAt: new Date(),
      covenants: [],
      photoURL: photoURL
    };
    const studentRef = ref(db, `users/${ownerId}/students/${studentId}`);
    const studentOp = set(studentRef, {
      ...newStudent,
      birthDate: newStudent.birthDate ? newStudent.birthDate.toISOString() : null,
      registrationDate: newStudent.registrationDate.toISOString(),
      updatedAt: newStudent.updatedAt.toISOString(),
      covenants: newStudent.covenants || null // Use null for empty array
    });

    const surahProgressRef = ref(db, `users/${ownerId}/surahProgress/${studentId}`);
    const progressOp = set(surahProgressRef, {});

    await Promise.all([studentOp, progressOp]);

    // Log action
    logActivity(
      'ADD_STUDENT',
      authContextUser.uid,
      `تم إضافة طالب جديد: ${newStudent.fullName}`,
      studentId,
      newStudent.fullName,
      authContextUser.displayName || 'Unknown',
      newStudent.groupName,
      ownerId
    );
  };

  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => {
    if (!authContextUser) return;
    newStudents.forEach(s => addStudent({ ...s, ownerId: authContextUser.uid, groupName: authContextUser.group || 'غير محدد' }));
  }

  const updatePreRegistration = async (regId: string, data: Partial<PreRegistration> & { photoFile?: File | null }, isEditing: boolean) => {
    if (!authContextUser) return;

    let finalPhotoURL = data.photoURL;

    if (data.photoFile) {
      const imageRef = storageRef(storage, `pre_reg_photos/${regId}`);
      await uploadBytes(imageRef, data.photoFile);
      finalPhotoURL = await getDownloadURL(imageRef);
    }

    const { photoFile, ...restOfData } = data;

    const finalData: Partial<PreRegistration> = {
      ...restOfData,
      photoURL: finalPhotoURL === undefined ? null : finalPhotoURL,
      birthDate: data.birthDate instanceof Date ? data.birthDate.toISOString() : (data.birthDate || null),
      requestedAt: data.requestedAt instanceof Date ? data.requestedAt.toISOString() : (data.requestedAt || null),
    };

    if (!isEditing) {
      finalData.status = 'مرشح';
    }

    const regRef = ref(db, `pre_registrations/${regId}`);
    await update(regRef, finalData);

    toast({
      title: isEditing ? '✅ تم التحديث' : '✅ تم التسجيل',
      description: `تم تحديث بيانات ${data.fullName} بنجاح.`
    });
  };

  const bulkUpdatePreRegistrations = (ids: string[], data: Partial<PreRegistration>) => {
    const updates: { [key: string]: any } = {};
    ids.forEach(id => {
      const existingData = preRegistrations.find(p => p.id === id);
      if (!existingData) return;

      const updatedReg = { ...existingData, ...data };
      const regToSave = {
        ...updatedReg,
        birthDate: updatedReg.birthDate instanceof Date ? updatedReg.birthDate.toISOString() : updatedReg.birthDate,
        requestedAt: updatedReg.requestedAt instanceof Date ? updatedReg.requestedAt.toISOString() : updatedReg.requestedAt,
      };

      updates[`/pre_registrations/${id}`] = regToSave;
    });
    const dbRef = ref(db);
    update(dbRef, updates);
    toast({
      title: `✅ تم التعديل الجماعي`,
      description: `تم تحديث بيانات ${ids.length} طلاب بنجاح.`,
    });
  };

  const importPreRegistrations = (newPreRegs: Omit<PreRegistration, 'id'>[]) => {
    if (!authContextUser) return;
    const updates: { [key: string]: any } = {};
    newPreRegs.forEach(reg => {
      const regId = uuidv4();
      updates[`/pre_registrations/${regId}`] = {
        ...reg,
        requestedAt: reg.requestedAt instanceof Date ? reg.requestedAt.toISOString() : reg.requestedAt,
        birthDate: reg.birthDate instanceof Date ? reg.birthDate.toISOString() : reg.birthDate,
      };
    });
    const dbRef = ref(db);
    update(dbRef, updates);
  }

  const deleteAllPreRegistrations = () => {
    const preRegsRef = ref(db, 'pre_registrations');
    remove(preRegsRef);
    toast({ title: "🗑️ تم الحذف", description: "تم مسح جميع التسجيلات الأولية بنجاح." });
  };

  const deleteMultiplePreRegistrations = (ids: string[]) => {
    const updates: { [key: string]: null } = {};
    ids.forEach(id => {
      updates[`/pre_registrations/${id}`] = null;
    });
    const dbRef = ref(db);
    update(dbRef, updates);
    toast({ title: `🗑️ تم حذف ${ids.length} تسجيل`, description: "تم حذف التسجيلات المحددة بنجاح." });
  };

  const updateStudent = async (studentId: string, updatedData: Partial<Student> & { photoFile?: File | null }, ownerId: string): Promise<void> => {
    if (!authContextUser) return;

    const studentOwnerId = (isSuperAdmin || isManagement) ? ownerId : authContextUser.uid;
    if (!studentOwnerId) return;

    const originalStudent = students.find(s => s.id === studentId);
    if (!originalStudent) return;

    // Prioritize new photoURL from updatedData (might be a preset avatar)
    let finalPhotoURL = updatedData.photoURL !== undefined ? updatedData.photoURL : originalStudent.photoURL;

    if (updatedData.photoFile) {
      const imageRef = storageRef(storage, `student_photos/${studentId}`);
      await uploadBytes(imageRef, updatedData.photoFile);
      finalPhotoURL = await getDownloadURL(imageRef);
    }

    const { photoFile, ...restOfUpdatedData } = updatedData;

    const finalData = { ...originalStudent, ...restOfUpdatedData, photoURL: finalPhotoURL, updatedAt: new Date() };

    const covenantsObject = (finalData.covenants || []).reduce((acc, cov) => {
      acc[cov.id] = cov;
      return acc;
    }, {} as Record<string, Covenant>);

    // Clean up undefined values before sending to Firebase
    const sanitizedData = sanitizeData(finalData);

    const studentRef = ref(db, `users/${studentOwnerId}/students/${studentId}`);
    await set(studentRef, {
      ...sanitizedData,
      birthDate: sanitizedData.birthDate ? sanitizedData.birthDate.toISOString() : null,
      registrationDate: sanitizedData.registrationDate.toISOString(),
      updatedAt: sanitizedData.updatedAt.toISOString(),
      covenants: Object.keys(covenantsObject).length > 0 ? covenantsObject : null
    });

    // Log action
    logActivity(
      'UPDATE_STUDENT',
      authContextUser.uid,
      `تم تحديث بيانات الطالب: ${finalData.fullName}`,
      studentId,
      finalData.fullName,
      authContextUser.displayName || 'Unknown',
      finalData.groupName,
      studentOwnerId
    );
  };

  const deleteStudent = async (studentId: string, ownerId: string) => {
    if (!authContextUser) return;
    const studentOwnerId = (isSuperAdmin || isManagement) ? ownerId : authContextUser.uid;
    if (!studentOwnerId) return;

    const studentRef = ref(db, `users/${studentOwnerId}/students/${studentId}`);
    const studentToDelete = students.find(s => s.id === studentId);
    await remove(studentRef);

    if (studentToDelete) {
      // Log action
      logActivity(
        'DELETE_STUDENT',
        authContextUser.uid,
        `تم حذف الطالب: ${studentToDelete.fullName}`,
        studentId,
        studentToDelete.fullName,
        authContextUser.displayName || 'Unknown',
        studentToDelete.groupName,
        studentOwnerId
      );
    }

    // Delete photo from storage
    try {
      const imageRef = storageRef(storage, `student_photos/${studentId}`);
      await deleteObject(imageRef);
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
        console.error("Error deleting student photo:", error);
      }
    }
  }

  const deleteAllStudents = () => {
    if (!authContextUser) return;

    if (isSuperAdmin || isManagement) {
      // For admins, delete all students currently in the list
      students.forEach(student => {
        deleteStudent(student.id, student.ownerId);
      });
    } else {
      // For sheikhs, only delete their own students
      students.forEach(student => {
        if (student.ownerId === authContextUser.uid) {
          deleteStudent(student.id, student.ownerId);
        }
      });
    }
  }

  const deleteMultipleStudents = (studentsToDelete: { id: string, ownerId: string }[]) => {
    if (!authContextUser) return;
    const updates: { [key: string]: null } = {};
    studentsToDelete.forEach(({ id, ownerId }) => {
      if (isSuperAdmin || isManagement || ownerId === authContextUser.uid) {
        updates[`/users/${ownerId}/students/${id}`] = null;
        updates[`/users/${ownerId}/surahProgress/${id}`] = null;
      }
    });
    const dbRef = ref(db);
    update(dbRef, updates);
    toast({ title: `🗑️ تم حذف ${studentsToDelete.length} طالب`, description: "تم حذف الطلاب المحددين بنجاح." });
  };

  const addDailySession = async (session: DailySession): Promise<void> => {
    if (!authContextUser || isSuperAdmin) return;

    // OPTIMISTIC UPDATE: تحديث الـ state المحلي فوراً
    setDailySessions(prev => ({
      ...prev,
      [session.date]: {
        ...prev[session.date],
        [session.id]: session
      }
    }));

    try {
      // الحفظ في Firebase
      const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${session.date}/${session.id}`);
      await set(sessionRef, session);

      // تسجيل النشاط
      await logActivity(
        'ADD_SESSION',
        authContextUser.uid,
        `تم تسجيل حصة جديدة بتاريخ: ${session.date}`,
        session.id,
        session.sessionType,
        authContextUser.displayName || 'Unknown',
        authContextUser.group || 'غير محدد',
        authContextUser.uid
      );
    } catch (error) {
      console.error("Error saving session:", error);

      // ROLLBACK: إزالة التحديث المتفائل عند الفشل
      setDailySessions(prev => {
        const updated = { ...prev };
        if (updated[session.date]) {
          const dateSessions = { ...updated[session.date] };
          delete dateSessions[session.id];
          updated[session.date] = dateSessions;
        }
        return updated;
      });

      throw error; // إعادة رمي الخطأ للتعامل معه في المكون
    }
  };

  const deleteDailySession = (sessionId: string) => {
    if (!authContextUser || isSuperAdmin) return;
    const date = sessionId.substring(0, 10);
    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${date}/${sessionId}`);
    const sessionToDelete = dailySessions[date]?.[sessionId];
    remove(sessionRef).then(() => {
      if (sessionToDelete) {
        logActivity(
          'DELETE_SESSION',
          authContextUser.uid,
          `تم حذف حصة بتاريخ: ${sessionToDelete.date}`,
          sessionId,
          sessionToDelete.sessionType,
          authContextUser.displayName || 'Unknown',
          authContextUser.group || 'غير محدد',
          authContextUser.uid
        );
      }
    });
  }

  const getSessionsForDay = (date: string): DailySession[] => {
    const sessionsForDate = (dailySessions ?? {})[date];
    return sessionsForDate ? Object.values(sessionsForDate) : [];
  }

  const getSessionById = (sessionId: string): DailySession | undefined => {
    const date = sessionId.substring(0, 10);
    const sessionsForDate = (dailySessions ?? {})[date];
    return sessionsForDate ? sessionsForDate[sessionId] : undefined;
  }

  const getRecordsForDateRange = (startDate: string, endDate: string): Record<string, DailySession[]> => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const filteredSessions: Record<string, DailySession[]> = {};

    Object.entries(dailySessions ?? {}).forEach(([date, sessionsOnDay]) => {
      try {
        if (isWithinInterval(parseISO(date), { start, end })) {
          filteredSessions[date] = Object.values(sessionsOnDay);
        }
      } catch (e) {
        console.warn(`Invalid date found in records: ${date}`);
      }
    });
    return filteredSessions;
  }

  const saveDailyReport = async (reportData: Partial<DailyReport>, reportIdToUpdate?: string) => {
    const reportId = reportIdToUpdate || Date.now().toString();

    // Find the original report to get its date and authorId
    const originalReport = reportIdToUpdate
      ? Object.values(dailyReports).flatMap(day => Object.values(day)).find(r => r.id === reportIdToUpdate)
      : undefined;

    const date = originalReport?.date || reportData.date || new Date().toISOString().split('T')[0];
    const authorId = originalReport?.authorId || authContextUser?.uid;

    if (!authorId) throw new Error("User not authenticated");

    const reportRef = ref(db, `users/${authorId}/dailyReports/${date}/${reportId}`);

    // Get existing data to merge, not overwrite
    const snapshot = await get(reportRef);
    const existingData = snapshot.val() || {};

    const fullReportData: DailyReport = {
      // Defaults from existing data or new report creation
      id: reportId,
      date: date,
      authorId: authorId,
      authorName: existingData.authorName || authContextUser?.displayName || 'Unknown',
      category: existingData.category || 'ملاحظة عامة',
      note: existingData.note || '',
      timestamp: existingData.timestamp || new Date().toISOString(),
      status: existingData.status || 'pending',
      isPinned: existingData.isPinned ?? false,
      adminNotes: existingData.adminNotes || null,
      // Apply new changes
      ...reportData,
    };

    await set(reportRef, fullReportData);

  }

  const deleteDailyReport = async (reportId: string, date: string) => {
    if (!authContextUser) throw new Error("User not authenticated");
    const reportAuthorId = dailyReports[date]?.[reportId]?.authorId || authContextUser.uid;
    const reportDbRef = ref(db, `users/${reportAuthorId}/dailyReports/${date}/${reportId}`);
    await remove(reportDbRef);
  }

  const toggleSurahStatus = (studentId: string, surahId: number) => {
    if (!authContextUser) return;

    const studentOwnerId = students.find(s => s.id === studentId)?.ownerId;
    if (!studentOwnerId || (!isSuperAdmin && !isManagement && authContextUser.uid !== studentOwnerId)) return;

    const studentProgressMap: SurahMastery = { ...(surahProgress[studentId] || {}) };
    const currentEntry = studentProgressMap[surahId] || { status: 0 };
    const currentStatus = currentEntry.status;

    const nextStatus = ((currentStatus + 1) % 3) as 0 | 1 | 2;

    const newEntry: SurahMasteryEntry = { status: nextStatus };

    // Set completion date only when moving from 0 to 1, and preserve it on subsequent promotions
    if (nextStatus > 0 && currentStatus === 0) {
      newEntry.completedAt = new Date().toISOString();
    } else if (nextStatus > 0) {
      newEntry.completedAt = currentEntry.completedAt || new Date().toISOString();
    }

    const progressRef = ref(db, `users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`);

    if (nextStatus === 0) {
      remove(progressRef).then(() => {
        const student = students.find(s => s.id === studentId);
        logActivity(
          'UPDATE_SURAH_PROGRESS',
          authContextUser.uid,
          `تم حذف حالة السورة (ID: ${surahId})`,
          studentId,
          student?.fullName || 'غير معروف',
          authContextUser.displayName || 'Unknown',
          student?.groupName || 'غير محدد',
          studentOwnerId
        );
      });
      delete studentProgressMap[surahId]; // Keep local map in sync
    } else {
      set(progressRef, newEntry).then(() => {
        const student = students.find(s => s.id === studentId);
        logActivity(
          'UPDATE_SURAH_PROGRESS',
          authContextUser.uid,
          `تحديث حالة السورة (ID: ${surahId})`,
          studentId,
          student?.fullName || 'غير معروف',
          authContextUser.displayName || 'Unknown',
          student?.groupName || 'غير محدد',
          studentOwnerId
        );
      });
      studentProgressMap[surahId] = newEntry; // Keep local map in sync
    }

    const pointsMemorized = settings.points.surah['memorized'];
    const pointsMastered = settings.points.surah['mastered'];

    if (currentStatus === 0 && nextStatus === 1) {
      toast({ title: `✅ +${pointsMemorized} نقطة`, description: 'تم إضافة نقاط للحفظ الجديد.' });
    } else if (currentStatus === 1 && nextStatus === 2) {
      toast({ title: `✅ +${pointsMastered} نقطة`, description: 'تم إضافة نقاط للإتقان.' });
    } else if (currentStatus === 2 && nextStatus === 0) {
      toast({ title: `🔄 -${pointsMemorized + pointsMastered} نقطة`, description: 'تم خصم نقاط الحفظ والإتقان.', variant: 'destructive' });
    } else if (currentStatus === 1 && nextStatus === 0) {
      toast({ title: `🔄 -${pointsMemorized} نقطة`, description: 'تم خصم نقاط الحفظ.', variant: 'destructive' });
    } else if (currentStatus === 2 && nextStatus === 1) {
      toast({ title: `🔄 -${pointsMastered} نقطة`, description: 'تم خصم نقاط الإتقان.', variant: 'destructive' });
    }

    const surahProgressRef = ref(db, `users/${studentOwnerId}/surahProgress/${studentId}`);
    set(surahProgressRef, studentProgressMap);

    const memorizedCount = Object.values(studentProgressMap).filter(entry => entry.status > 0).length;
    updateStudent(studentId, { memorizedSurahsCount: memorizedCount }, studentOwnerId);
  }

  const addPayment = async (paymentData: Omit<Payment, 'id'>) => {
    if (!authContextUser) throw new Error("User not authenticated");

    // Find the student's owner
    const studentOwnerId = students.find(s => s.id === paymentData.studentId)?.ownerId;
    if (!studentOwnerId) throw new Error("Student not found");

    // Allow if user is the owner, or if user is management/super_admin
    if (!isSuperAdmin && !isManagement && authContextUser.uid !== studentOwnerId) {
      throw new Error("Not authorized to add payment for this student");
    }

    const paymentId = uuidv4();
    const newPayment: Payment = {
      ...paymentData,
      id: paymentId,
    };
    const paymentRef = ref(db, `users/${studentOwnerId}/payments/${paymentId}`);
    await set(paymentRef, newPayment);
  };

  const updatePaymentStatus = async (paymentId: string, status: PaymentStatus, amount: number) => {
    if (!authContextUser) throw new Error("User not authenticated");

    // Find the payment to get its owner
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) throw new Error("Payment not found");

    const student = students.find(s => s.id === payment.studentId);
    if (!student) throw new Error("Student not found");

    // Allow if user is the owner, or if user is management/super_admin
    if (!isSuperAdmin && !isManagement && authContextUser.uid !== student.ownerId) {
      throw new Error("Not authorized to update this payment");
    }

    const paymentRef = ref(db, `users/${student.ownerId}/payments/${paymentId}`);
    await update(paymentRef, { status, amount });
  }

  const saveSettings = async (newSettings: AppSettings) => {
    if (!authContextUser) throw new Error("User not authenticated");
    const settingsRef = ref(db, `users/${authContextUser.uid}/settings`);
    await set(settingsRef, newSettings);
  };

  const generateDemoData = async () => {
    if (!isManagement && !isSuperAdmin) return;

    setLoading(true);
    try {
      const demoSheikhs = [
        { name: "الشيخ زياد درويش", group: "فوج 1", email: "admin1@gmail.com" },
        { name: "الشيخ عبد الحميد", group: "فوج 2", email: "admin2@gmail.com" },
        { name: "الشيخ فؤاد بن عمر", group: "فوج 3", email: "admin3@gmail.com" },
        { name: "الشيخ أحمد بن عمر", group: "فوج 4", email: "admin4@gmail.com" },
        { name: "الشيخ إبراهيم مراد", group: "فوج 5", email: "admin5@gmail.com" },
        { name: "الشيخ سفيان نصيرة", group: "فوج 6", email: "admin6@gmail.com" },
        { name: "الشيخ محمد منصور", group: "فوج 7", email: "admin7@gmail.com" },
        { name: "الشيخ عبد الحق نصيرة", group: "فوج 8", email: "admin8@gmail.com" },
        { name: "الشيخ صهيب نصيب", group: "فوج 9", email: "admin9@gmail.com" },
      ];

      const updates: any = {};

      demoSheikhs.forEach((sheikh, index) => {
        const fakeUid = `demo_sheikh_${index + 1}`;

        // 1. Create Profile
        updates[`users/${fakeUid}/profile`] = {
          displayName: sheikh.name,
          email: sheikh.email,
          group: sheikh.group,
          role: 'sheikh',
          joinDate: new Date().toISOString(),
          isDemo: true
        };

        // 2. Create Dummy Students for each Sheikh (3 students each)
        for (let i = 1; i <= 3; i++) {
          const studentId = uuidv4();
          updates[`users/${fakeUid}/students/${studentId}`] = {
            id: studentId,
            fullName: `طالب ${i} - ${sheikh.group}`,
            birthDate: new Date(2010, 0, 1).toISOString(),
            registrationDate: new Date().toISOString(),
            status: 'نشط',
            educationalLevel: 'متوسط',
            subscriptionTier: 'فئة الأصاغر',
            ownerId: fakeUid,
            groupName: sheikh.group,
            memorizedSurahsCount: Math.floor(Math.random() * 10),
            updatedAt: new Date().toISOString(),
            photoURL: ''
          };
        }
      });

      await update(ref(db), updates);
      toast({
        title: "✅ تمت تهيئة البيانات",
        description: "تم إنشاء بيانات تجريبية للمشايخ والطلاب بنجاح."
      });
    } catch (error: any) {
      console.error("Error generating demo data:", error);
      toast({
        title: "❌ خطأ",
        description: "حدث خطأ أثناء إنشاء البيانات التجريبية.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextTicketNumber = async (): Promise<number> => {
    if (!authContextUser) return 0;

    const ownerId = authContextUser.uid;
    const ticketCounterRef = ref(db, `users/${ownerId}/settings/lastTicketNumber`);

    try {
      // Get current value
      const snapshot = await get(ticketCounterRef);
      const currentNumber = snapshot.exists() ? snapshot.val() : 0;
      const nextNumber = currentNumber + 1;

      // Update with new value
      await set(ticketCounterRef, nextNumber);

      return nextNumber;
    } catch (error) {
      console.error("Error getting next ticket number:", error);
      // Fallback to timestamp-based number if Firebase fails
      return Date.now() % 1000000;
    }
  };

  const saveAdminLog = async (logData: Omit<AdminLog, 'id' | 'timestamp'>): Promise<void> => {
    if (!authContextUser) return;
    const logId = uuidv4();
    const log: AdminLog = {
      ...logData,
      id: logId,
      timestamp: new Date().toISOString()
    };

    const ownerId = (isSuperAdmin || isManagement) ? logData.details.ownerId || authContextUser.uid : authContextUser.uid;
    const logRef = ref(db, `users/${ownerId}/admin_logs/${logId}`);

    await set(logRef, log);

    // Sync with public report if it exists
    try {
      const publicReportRef = ref(db, `public_student_reports/${logData.studentId}`);
      const publicReportSnap = await get(publicReportRef);
      if (publicReportSnap.exists()) {
        const publicAdminLogsRef = ref(db, `public_student_reports/${logData.studentId}/adminLogs/${logId}`);
        await set(publicAdminLogsRef, log);
      }
    } catch (error) {
      console.error("Error syncing with public report:", error);
    }

    toast({
      title: "✅ تم الحفظ والطباعة",
      description: `تم تسجيل الوصل في النظام بنجاح.`,
    });
  };

  const deleteAdminLog = async (log: AdminLog) => {
    if (!authContextUser) return;

    try {
      // 1. Delete from student history (personal logs of the creator)
      const ownerId = log.details?.ownerId || authContextUser.uid;
      const logRef = ref(db, `users/${ownerId}/admin_logs/${log.id}`);
      await remove(logRef);

      // 2. Delete from public reports if syncing
      const publicLogRef = ref(db, `public_student_reports/${log.studentId}/adminLogs/${log.id}`);
      await remove(publicLogRef);

      toast({
        title: "🗑️ تم الحذف",
        description: "تم حذف الوصل من السجلات بنجاح.",
      });
    } catch (error) {
      console.error("Error deleting admin log:", error);
      toast({
        title: "❌ خطأ في الحذف",
        description: "حدث خطأ أثناء محاولة حذف الوصل.",
        variant: "destructive"
      });
    }
  };

  const shareStudentRecord = async (studentId: string, historyData: any) => {
    try {
      const shareRef = ref(db, `public_student_reports/${studentId}`);

      // Also fetch and include admin logs for this student
      const studentAdminLogs = (adminLogs || []).filter(log => log.studentId === studentId);

      const sanitizedHistory = sanitizeData(historyData);
      await set(shareRef, {
        ...sanitizedHistory,
        adminLogs: studentAdminLogs.reduce((acc: any, log) => {
          acc[log.id] = log;
          return acc;
        }, {}),
        sharedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error sharing student record:", error);
      throw error;
    }
  };

  return (
    <StudentContext.Provider value={{
      students, preRegistrations, allUsers, dailySessions, dailyReports, loading, surahProgress, payments, settings, hallOfFame,
      addStudent, updateStudent, deleteStudent, deleteAllStudents, deleteMultipleStudents,
      addDailySession, deleteDailySession, getSessionsForDay, getSessionById, getRecordsForDateRange,
      importStudents, importPreRegistrations, updatePreRegistration, bulkUpdatePreRegistrations, deleteAllPreRegistrations, deleteMultiplePreRegistrations,
      saveDailyReport, deleteDailyReport, toggleSurahStatus, addPayment, updatePaymentStatus, saveSettings, generateDemoData,
      shareStudentRecord,
      saveAdminLog,
      deleteAdminLog,
      getNextTicketNumber,
      adminLogs,
    }}>
      {children}
    </StudentContext.Provider>
  );
};

export const useStudentContext = () => {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error('useStudentContext must be used within a StudentProvider');
  }
  return context;
};


