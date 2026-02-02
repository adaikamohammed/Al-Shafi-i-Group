

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import type { Student, DailySession, DailyReport, Payment, AppSettings, SurahMastery, PointsConfig, Reward, BadgeConfig, DailyRecord, Covenant, PreRegistration, AppUser, PaymentStatus, SurahMasteryEntry, AdminLog, ActivityLog, Meeting, MeetingSuggestion, InternalNotification } from '@/lib/types';
import { isWithinInterval, parseISO, isValid, isAfter, subDays } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '@/lib/firebase';
import { ref, set, push, onValue, off, remove, DatabaseReference, update, get } from 'firebase/database';
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
  activityLogs: ActivityLog[];
  meetings: Meeting[];
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'> & { photoFile?: File | null, ownerId: string, groupName: string }) => Promise<void>;
  updateStudent: (studentId: string, updatedData: Partial<Student> & { photoFile?: File | null }, ownerId: string) => Promise<void>;
  deleteStudent: (studentId: string, ownerId: string) => void;
  deleteAllStudents: () => void;
  deleteMultipleStudents: (studentsToDelete: { id: string, ownerId: string }[]) => void;
  addDailySession: (session: DailySession) => Promise<void>;
  deleteDailySession: (sessionId: string, date?: string) => void;
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
  bulkUpdateSurahStatus: (studentIds: string[], surahIds: number[], targetStatus: 0 | 1 | 2) => Promise<void>;
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  updatePaymentStatus: (paymentId: string, status: PaymentStatus, amount: number) => Promise<void>;
  saveSettings: (newSettings: AppSettings) => Promise<void>;
  generateDemoData: () => Promise<void>;
  shareStudentRecord: (studentId: string, historyData: any) => Promise<void>;
  saveAdminLog: (log: Omit<AdminLog, 'id' | 'timestamp'>) => Promise<void>;
  deleteAdminLog: (log: AdminLog) => Promise<void>;
  getNextTicketNumber: () => Promise<number>;
  transferStudent: (studentId: string, currentOwnerId: string, targetSheikhId: string, reason: string) => Promise<void>;
  bulkUpdateStudents: (updates: Record<string, Partial<Student>>) => Promise<void>;
  saveMeeting: (meetingData: Partial<Meeting>, meetingIdToUpdate?: string) => Promise<void>;
  deleteMeeting: (meetingId: string) => Promise<void>;
  deleteMeetingSuggestion: (meetingId: string, suggestionId: string) => Promise<void>;
  addMeetingSuggestion: (meetingId: string, suggestion: any) => Promise<void>;
  internalNotifications: InternalNotification[];
  addInternalNotification: (recipientId: string, title: string, message: string, type: InternalNotification['type'], metadata?: any) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
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
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [internalNotifications, setInternalNotifications] = useState<InternalNotification[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 StudentContext useEffect triggered');
    console.log('Auth loading:', authLoading);
    console.log('User:', authContextUser?.email);
    console.log('Role:', role);
    console.log('isSuperAdmin:', isSuperAdmin);
    console.log('isManagement:', isManagement);

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!authContextUser) {
      console.log('❌ No authenticated user - resetting data');
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
      setActivityLogs([]);
      setMeetings([]);
      setInternalNotifications([]);
      return;
    }

    console.log('✅ User authenticated, setting up listeners...');
    setLoading(true);
    let notificationsRef: any = null;
    let notificationsListener: any = null;
    let allUsersRef: any = null;
    let allUsersListener: any = null;
    let preRegsRef: any = null;
    let preRegsListener: any = null;
    let globalLogsRef: any = null;
    let globalLogsListener: any = null;
    let meetingsRef: any = null;
    let meetingsListener: any = null;
    let dataRef: any = null;
    let dataListener: any = null;

    let accumulatedUserLogs: Record<string, ActivityLog> = {};
    let accumulatedGlobalLogs: Record<string, ActivityLog> = {};

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

    if (isSuperAdmin || isManagement) {
      console.log('👑 Management/SuperAdmin mode activated');
      const mergeAndSetLogs = () => {
        const merged = { ...accumulatedUserLogs, ...accumulatedGlobalLogs };
        const logsArray = Object.values(merged).sort((a, b) => {
          const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
          const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
          return timeB - timeA;
        });
        setActivityLogs(logsArray);
      };


      // 1. All Users Listener (available to all for transfer dialog)
      allUsersRef = ref(db, 'users');
      allUsersListener = onValue(allUsersRef, (snapshot: any) => {
        const usersData = snapshot.val();
        const usersArray = usersData ? Object.entries(usersData).map(([uid, data]: [string, any]) => ({
          uid,
          ...data.profile
        })) : [];
        setAllUsers(usersArray);

        if (!usersData) {
          if (isSuperAdmin || isManagement) setLoading(false);
          return;
        }

        // If management/admin, aggregate data from all users
        if (isSuperAdmin || isManagement) {
          console.log('🔍 Management/Admin view - Aggregating data from all users');
          console.log('Total users found:', Object.keys(usersData).length);

          let allStudents: Student[] = [];
          let allSessions: Record<string, Record<string, DailySession>> = {};
          let allReports: { [date: string]: { [reportId: string]: DailyReport } } = {};
          let allProgress: Record<string, SurahMastery> = {};
          let allPayments: Payment[] = [];
          let allAdminLogs: AdminLog[] = [];
          let finalSettings: AppSettings = DEFAULT_SETTINGS;

          if (usersData[authContextUser.uid]?.settings) {
            finalSettings = { ...DEFAULT_SETTINGS, ...usersData[authContextUser.uid].settings };
          }

          accumulatedUserLogs = {};
          for (const uid in usersData) {
            const userData = usersData[uid];

            // Log each user's data
            if (userData.students) {
              const studentCount = Object.keys(userData.students).length;
              console.log(`📚 User ${userData.profile?.displayName || uid}: ${studentCount} students`);

              const userStudents = Object.entries(userData.students).map(([id, s]: [string, any]) =>
                processStudentData({ ...s, id }, uid, userData.profile?.group)
              );
              allStudents.push(...userStudents);
            } else {
              console.log(`📭 User ${userData.profile?.displayName || uid}: No students`);
            }

            if (userData.dailySessions) {
              const userSessionCount = Object.keys(userData.dailySessions).length;
              console.log(`  📅 User ${userData.profile?.displayName || uid} has ${userSessionCount} date(s) with sessions`);

              for (const date in userData.dailySessions) {
                if (!allSessions[date]) allSessions[date] = {};
                const sessionsOnDate = Object.keys(userData.dailySessions[date]).length;
                console.log(`    - ${date}: ${sessionsOnDate} session(s)`);

                Object.entries(userData.dailySessions[date]).forEach(([sessionId, session]: [string, any]) => {
                  // Use a unique key to prevent collisions between different sheikhs' sessions
                  const uniqueKey = `${uid}_${sessionId}`;
                  allSessions[date][uniqueKey] = { ...session, ownerId: uid };
                });
              }
            } else {
              console.log(`  📅 User ${userData.profile?.displayName || uid} has NO sessions`);
            }
            if (userData.dailyReports) {
              for (const date in userData.dailyReports) {
                if (!allReports[date]) allReports[date] = {};
                Object.entries(userData.dailyReports[date]).forEach(([reportId, report]: [string, any]) => {
                  const uniqueKey = `${uid}_${reportId}`;
                  allReports[date][uniqueKey] = { ...report, id: reportId, authorId: uid };
                });
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
            if (userData.activity_logs) {
              Object.entries(userData.activity_logs).forEach(([id, l]) => {
                accumulatedUserLogs[id] = { id, ...(l as any) };
              });
            }
          }

          console.log('✅ Total students aggregated:', allStudents.length);
          console.log('✅ Total sessions aggregated:', Object.keys(allSessions).length);

          // 🔍 DIAGNOSTIC: Log session details for debugging
          console.log('📊 Session Details by Date:');
          Object.entries(allSessions).forEach(([date, sessions]) => {
            const sessionCount = Object.keys(sessions).length;
            const owners = [...new Set(Object.values(sessions).map((s: any) => s.ownerId))];
            console.log(`  ${date}: ${sessionCount} session(s), owners: ${owners.join(', ')}`);
          });

          setStudents(allStudents);
          setDailySessions(allSessions);
          setDailyReports(allReports);
          setSurahProgress(allProgress);
          setPayments(allPayments);
          setAdminLogs(allAdminLogs);
          setSettingsState(finalSettings);
          mergeAndSetLogs();
          setLoading(false);
        }
      }, (error: any) => {
        console.error(`Firebase read failed for user list: ${error.message}`);
        console.error('Error code:', error.code);
        console.error('Full error:', error);

        // Check if it's a permission error
        if (error.code === 'PERMISSION_DENIED') {
          console.warn('⚠️ PERMISSION DENIED - Database rules may not be updated correctly');
          toast({
            title: "خطأ في الصلاحيات",
            description: "يرجى التحقق من قواعد Firebase Database في Console.",
            variant: "destructive"
          });
        }

        if (isSuperAdmin || isManagement) setLoading(false);
      });

      // 2. Pre-registrations
      preRegsRef = ref(db, 'pre_registrations');
      preRegsListener = onValue(preRegsRef, (snapshot: any) => {
        const data = snapshot.val();
        const preRegsArray: PreRegistration[] = data ? Object.entries(data).map(([id, r]) => processPreRegData({ id, ...(r as any) })) : [];
        setPreRegistrations(preRegsArray);
      });

      // 3. Global Activity Logs
      globalLogsRef = ref(db, 'activity_logs');
      globalLogsListener = onValue(globalLogsRef, (snapshot: any) => {
        if (snapshot.exists()) {
          accumulatedGlobalLogs = {};
          Object.entries(snapshot.val()).forEach(([id, l]) => {
            accumulatedGlobalLogs[id] = { id, ...(l as any) };
          });
          mergeAndSetLogs();
        }
      });
    } else {
      // Sheikh (Personal) View
      setLoading(true);
      const userPath = `users/${authContextUser.uid}`;

      const studentsRef = ref(db, `${userPath}/students`);
      const sessionsRef = ref(db, `${userPath}/dailySessions`);
      const reportsRef = ref(db, `${userPath}/dailyReports`);
      const progressRef = ref(db, `${userPath}/surahProgress`);
      const paymentsRef = ref(db, `${userPath}/payments`);
      const adminLogsRef = ref(db, `${userPath}/admin_logs`);
      const activityLogsRef = ref(db, `${userPath}/activity_logs`);
      const settingsRef = ref(db, `${userPath}/settings`);
      const profileRef = ref(db, `${userPath}/profile`);

      const handleError = (error: any) => {
        console.error(`Firebase granular read failed for user (UID: ${authContextUser.uid}, Role: ${role}): ${error.message}`);
        if (error.code === 'PERMISSION_DENIED') {
          toast({
            title: "خطأ في الصلاحيات",
            description: "يرجى تسجيل الخروج والدخول مرة أخرى.",
            variant: "destructive"
          });
        }
        setLoading(false);
      };

      onValue(studentsRef, (s) => {
        const val = s.val();
        setStudents(val ? Object.entries(val).map(([id, st]: [string, any]) =>
          processStudentData({ ...st, id }, authContextUser.uid, role === 'sheikh' ? authContextUser.group : st.groupName)
        ) : []);
      }, handleError);

      onValue(sessionsRef, (s) => setDailySessions(s.val() || {}), handleError);
      onValue(reportsRef, (s) => setDailyReports(s.val() || {}), handleError);
      onValue(progressRef, (s) => setSurahProgress(s.val() || {}), handleError);
      onValue(paymentsRef, (s) => {
        const val = s.val();
        setPayments(val ? Object.entries(val).map(([id, p]) => ({ id, ...(p as Omit<Payment, 'id'>) })) : []);
      }, handleError);
      onValue(adminLogsRef, (s) => {
        const val = s.val();
        setAdminLogs(val ? Object.entries(val).map(([id, l]) => ({ id, ...(l as Omit<AdminLog, 'id'>) })) : []);
      }, handleError);
      onValue(activityLogsRef, (s) => {
        const val = s.val();
        setActivityLogs(val ? Object.entries(val).map(([id, l]) => ({ id, ...(l as any) })) : []);
      }, handleError);
      onValue(settingsRef, (s) => setSettingsState(s.val() ? { ...DEFAULT_SETTINGS, ...s.val() } : DEFAULT_SETTINGS), handleError);

      // Also listen to profile to keep role/group synced if they change
      onValue(profileRef, () => setLoading(false), handleError);
    }

    // Common Listeners for all authenticated users
    meetingsRef = ref(db, 'meetings');
    meetingsListener = onValue(meetingsRef, (snapshot: any) => {
      const data = snapshot.val();
      const meetingsArray = data ? Object.entries(data).map(([id, m]: [string, any]) => ({
        id,
        ...m,
        attendance: m.attendance || {},
        topics: m.topics || [],
        suggestions: m.suggestions ? Object.entries(m.suggestions).map(([sid, s]: [string, any]) => ({ id: sid, ...s })) : []
      })) : [];
      setMeetings(meetingsArray);
    });

    // 6. Internal Notifications Listener
    notificationsRef = ref(db, `users/${authContextUser.uid}/notifications`);
    notificationsListener = onValue(notificationsRef, (snapshot: any) => {
      const data = snapshot.val();
      const notificationsArray = data ? Object.entries(data).map(([id, n]: [string, any]) => ({
        id,
        ...n
      })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
      setInternalNotifications(notificationsArray);
    });

    return () => {
      if (allUsersRef && allUsersListener) off(allUsersRef, 'value', allUsersListener);
      if (preRegsRef && preRegsListener) off(preRegsRef, 'value', preRegsListener);
      if (globalLogsRef && globalLogsListener) off(globalLogsRef, 'value', globalLogsListener);
      if (dataRef && dataListener) off(dataRef, 'value', dataListener);
      if (meetingsRef && meetingsListener) off(meetingsRef, 'value', meetingsListener);
      if (notificationsRef && notificationsListener) off(notificationsRef, 'value', notificationsListener);
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
    let maxStreak = 0; let king: any = undefined;
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
    let maxStreak = 0; let king: any = undefined;
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
    let guardian: Student | undefined | null = undefined;

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
    const studentOp = set(studentRef, sanitizeData({
      ...newStudent,
      birthDate: newStudent.birthDate ? newStudent.birthDate.toISOString() : null,
      registrationDate: newStudent.registrationDate.toISOString(),
      updatedAt: newStudent.updatedAt.toISOString(),
      covenants: newStudent.covenants || null // Use null for empty array
    }));

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
      photoURL: finalPhotoURL === undefined ? undefined : finalPhotoURL as any,
      birthDate: (data.birthDate instanceof Date ? data.birthDate.toISOString() : (data.birthDate || undefined)) as any,
      requestedAt: (data.requestedAt instanceof Date ? data.requestedAt.toISOString() : (data.requestedAt || undefined)) as any,
    };

    if (!isEditing) {
      finalData.status = 'مرشح';
    }

    const sanitizedData = sanitizeData(finalData);
    const regRef = ref(db, `pre_registrations/${regId}`);
    await update(regRef, sanitizedData);

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

      updates[`/pre_registrations/${id}`] = sanitizeData(regToSave);
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
      updates[`/pre_registrations/${regId}`] = sanitizeData({
        ...reg,
        requestedAt: reg.requestedAt instanceof Date ? reg.requestedAt.toISOString() : reg.requestedAt,
        birthDate: reg.birthDate instanceof Date ? reg.birthDate.toISOString() : reg.birthDate,
      });
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
      await set(sessionRef, sanitizeData(session));

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

  const deleteDailySession = (sessionId: string, date?: string) => {
    if (!authContextUser || isSuperAdmin || !sessionId) return;

    // استخدام التاريخ الممرر أو استخراجه من الـ ID كخيار احتياطي
    const targetDate = date || sessionId.substring(0, 10);

    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${targetDate}/${sessionId}`);
    const sessionToDelete = dailySessions[targetDate]?.[sessionId];

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
    if (!sessionsForDate) return [];

    // Ensure id is present in each session object
    return Object.entries(sessionsForDate).map(([id, session]) => ({
      ...session,
      id: session.id || id
    }));
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

  const bulkUpdateSurahStatus = async (studentIds: string[], surahIds: number[], targetStatus: 0 | 1 | 2) => {
    if (!authContextUser) return;

    const updates: { [key: string]: any } = {};
    const timestamp = new Date().toISOString();

    studentIds.forEach(studentId => {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      const studentOwnerId = student.ownerId;
      if (!isSuperAdmin && !isManagement && authContextUser.uid !== studentOwnerId) return;

      const studentProgressMap = { ...(surahProgress[studentId] || {}) };
      let changed = false;

      surahIds.forEach(surahId => {
        const currentEntry = studentProgressMap[surahId] || { status: 0 };
        const currentStatus = currentEntry.status;

        if (currentStatus === targetStatus) return;
        changed = true;

        const newEntry: SurahMasteryEntry = { status: targetStatus };
        if (targetStatus > 0 && currentStatus === 0) {
          newEntry.completedAt = timestamp;
        } else if (targetStatus > 0) {
          newEntry.completedAt = currentEntry.completedAt || timestamp;
        }

        if (targetStatus === 0) {
          updates[`users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`] = null;
          delete studentProgressMap[surahId];
        } else {
          updates[`users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`] = newEntry;
          studentProgressMap[surahId] = newEntry;
        }
      });

      if (changed) {
        const newMemorizedCount = Object.values(studentProgressMap).filter(entry => entry.status > 0).length;
        updates[`users/${studentOwnerId}/students/${studentId}/memorizedSurahsCount`] = newMemorizedCount;
        updates[`users/${studentOwnerId}/students/${studentId}/updatedAt`] = timestamp;

        logActivity(
          'UPDATE_SURAH_PROGRESS',
          authContextUser.uid,
          `تحديث جماعي للسور (${surahIds.length} سورة) إلى حالة: ${targetStatus === 0 ? 'غير محفوظة' : targetStatus === 1 ? 'محفوظة' : 'متقنة'}`,
          studentId,
          student.fullName,
          authContextUser.displayName || 'Unknown',
          student.groupName,
          studentOwnerId
        );
      }
    });

    if (Object.keys(updates).length > 0) {
      const dbRef = ref(db);
      await update(dbRef, sanitizeData(updates));
      toast({
        title: "✅ تم التحديث الجماعي",
        description: `تم تحديث ${surahIds.length} سورة لـ ${studentIds.length} طلاب بنجاح.`,
      });
    }
  };

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
        { name: "الأستاذة سعيدة", group: "فوج 10", email: "admin10@gmail.com" },
        { name: "الأستاذة سميرة", group: "فوج 11", email: "admin11@gmail.com" },
        { name: "الأستاذة رقية", group: "فوج 12", email: "admin12@gmail.com" },
        { name: "الأستاذة ثريا", group: "فوج 13", email: "admin13@gmail.com" },
        { name: "الأستاذة أميرة", group: "فوج 14", email: "admin14@gmail.com" },
        { name: "الأستاذة زينب", group: "فوج 15", email: "admin15@gmail.com" },
        { name: "الأستاذة جهاد", group: "فوج 16", email: "admin16@gmail.com" },
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

  const transferStudent = async (studentId: string, currentOwnerId: string, targetSheikhId: string, reason: string): Promise<void> => {
    if (!authContextUser) return;

    try {
      const student = students.find(s => s.id === studentId);
      const targetSheikh = allUsers.find(u => u.uid === targetSheikhId);

      if (!student || !targetSheikh) {
        throw new Error('الطالب أو الشيخ المستهدف غير موجود');
      }

      const fromGroupName = student.groupName || 'غير محدد';
      const toGroupName = targetSheikh.group || 'فوج غير محدد';
      const fromSheikhName = allUsers.find(u => u.uid === currentOwnerId)?.displayName || 'غير معروف';
      const toSheikhName = targetSheikh.displayName || 'غير معروف';

      const transferRecord = {
        date: new Date().toISOString(),
        fromSheikhId: currentOwnerId,
        fromSheikhName: fromSheikhName,
        fromGroupName: fromGroupName,
        toSheikhId: targetSheikhId,
        toSheikhName: toSheikhName,
        toGroupName: toGroupName,
        reason: reason
      };

      const updatedTransferHistory = [...(student.transferHistory || []), transferRecord];

      // Prepare updates for atomic move
      const updates: any = {};

      // 1. Remove from current path
      updates[`users/${currentOwnerId}/students/${studentId}`] = null;

      // 2. Add to target path
      const sanitizedStudent = sanitizeData({
        ...student,
        ownerId: targetSheikhId,
        groupName: toGroupName,
        transferHistory: updatedTransferHistory,
        updatedAt: new Date()
      });

      updates[`users/${targetSheikhId}/students/${studentId}`] = {
        ...sanitizedStudent,
        birthDate: sanitizedStudent.birthDate ? sanitizedStudent.birthDate.toISOString() : null,
        registrationDate: sanitizedStudent.registrationDate.toISOString(),
        updatedAt: sanitizedStudent.updatedAt.toISOString(),
      };

      // 3. Move Surah Progress if exists
      if (surahProgress[studentId]) {
        updates[`users/${currentOwnerId}/surahProgress/${studentId}`] = null;
        updates[`users/${targetSheikhId}/surahProgress/${studentId}`] = surahProgress[studentId];
      }

      // 4. Move Historical Daily Sessions
      Object.entries(dailySessions).forEach(([date, sessionsMap]) => {
        Object.entries(sessionsMap).forEach(([sessionId, session]) => {
          const records = session.records || [];
          const recordIndex = records.findIndex(r => r.studentId === studentId);

          if (recordIndex !== -1 && session.ownerId === currentOwnerId) {
            const studentRecord = records[recordIndex];

            // Remove record from old session
            const updatedOldRecords = [...records];
            updatedOldRecords.splice(recordIndex, 1);
            updates[`users/${currentOwnerId}/dailySessions/${date}/${sessionId}/records`] = updatedOldRecords;

            // Create a specific session entry for this student in the new owner's path
            const transferSessionId = `tr_${studentId}_${sessionId}`;
            updates[`users/${targetSheikhId}/dailySessions/${date}/${transferSessionId}`] = {
              ...session,
              id: transferSessionId,
              records: [studentRecord],
              isTransferred: true,
              transferredFrom: currentOwnerId,
              originalSessionId: sessionId,
              transferReason: reason
            };
          }
        });
      });

      // 5. Move Payment History
      payments.filter(p => p.studentId === studentId).forEach(payment => {
        updates[`users/${currentOwnerId}/payments/${payment.id}`] = null;
        updates[`users/${targetSheikhId}/payments/${payment.id}`] = {
          ...payment,
          transferred: true,
          transferredAt: new Date().toISOString()
        };
      });

      // 6. Move Admin Logs (Receipts, Summons, etc.)
      const studentAdminLogs = (adminLogs || []).filter(l => l.studentId === studentId);
      studentAdminLogs.forEach(log => {
        updates[`users/${currentOwnerId}/admin_logs/${log.id}`] = null;
        updates[`users/${targetSheikhId}/admin_logs/${log.id}`] = {
          ...log,
          sheikhName: targetSheikh.displayName || log.sheikhName,
          groupName: toGroupName,
          details: {
            ...(log.details || {}),
            ownerId: targetSheikhId,
            wasTransferred: true,
            transferredFrom: currentOwnerId,
            transferredAt: new Date().toISOString()
          }
        };
      });

      // 7. Move Daily Reports
      Object.keys(dailyReports).forEach(date => {
        Object.values(dailyReports[date]).forEach(report => {
          if (report.note.includes(student.fullName) || (report as any).studentId === studentId) {
            updates[`users/${currentOwnerId}/dailyReports/${date}/${report.id}`] = null;
            updates[`users/${targetSheikhId}/dailyReports/${date}/${report.id}`] = {
              ...report,
              authorId: targetSheikhId,
              isTransferred: true
            };
          }
        });
      });

      await update(ref(db), sanitizeData(updates));

      toast({
        title: "✅ تم نقل الطالب",
        description: `تم نقل ${student.fullName} من ${fromGroupName} إلى ${toGroupName} بنجاح.`,
      });

      // Log action
      logActivity(
        'UPDATE_STUDENT',
        authContextUser.uid,
        `تم نقل طالب: ${student.fullName} من ${fromGroupName} إلى ${toGroupName}. السبب: ${reason}`,
        studentId,
        student.fullName,
        authContextUser.displayName || 'Unknown',
        toGroupName,
        targetSheikhId
      );

    } catch (error: any) {
      console.error("Transfer error:", error);
      toast({
        title: "❌ خطأ في النقل",
        description: error.message || "حدث خطأ أثناء محاولة نقل الطالب.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const addInternalNotification = async (recipientId: string, title: string, message: string, type: InternalNotification['type'], metadata?: any) => {
    if (!authContextUser) return;
    try {
      const notificationRef = ref(db, `users/${recipientId}/notifications`);
      const newNotificationRef = push(notificationRef);
      const notification: Omit<InternalNotification, 'id'> = {
        title,
        message,
        type,
        senderId: authContextUser.uid,
        timestamp: new Date().toISOString(),
        read: false,
        metadata
      };
      await set(newNotificationRef, notification);
    } catch (error) {
      console.error("Error adding internal notification:", error);
      throw error;
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    if (!authContextUser) return;
    try {
      const notificationRef = ref(db, `users/${authContextUser.uid}/notifications/${notificationId}`);
      await update(notificationRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const bulkUpdateStudents = async (updates: Record<string, Partial<Student>>) => {
    if (!authContextUser) return;
    try {
      const fbUpdates: Record<string, any> = {};
      const timestamp = new Date().toISOString();

      Object.entries(updates).forEach(([studentId, data]) => {
        const student = students.find(s => s.id === studentId);
        if (student) {
          fbUpdates[`users/${student.ownerId}/students/${studentId}`] = sanitizeData({
            ...student,
            ...data,
            updatedAt: timestamp
          });

          logActivity(
            'UPDATE_STUDENT',
            authContextUser.uid,
            `تم تحديث بيانات الطالب: ${student.fullName} (تحديث جماعي)`,
            studentId,
            student.fullName,
            authContextUser.displayName || 'Unknown',
            student.groupName || 'Unknown',
            student.ownerId
          );
        }
      });

      await update(ref(db), sanitizeData(fbUpdates));
      toast({
        title: "✅ تم التحديث بنجاح",
        description: `تم تحديث بيانات ${Object.keys(updates).length} طالب(ة).`,
      });
    } catch (error: any) {
      console.error("Bulk update error:", error);
      toast({
        title: "❌ خطأ في التحديث",
        description: error.message || "حدث خطأ أثناء محاولة تحديث البيانات.",
        variant: "destructive"
      });
    }
  };

  return (
    <StudentContext.Provider value={{
      students,
      preRegistrations,
      allUsers,
      dailySessions,
      dailyReports,
      surahProgress,
      payments,
      settings,
      hallOfFame,
      adminLogs,
      activityLogs,
      loading,
      addStudent,
      updateStudent,
      bulkUpdateStudents,
      deleteStudent,
      deleteAllStudents,
      deleteMultipleStudents,
      addDailySession,
      deleteDailySession,
      getSessionsForDay,
      getSessionById,
      getRecordsForDateRange,
      importStudents,
      importPreRegistrations,
      updatePreRegistration,
      bulkUpdatePreRegistrations,
      deleteAllPreRegistrations,
      deleteMultiplePreRegistrations,
      saveDailyReport,
      deleteDailyReport,
      toggleSurahStatus,
      bulkUpdateSurahStatus,
      addPayment,
      updatePaymentStatus,
      saveSettings,
      generateDemoData,
      shareStudentRecord,
      saveAdminLog,
      deleteAdminLog,
      getNextTicketNumber,
      transferStudent,
      saveMeeting: async (meetingData, meetingId) => {
        if (!authContextUser || (!isSuperAdmin && !isManagement)) return;
        const id = meetingId || uuidv4();
        const meetingRef = ref(db, `meetings/${id}`);
        const dataToSave = {
          ...meetingData,
          id,
          timestamp: meetingData.timestamp || new Date().toISOString(),
          createdBy: meetingData.createdBy || authContextUser.uid,
          status: meetingData.status || 'upcoming'
        };
        await update(meetingRef, sanitizeData(dataToSave));
        toast({ title: '✅ تم حفظ الاجتماع' });
      },
      addMeetingSuggestion: async (meetingId, suggestion) => {
        if (!authContextUser) return;
        const id = uuidv4();
        const suggestionRef = ref(db, `meetings/${meetingId}/suggestions/${id}`);
        await set(suggestionRef, {
          ...suggestion,
          timestamp: new Date().toISOString()
        });
        toast({ title: '✅ تم إرسال المقترح' });
      },
      deleteMeeting: async (meetingId) => {
        if (!authContextUser || (!isSuperAdmin && !isManagement)) return;
        const meetingRef = ref(db, `meetings/${meetingId}`);
        await remove(meetingRef);
        toast({ title: '🗑️ تم حذف الاجتماع' });
      },
      deleteMeetingSuggestion: async (meetingId, suggestionId) => {
        if (!authContextUser || (!isSuperAdmin && !isManagement)) return;
        const suggestionRef = ref(db, `meetings/${meetingId}/suggestions/${suggestionId}`);
        await remove(suggestionRef);
        toast({ title: '🗑️ تم حذف المقترح' });
      },
      meetings,
      internalNotifications,
      addInternalNotification,
      markNotificationAsRead
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


