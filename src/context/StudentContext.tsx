

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import type { Student, DailySession, DailyReport, Payment, AppSettings, SurahMastery, PointsConfig, Reward, BadgeConfig, DailyRecord, Covenant, PreRegistration, AppUser, PaymentStatus, SurahMasteryEntry, AdminLog, ActivityLog, Meeting, MeetingSuggestion, InternalNotification, WeeklyOutcome, GroupSurahConfig } from '@/lib/types';
import { isWithinInterval, parseISO, isValid, isAfter, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, storage, auth } from '@/lib/firebase';
import { ref, set, push, onValue, off, remove, DatabaseReference, update, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { sanitizeData } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import { saveEncrypted, loadEncrypted } from '@/lib/cryptoStore';
import { queueOfflineMutation, isEffectiveOnline, executeWithTimeout } from '@/lib/offlineSyncEngine';

const DEFAULT_POINTS_CONFIG: PointsConfig = {
  attendance: { 'حاضر': 5, 'متأخر': 2, 'تعويض': 3.5, 'غائب': -10 },
  evaluation: { 'ممتاز': 10, 'جيد جداً': 7, 'جيد': 5, 'حسن': 3, 'مقبول': 2, 'ضعيف': 1, 'لم يحفظ': 0 },
  behavior: { 'هادئ': 3, 'مقبول': 1, 'مشاغب': 0 },
  review: { 'completed': 3 },
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
  weeklyOutcomes: Record<string, WeeklyOutcome>;
  saveWeeklyOutcome: (outcome: WeeklyOutcome) => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'> & { photoFile?: File | null, ownerId: string, groupName: string }) => Promise<void>;
  updateStudent: (studentId: string, updatedData: Partial<Student> & { photoFile?: File | null }, ownerId: string) => Promise<void>;
  deleteStudent: (studentId: string, ownerId: string) => void;
  deleteAllStudents: () => void;
  deleteMultipleStudents: (studentsToDelete: { id: string, ownerId: string }[]) => void;
  addDailySession: (session: DailySession, targetOwnerId?: string) => Promise<void>;
  deleteDailySession: (sessionId: string, date?: string, targetOwnerId?: string) => void;
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
  deleteMultipleDailyReports: (reportsToDelete: { id: string, date: string, authorId: string }[]) => Promise<void>;
  toggleSurahStatus: (studentId: string, surahId: number) => void;
  setSurahEvaluation: (studentId: string, surahId: number, evaluation: import('@/lib/types').SurahEvaluation) => Promise<void>;
  bulkUpdateSurahStatus: (studentIds: string[], surahIds: number[], targetStatus: 0 | 1 | 2) => Promise<void>;
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  updatePaymentStatus: (paymentId: string, status: PaymentStatus, amount: number) => Promise<void>;
  bulkAddOrUpdatePayments: (operations: Array<{
    studentId: string;
    paymentId?: string;
    status: PaymentStatus;
    amount: number;
    date: string;
  }>) => Promise<void>;
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
  migrateSurahDataToEvaluationSystem: () => Promise<void>;
  internalNotifications: InternalNotification[];
  addInternalNotification: (recipientId: string, title: string, message: string, type: InternalNotification['type'], metadata?: any) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  sendManagementMessage: (targetSheikhId: string, messageData: Partial<DailyReport>, alternateUids?: string[]) => Promise<void>;
  markManagementMessageAsRead: (reportId: string, date: string) => Promise<void>;
  moveDailySession: (sessionId: string, date: string, sourceOwnerId: string, targetOwnerId: string) => Promise<void>;
  restoreSessions: (sessions: DailySession[]) => Promise<void>;
  updateSheikhGroupSettings: (sheikhId: string, mode?: 'unified' | 'individual' | 'hybrid' | 'not_set', targetSurah?: GroupSurahConfig) => Promise<void>;
  selectedGroup: string;
  setSelectedGroup: (group: string) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const normalizeArabic = (text: string) => {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[آأإ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
};

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user: authContextUser, loading: authLoading, isSuperAdmin, isManagement, role } = useAuth();
  const isAdmin00 = authContextUser?.email === 'admin00@gmail.com' || authContextUser?.email === 'abdallah.shafii@gmail.com';
  // isPrivileged = يجلب بيانات كل المستخدمين — admin5 شيخ عادي يرى طلابه فقط
  const isPrivileged = isSuperAdmin || isManagement || isAdmin00;
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
  const [weeklyOutcomes, setWeeklyOutcomes] = useState<Record<string, WeeklyOutcome>>({});
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroupState] = useState<string>('sheikhs_all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedGroup');
      if (stored) {
        setSelectedGroupState(stored);
      }
    }
  }, []);

  const setSelectedGroup = (val: string) => {
    setSelectedGroupState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedGroup', val);
    }
  };

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
      setActivityLogs([]);
      setMeetings([]);
      setInternalNotifications([]);
      setWeeklyOutcomes({});
      return;
    }

    // ⚡ Local-First Cache Hydration: استرجاع فوري للبيانات المشفرة محلياً (0ms wait)
    loadEncrypted<Student[]>('students', []).then(cached => {
      if (cached && cached.length > 0) {
        setStudents(cached.map(s => ({
          ...s,
          birthDate: s.birthDate ? (s.birthDate instanceof Date ? s.birthDate : parseISO(s.birthDate as any)) : new Date(),
          registrationDate: s.registrationDate ? (s.registrationDate instanceof Date ? s.registrationDate : parseISO(s.registrationDate as any)) : new Date(),
          updatedAt: s.updatedAt ? (s.updatedAt instanceof Date ? s.updatedAt : parseISO(s.updatedAt as any)) : new Date(),
        })));
        setLoading(false);
      }
    });
    loadEncrypted<Record<string, Record<string, DailySession>>>('dailySessions', {}).then(cached => {
      if (cached && Object.keys(cached).length > 0) {
        setDailySessions(cached);
        setLoading(false);
      }
    });
    loadEncrypted<Record<string, Record<string, DailyReport>>>('dailyReports', {}).then(cached => {
      if (cached && Object.keys(cached).length > 0) setDailyReports(cached);
    });
    loadEncrypted<Record<string, SurahMastery>>('surahProgress', {}).then(cached => {
      if (cached && Object.keys(cached).length > 0) setSurahProgress(cached);
    });
    loadEncrypted<Payment[]>('payments', []).then(cached => {
      if (cached && cached.length > 0) setPayments(cached);
    });
    loadEncrypted<AdminLog[]>('adminLogs', []).then(cached => {
      if (cached && cached.length > 0) setAdminLogs(cached);
    });
    loadEncrypted<AppSettings>('settings', DEFAULT_SETTINGS).then(cached => {
      if (cached) setSettingsState(cached);
    });
    loadEncrypted<AppUser[]>('allUsers', []).then(cached => {
      if (cached && cached.length > 0) setAllUsers(cached);
    });

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

    const processStudentData = (studentData: any, uid: string, groupName?: string): Student => {
      const normalizedFullName = normalizeArabic(studentData.fullName || '');
      return {
        ...studentData,
        id: studentData.id,
        ownerId: uid,
        groupName: groupName || 'غير محدد',
        birthDate: studentData.birthDate ? parseISO(studentData.birthDate) : new Date(),
        registrationDate: studentData.registrationDate ? parseISO(studentData.registrationDate) : new Date(),
        updatedAt: studentData.updatedAt ? parseISO(studentData.updatedAt) : new Date(),
        covenants: studentData.covenants ? Object.values(studentData.covenants) : [],
        normalizedFullName,
      };
    };

    const processPreRegData = (preReg: any): PreRegistration => {
      const normalizedFullName = normalizeArabic(preReg.fullName || '');
      return {
        ...preReg,
        requestedAt: preReg.requestedAt && isValid(parseISO(preReg.requestedAt)) ? parseISO(preReg.requestedAt) : preReg.requestedAt,
        birthDate: preReg.birthDate && isValid(parseISO(preReg.birthDate)) ? parseISO(preReg.birthDate) : preReg.birthDate,
        normalizedFullName,
      };
    };

    if (isPrivileged) {
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
          ...data.profile,
          settings: data.settings
        })) : [];

        // Filter out demo sheikhs if a real user with the same email exists
        const realEmails = new Set(
          usersArray
            .filter(u => !u.uid.startsWith('demo_sheikh_') && u.email)
            .map(u => u.email.toLowerCase().trim())
        );
        const filteredUsersArray = usersArray.filter(u => {
          if (u.uid.startsWith('demo_sheikh_') && u.email) {
            return !realEmails.has(u.email.toLowerCase().trim());
          }
          return true;
        });
        setAllUsers(filteredUsersArray);

        if (!usersData) {
          if (isSuperAdmin || isManagement) setLoading(false);
          return;
        }

        // If management/admin, aggregate data from all users
        if (isPrivileged) {
          let allStudents: Student[] = [];
          let allSessions: Record<string, Record<string, DailySession>> = {};
          let allReports: { [date: string]: { [reportId: string]: DailyReport } } = {};
          let allProgress: Record<string, SurahMastery> = {};
          let allPayments: Payment[] = [];
          let allAdminLogs: AdminLog[] = [];
          let finalSettings: AppSettings = DEFAULT_SETTINGS;

          // ⚡ Performance: only keep last 120 days of sessions in memory
          const sessionCutoff = new Date();
          sessionCutoff.setDate(sessionCutoff.getDate() - 120);
          const SESSION_CUTOFF_DATE = sessionCutoff.toISOString().split('T')[0]; // 'YYYY-MM-DD'

          const mergeSettings = (val: any): AppSettings => {
            if (!val) return DEFAULT_SETTINGS;
            const pts = val.points || {};
            const att = pts.attendance || {};
            const rev = pts.review || {};
            
            // Force 'تعويض' to 3.5 if it is 1.5 or missing
            const finalMakeup = (att['تعويض'] === 1.5 || !att['تعويض']) ? 3.5 : Number(att['تعويض']);
            // Force 'completed' review to 3 if it is 1 or 5 or missing
            const finalReview = (rev['completed'] === 1 || rev['completed'] === 5 || !rev['completed']) ? 3 : Number(rev['completed']);

            return {
              ...DEFAULT_SETTINGS,
              ...val,
              points: {
                ...DEFAULT_SETTINGS.points,
                ...pts,
                attendance: { ...DEFAULT_SETTINGS.points.attendance, ...att, 'تعويض': finalMakeup },
                evaluation: { ...DEFAULT_SETTINGS.points.evaluation, ...(pts.evaluation || {}) },
                behavior: { ...DEFAULT_SETTINGS.points.behavior, ...(pts.behavior || {}) },
                review: { ...DEFAULT_SETTINGS.points.review, ...rev, 'completed': finalReview },
                surah: { ...DEFAULT_SETTINGS.points.surah, ...(pts.surah || {}) },
              }
            };
          };

          if (usersData[authContextUser.uid]?.settings) {
            finalSettings = mergeSettings(usersData[authContextUser.uid].settings);
          }

          accumulatedUserLogs = {};
          for (const uid in usersData) {
            const userData = usersData[uid];

            // Skip demo sheikhs if they have been migrated to a real user UID
            if (uid.startsWith('demo_sheikh_') && userData.profile?.email) {
              const emailKey = userData.profile.email.toLowerCase().trim();
              if (realEmails.has(emailKey)) {
                continue;
              }
            }

            // Log each user's data
            if (userData.students) {
              const userStudents = Object.entries(userData.students).map(([id, s]: [string, any]) =>
                processStudentData({ ...s, id }, uid, userData.profile?.group)
              );
              allStudents.push(...userStudents);
            }

            if (userData.dailySessions) {
              for (const date in userData.dailySessions) {
                // ⚡ Performance: skip sessions older than 120 days
                if (date < SESSION_CUTOFF_DATE) continue;
                if (!allSessions[date]) allSessions[date] = {};
                const dayVal = userData.dailySessions[date];
                if (dayVal && typeof dayVal === 'object') {
                  if ('date' in dayVal && ('records' in dayVal || 'sessionType' in dayVal)) {
                    // Old structure: single session object directly under the date key
                    const sessionId = dayVal.id || `${date}-s1`;
                    const uniqueKey = `${uid}_${sessionId}`;
                    allSessions[date][uniqueKey] = {
                      ...dayVal,
                      id: sessionId,
                      sessionNumber: dayVal.sessionNumber !== undefined ? Number(dayVal.sessionNumber) : 1,
                      ownerId: uid
                    };
                  } else {
                    // New structure: dictionary of session objects
                    Object.entries(dayVal).forEach(([sessionId, session]: [string, any]) => {
                      if (session && typeof session === 'object' && 'date' in session) {
                        const uniqueKey = `${uid}_${sessionId}`;
                        allSessions[date][uniqueKey] = {
                          ...session,
                          id: session.id || sessionId,
                          sessionNumber: session.sessionNumber !== undefined ? Number(session.sessionNumber) : (sessionId.endsWith('-s2') ? 2 : 1),
                          ownerId: uid
                        };
                      }
                    });
                  }
                }
              }
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

          setStudents(allStudents);
          setDailySessions(allSessions);
          setDailyReports(allReports);
          setSurahProgress(allProgress);
          setPayments(allPayments);
          setAdminLogs(allAdminLogs);
          setSettingsState(finalSettings);
          mergeAndSetLogs();
          setLoading(false);

          // ⚡ حفظ مشفر محلياً للأوفلاين
          saveEncrypted('students', allStudents);
          saveEncrypted('dailySessions', allSessions);
          saveEncrypted('dailyReports', allReports);
          saveEncrypted('surahProgress', allProgress);
          saveEncrypted('payments', allPayments);
          saveEncrypted('adminLogs', allAdminLogs);
          saveEncrypted('settings', finalSettings);
        }
      }, (error: any) => {
        // Silently handle permission errors (expected during logout/role transitions)
        if (error.code === 'PERMISSION_DENIED') {
          console.warn('allUsers: permission denied (expected during auth transitions)');
        } else {
          console.warn(`Firebase allUsers read failed: ${error.message}`);
        }
        if (isPrivileged) setLoading(false);
      });


      // 2. Pre-registrations
      preRegsRef = ref(db, 'pre_registrations');
      preRegsListener = onValue(preRegsRef, (snapshot: any) => {
        const data = snapshot.val();
        const preRegsArray: PreRegistration[] = data ? Object.entries(data).map(([id, r]) => processPreRegData({ id, ...(r as any) })) : [];
        setPreRegistrations(preRegsArray);
      }, (err: any) => console.warn("Pre-registrations read failed:", err.message));

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
      }, (err: any) => console.warn("Global logs read failed:", err.message));
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
      const weeklyOutcomesRef = ref(db, `${userPath}/weeklyOutcomes`);
      const profileRef = ref(db, `${userPath}/profile`);

      const handleError = (error: any) => {
        // PERMISSION_DENIED is expected during logout/login transitions — use warn not error
        if (error.code === 'PERMISSION_DENIED') {
          console.warn(`Firebase: permission denied (auth transition) for UID: ${authContextUser.uid}`);
        } else {
          console.warn(`Firebase read failed (Role: ${role}): ${error.message}`);
        }
        setLoading(false);
      };

      onValue(studentsRef, (s: any) => {
        const val = s.val();
        const loadedStudents = val ? Object.entries(val).map(([id, st]: [string, any]) =>
          processStudentData({ ...st, id }, authContextUser.uid, (role === 'sheikh' ? authContextUser.group : st.groupName) as string)
        ) : [];
        setStudents(loadedStudents);
        saveEncrypted('students', loadedStudents);
      }, handleError);

      onValue(sessionsRef, (s: any) => {
        const val = s.val() || {};
        const normalized: Record<string, Record<string, DailySession>> = {};
        
        // ⚡ Performance: only keep last 120 days of sessions in memory
        const sheikhCutoff = new Date();
        sheikhCutoff.setDate(sheikhCutoff.getDate() - 120);
        const SHEIKH_SESSION_CUTOFF = sheikhCutoff.toISOString().split('T')[0];

        Object.entries(val).forEach(([date, dayVal]: [string, any]) => {
          if (date < SHEIKH_SESSION_CUTOFF) return;
          normalized[date] = {};
          if (dayVal && typeof dayVal === 'object') {
            if ('date' in dayVal && ('records' in dayVal || 'sessionType' in dayVal)) {
              // Old structure: single session object directly under the date key
              const sessionId = dayVal.id || `${date}-s1`;
              normalized[date][sessionId] = {
                ...dayVal,
                id: sessionId,
                sessionNumber: dayVal.sessionNumber !== undefined ? Number(dayVal.sessionNumber) : 1,
                ownerId: authContextUser.uid
              };
            } else {
              // New structure: dictionary of session objects
              Object.entries(dayVal).forEach(([sessionId, session]: [string, any]) => {
                if (session && typeof session === 'object' && 'date' in session) {
                  normalized[date][sessionId] = {
                    ...session,
                    id: session.id || sessionId,
                    sessionNumber: session.sessionNumber !== undefined ? Number(session.sessionNumber) : (sessionId.endsWith('-s2') ? 2 : 1),
                    ownerId: authContextUser.uid
                  };
                }
              });
            }
          }
        });
        setDailySessions(normalized);
        saveEncrypted('dailySessions', normalized);
      }, handleError);
      onValue(reportsRef, (s: any) => {
        const rep = s.val() || {};
        setDailyReports(rep);
        saveEncrypted('dailyReports', rep);
      }, handleError);
      onValue(progressRef, (s: any) => {
        const prog = s.val() || {};
        setSurahProgress(prog);
        saveEncrypted('surahProgress', prog);
      }, handleError);
      onValue(paymentsRef, (s: any) => {
        const val = s.val();
        const pmts = val ? Object.entries(val).map(([id, p]) => ({ id, ...(p as Omit<Payment, 'id'>) })) : [];
        setPayments(pmts);
        saveEncrypted('payments', pmts);
      }, handleError);
      onValue(adminLogsRef, (s: any) => {
        const val = s.val();
        const logs = val ? Object.entries(val).map(([id, l]) => ({ id, ...(l as Omit<AdminLog, 'id'>) })) : [];
        setAdminLogs(logs);
        saveEncrypted('adminLogs', logs);
      }, handleError);
      onValue(activityLogsRef, (s: any) => {
        const val = s.val();
        setActivityLogs(val ? Object.entries(val).map(([id, l]) => ({ id, ...(l as any) })) : []);
      }, handleError);
      const mergeSettings = (val: any): AppSettings => {
        if (!val) return DEFAULT_SETTINGS;
        const pts = val.points || {};
        const att = pts.attendance || {};
        const rev = pts.review || {};
        
        // Force 'تعويض' to 3.5 if it is 1.5 or missing
        const finalMakeup = (att['تعويض'] === 1.5 || !att['تعويض']) ? 3.5 : Number(att['تعويض']);
        // Force 'completed' review to 3 if it is 1 or 5 or missing
        const finalReview = (rev['completed'] === 1 || rev['completed'] === 5 || !rev['completed']) ? 3 : Number(rev['completed']);

        return {
          ...DEFAULT_SETTINGS,
          ...val,
          points: {
            ...DEFAULT_SETTINGS.points,
            ...pts,
            attendance: { ...DEFAULT_SETTINGS.points.attendance, ...att, 'تعويض': finalMakeup },
            evaluation: { ...DEFAULT_SETTINGS.points.evaluation, ...(pts.evaluation || {}) },
            behavior: { ...DEFAULT_SETTINGS.points.behavior, ...(pts.behavior || {}) },
            review: { ...DEFAULT_SETTINGS.points.review, ...rev, 'completed': finalReview },
            surah: { ...DEFAULT_SETTINGS.points.surah, ...(pts.surah || {}) },
          }
        };
      };
      onValue(settingsRef, (s: any) => {
        const stg = mergeSettings(s.val());
        setSettingsState(stg);
        saveEncrypted('settings', stg);
      }, handleError);
      onValue(weeklyOutcomesRef, (s: any) => {
        setWeeklyOutcomes(s.val() || {});
      }, handleError);

      // Also listen to profile to keep role/group synced if they change
      onValue(profileRef, () => setLoading(false), handleError);

      // Also fetch allUsers so sheikhs can see group names & parent contact info in EarlyWarning
      allUsersRef = ref(db, 'users');
      allUsersListener = onValue(allUsersRef, (snapshot: any) => {
        const usersData = snapshot.val();
        const usersArray = usersData
          ? Object.entries(usersData).map(([uid, data]: [string, any]) => ({ uid, ...data.profile }))
          : [];
        // Filter out demo sheikhs if a real user with the same email exists
        const realEmails = new Set(
          usersArray.filter(u => !u.uid.startsWith('demo_sheikh_') && u.email).map(u => u.email.toLowerCase().trim())
        );
        setAllUsers(usersArray.filter(u => {
          if (u.uid.startsWith('demo_sheikh_') && u.email) return !realEmails.has(u.email.toLowerCase().trim());
          return true;
        }));
      }, (err: any) => console.warn('Sheikh allUsers read failed:', err.message));
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
    }, (err: any) => console.warn("Meetings read failed:", err.message));

    // 6. Internal Notifications Listener
    notificationsRef = ref(db, `users/${authContextUser.uid}/notifications`);
    notificationsListener = onValue(notificationsRef, (snapshot: any) => {
      const data = snapshot.val();
      const notificationsArray = data ? Object.entries(data).map(([id, n]: [string, any]) => ({
        id,
        ...n
      })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
      setInternalNotifications(notificationsArray);
    }, (err: any) => console.warn("Notifications read failed:", err.message));

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

  const combinedKings = useMemo(() => {
    const emptyKing = { id: undefined, name: undefined, streak: 0, photoURL: undefined };
    if (allSortedSessions.length === 0 || activeStudents.length === 0) {
      return { commitmentKing: emptyKing, academicKing: emptyKing, behaviorKing: emptyKing };
    }

    const sortedBasicSessions = allSortedSessions.filter(s => s.sessionType === 'حصة أساسية');
    
    // Pre-parse student registration dates
    const studentRegDates = activeStudents.map(s => {
      let rTime: number | null = null;
      if (s.registrationDate) {
        try {
          const d = s.registrationDate instanceof Date ? s.registrationDate : new Date(s.registrationDate);
          if (!isNaN(d.getTime())) {
            const dCopy = new Date(d);
            dCopy.setHours(0, 0, 0, 0);
            rTime = dCopy.getTime();
          }
        } catch (e) {
          // ignore
        }
      }
      return { id: s.id, student: s, rTime };
    });

    // Pre-parse session dates and build records sets
    const sessionDates = sortedBasicSessions.map(session => {
      let sTime: number | null = null;
      if (session.date) {
        try {
          const d = typeof session.date === 'string' ? parseISO(session.date) : new Date(session.date);
          if (!isNaN(d.getTime())) {
            const dCopy = new Date(d);
            dCopy.setHours(0, 0, 0, 0);
            sTime = dCopy.getTime();
          }
        } catch (e) {
          // ignore
        }
      }
      
      const records = session.records || [];
      const presentIds = new Set<string>();
      const excellentIds = new Set<string>();
      const calmIds = new Set<string>();
      
      records.forEach(r => {
        if (r.attendance === 'حاضر') presentIds.add(r.studentId);
        if (r.memorization === 'ممتاز') excellentIds.add(r.studentId);
        if (r.behavior === 'هادئ') calmIds.add(r.studentId);
      });

      return {
        session,
        sTime,
        presentIds,
        excellentIds,
        calmIds
      };
    });

    // Initialize stats
    const commitmentStats: Record<string, { current: number; max: number }> = {};
    const academicStats: Record<string, { current: number; max: number }> = {};
    const behaviorStats: Record<string, { current: number; max: number }> = {};
    
    activeStudents.forEach(s => {
      commitmentStats[s.id] = { current: 0, max: 0 };
      academicStats[s.id] = { current: 0, max: 0 };
      behaviorStats[s.id] = { current: 0, max: 0 };
    });

    sessionDates.forEach(({ sTime, presentIds, excellentIds, calmIds }) => {
      studentRegDates.forEach(({ id, rTime }) => {
        // Only count sessions after student joined
        if (sTime !== null && rTime !== null && sTime < rTime) {
          return;
        }

        // Commitment
        if (presentIds.has(id)) {
          commitmentStats[id].current++;
        } else {
          commitmentStats[id].max = Math.max(commitmentStats[id].max, commitmentStats[id].current);
          commitmentStats[id].current = 0;
        }

        // Academic
        if (excellentIds.has(id)) {
          academicStats[id].current++;
        } else {
          academicStats[id].max = Math.max(academicStats[id].max, academicStats[id].current);
          academicStats[id].current = 0;
        }

        // Behavior
        if (calmIds.has(id)) {
          behaviorStats[id].current++;
        } else {
          behaviorStats[id].max = Math.max(behaviorStats[id].max, behaviorStats[id].current);
          behaviorStats[id].current = 0;
        }
      });
    });

    // Find winners
    let maxCommitment = 0;
    let commitmentWinnerId: string | undefined;
    let maxAcademic = 0;
    let academicWinnerId: string | undefined;
    let maxBehavior = 0;
    let behaviorWinnerId: string | undefined;

    activeStudents.forEach(s => {
      const cFinal = Math.max(commitmentStats[s.id].max, commitmentStats[s.id].current);
      if (cFinal > maxCommitment) {
        maxCommitment = cFinal;
        commitmentWinnerId = s.id;
      }

      const aFinal = Math.max(academicStats[s.id].max, academicStats[s.id].current);
      if (aFinal > maxAcademic) {
        maxAcademic = aFinal;
        academicWinnerId = s.id;
      }

      const bFinal = Math.max(behaviorStats[s.id].max, behaviorStats[s.id].current);
      if (bFinal > maxBehavior) {
        maxBehavior = bFinal;
        behaviorWinnerId = s.id;
      }
    });

    const cKing = activeStudents.find(s => s.id === commitmentWinnerId);
    const aKing = activeStudents.find(s => s.id === academicWinnerId);
    const bKing = activeStudents.find(s => s.id === behaviorWinnerId);

    return {
      commitmentKing: { id: cKing?.id, name: cKing?.fullName, streak: maxCommitment, photoURL: cKing?.photoURL },
      academicKing: { id: aKing?.id, name: aKing?.fullName, streak: maxAcademic, photoURL: aKing?.photoURL },
      behaviorKing: { id: bKing?.id, name: bKing?.fullName, streak: maxBehavior, photoURL: bKing?.photoURL }
    };
  }, [activeStudents, allSortedSessions]);

  const { commitmentKing, academicKing, behaviorKing } = combinedKings;

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

    return { id: (guardian as any)?.id, name: (guardian as any)?.fullName, count: maxCount, photoURL: (guardian as any)?.photoURL };
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

    if (studentData.photoFile && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const imageRef = storageRef(storage, `student_photos/${studentId}`);
        await uploadBytes(imageRef, studentData.photoFile);
        photoURL = await getDownloadURL(imageRef);
      } catch (err) {
        console.warn('Failed to upload photo online:', err);
      }
    }

    const { photoFile, ...restOfStudentData } = studentData;

    const newStudent: Student = {
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

    // 1. التحديث الفوري فائق السرعة للحالة المحلية (0ms)
    setStudents(prev => {
      const next = [...prev, newStudent];
      saveEncrypted('students', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const studentPath = `users/${ownerId}/students/${studentId}`;
    const sanitizedStudent = sanitizeData({
      ...newStudent,
      birthDate: newStudent.birthDate instanceof Date ? newStudent.birthDate.toISOString() : newStudent.birthDate || null,
      registrationDate: newStudent.registrationDate instanceof Date ? newStudent.registrationDate.toISOString() : newStudent.registrationDate,
      updatedAt: newStudent.updatedAt instanceof Date ? newStudent.updatedAt.toISOString() : newStudent.updatedAt,
      covenants: newStudent.covenants || null
    });

    if (isOnline) {
      try {
        const studentRef = ref(db, studentPath);
        const surahProgressRef = ref(db, `users/${ownerId}/surahProgress/${studentId}`);
        await executeWithTimeout(Promise.all([set(studentRef, sanitizedStudent), set(surahProgressRef, {})]), 2500);

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
      } catch (e) {
        await queueOfflineMutation({
          type: 'SET',
          path: studentPath,
          payload: sanitizedStudent,
          description: `إضافة طالب جديد: ${newStudent.fullName}`,
          ownerId,
          authorUid: authContextUser.uid
        });
        toast({
          title: "⚡ تم الحفظ محلياً بسرعة",
          description: "تم حفظ الطالب محلياً بسبب بطء الاتصال، وستُرفع البيانات تلقائياً لاحقاً.",
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'SET',
        path: studentPath,
        payload: sanitizedStudent,
        description: `إضافة طالب جديد: ${newStudent.fullName}`,
        ownerId,
        authorUid: authContextUser.uid
      });
      toast({
        title: "💾 تم الحفظ محلياً بنجاح",
        description: "تم تشفير بيانات الطالب محلياً (AES-256)، وستُرفع تلقائياً عند الاتصال بالإنترنت.",
      });
    }
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

    if (updatedData.photoFile && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const imageRef = storageRef(storage, `student_photos/${studentId}`);
        await uploadBytes(imageRef, updatedData.photoFile);
        finalPhotoURL = await getDownloadURL(imageRef);
      } catch (e) {
        console.warn('Failed to upload photo online:', e);
      }
    }

    const { photoFile, ...restOfUpdatedData } = updatedData;

    const finalData = { ...originalStudent, ...restOfUpdatedData, photoURL: finalPhotoURL, updatedAt: new Date() };

    const covenantsObject = (finalData.covenants || []).reduce((acc, cov) => {
      acc[cov.id] = cov;
      return acc;
    }, {} as Record<string, Covenant>);

    // 1. التحديث الفوري للحالة المحلية (0ms)
    setStudents(prev => {
      const next = prev.map(s => s.id === studentId ? finalData : s);
      saveEncrypted('students', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const path = `users/${studentOwnerId}/students/${studentId}`;
    const sanitizedData = sanitizeData({
      ...finalData,
      birthDate: finalData.birthDate instanceof Date ? finalData.birthDate.toISOString() : finalData.birthDate || null,
      registrationDate: finalData.registrationDate instanceof Date ? finalData.registrationDate.toISOString() : finalData.registrationDate,
      updatedAt: finalData.updatedAt instanceof Date ? finalData.updatedAt.toISOString() : finalData.updatedAt,
      covenants: Object.keys(covenantsObject).length > 0 ? covenantsObject : null
    });

    if (isOnline) {
      try {
        const studentRef = ref(db, path);
        await executeWithTimeout(set(studentRef, sanitizedData), 2500);

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
      } catch (err) {
        await queueOfflineMutation({
          type: 'SET',
          path,
          payload: sanitizedData,
          description: `تحديث بيانات الطالب: ${finalData.fullName}`,
          ownerId: studentOwnerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'SET',
        path,
        payload: sanitizedData,
        description: `تحديث بيانات الطالب: ${finalData.fullName}`,
        ownerId: studentOwnerId,
        authorUid: authContextUser.uid
      });
      toast({
        title: "💾 تم التعديل محلياً",
        description: "تم تحديث بيانات الطالب محلياً وستُرفع تلقائياً عند توفر الإنترنت.",
      });
    }

    // Auto-sync public student report in background if online
    if (isOnline) {
      syncPublicStudentReport(studentId);
    }
  };

  const deleteStudent = async (studentId: string, ownerId: string) => {
    if (!authContextUser) return;
    const studentOwnerId = (isSuperAdmin || isManagement) ? ownerId : authContextUser.uid;
    if (!studentOwnerId) return;

    const studentToDelete = students.find(s => s.id === studentId);

    // 1. التحديث الفوري للحالة المحلية
    setStudents(prev => {
      const next = prev.filter(s => s.id !== studentId);
      saveEncrypted('students', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const path = `users/${studentOwnerId}/students/${studentId}`;

    if (isOnline) {
      try {
        const studentRef = ref(db, path);
        await executeWithTimeout(remove(studentRef), 2500);

        if (studentToDelete) {
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
      } catch (err) {
        await queueOfflineMutation({
          type: 'REMOVE',
          path,
          description: `حذف الطالب: ${studentToDelete?.fullName || studentId}`,
          ownerId: studentOwnerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'REMOVE',
        path,
        description: `حذف الطالب: ${studentToDelete?.fullName || studentId}`,
        ownerId: studentOwnerId,
        authorUid: authContextUser.uid
      });
      toast({
        title: "🗑️ تم الحذف محلياً",
        description: "تم حذف الطالب محلياً وسيتم تطبيق الحذف سحابياً فور توفر الإنترنت.",
      });
    }
  };

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

  const addDailySession = async (session: DailySession, targetOwnerId?: string): Promise<void> => {
    if (!authContextUser) return;

    const ownerId = (isSuperAdmin || isManagement) && targetOwnerId ? targetOwnerId : authContextUser.uid;
    const targetDate = session.date;
    const sessionId = session.id;
    const uniqueKey = isPrivileged ? `${ownerId}_${sessionId}` : sessionId;

    const fullSession: DailySession = {
      ...session,
      id: sessionId,
      ownerId,
      createdAt: session.createdAt || new Date().toISOString()
    };

    // 1. التحديث الفوري فائق السرعة للحالة المحلية (0ms)
    setDailySessions(prev => {
      const next = { ...prev };
      if (!next[targetDate]) next[targetDate] = {};
      next[targetDate] = { ...next[targetDate], [uniqueKey]: fullSession };
      saveEncrypted('dailySessions', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const path = `users/${ownerId}/dailySessions/${targetDate}/${sessionId}`;
    const sanitizedSession = sanitizeData(fullSession);

    if (isOnline) {
      try {
        const sessionRef = ref(db, path);
        await executeWithTimeout(set(sessionRef, sanitizedSession), 2500);

        // تسجيل النشاط
        logActivity(
          'ADD_SESSION',
          authContextUser.uid,
          `تم تسجيل حصة جديدة بتاريخ: ${session.date} ${targetOwnerId ? `(نيابة عن شيخ)` : ''}`,
          session.id,
          session.sessionType,
          authContextUser.displayName || 'Unknown',
          authContextUser.group || 'غير محدد',
          ownerId
        );
      } catch (error) {
        console.warn('Firebase direct save failed/timed out, queuing mutation:', error);
        await queueOfflineMutation({
          type: 'SET',
          path,
          payload: sanitizedSession,
          description: `تسجيل حصة: ${targetDate} (${fullSession.sessionType})`,
          ownerId,
          authorUid: authContextUser.uid
        });
        toast({
          title: "⚡ تم الحفظ محلياً بسرعة فائقة",
          description: "تم حفظ بيانات الحصة محلياً بسبب بطء الاتصال، وستُرفع تلقائياً للسحابة لاحقاً.",
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'SET',
        path,
        payload: sanitizedSession,
        description: `تسجيل حصة: ${targetDate} (${fullSession.sessionType})`,
        ownerId,
        authorUid: authContextUser.uid
      });
      toast({
        title: "💾 تم الحفظ أوفلاين بنجاح",
        description: "تم تشفير وحفظ بيانات الحصة محلياً (AES-256)، وستُرفع تلقائياً عند الاتصال بالإنترنت.",
      });
    }

    // Auto-sync public reports for all students in this session if online
    if (isOnline) {
      const records = session.records || [];
      records.forEach(r => {
        if (r.studentId) {
          syncPublicStudentReport(r.studentId);
        }
      });
    }
  };

  const deleteDailySession = async (sessionId: string, date?: string, targetOwnerId?: string) => {
    if (!authContextUser || !sessionId) return;

    const ownerId = (isSuperAdmin || isManagement) && targetOwnerId ? targetOwnerId : authContextUser.uid;
    const targetDate = date || sessionId.substring(0, 10);
    const uniqueKey = isPrivileged ? `${ownerId}_${sessionId}` : sessionId;

    // 1. التحديث الفوري للحالة المحلية
    setDailySessions(prev => {
      const next = { ...prev };
      if (next[targetDate]) {
        const dayCopy = { ...next[targetDate] };
        delete dayCopy[uniqueKey];
        delete dayCopy[sessionId];
        next[targetDate] = dayCopy;
      }
      saveEncrypted('dailySessions', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const path = `users/${ownerId}/dailySessions/${targetDate}/${sessionId}`;

    if (isOnline) {
      try {
        await executeWithTimeout(remove(ref(db, path)), 2500);
        logActivity(
          'DELETE_SESSION',
          authContextUser.uid,
          `تم حذف حصة بتاريخ: ${targetDate} ${targetOwnerId ? '(نيابة عن شيخ)' : ''}`,
          sessionId,
          'حصة محذوفة',
          authContextUser.displayName || 'Unknown',
          authContextUser.group || 'غير محدد',
          ownerId
        );
      } catch {
        await queueOfflineMutation({
          type: 'REMOVE',
          path,
          description: `حذف حصة: ${targetDate}`,
          ownerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'REMOVE',
        path,
        description: `حذف حصة: ${targetDate}`,
        ownerId,
        authorUid: authContextUser.uid
      });
      toast({
        title: "🗑️ تم الحذف محلياً",
        description: "تم حذف الحصة محلياً وسيتم تطبيق الحذف سحابياً فور عودة الإنترنت.",
      });
    }
  };

  const getSessionsForDay = (date: string): DailySession[] => {
    const sessionsForDate = (dailySessions ?? {})[date];
    if (!sessionsForDate) return [];

    // Ensure id is present in each session object
    return Object.entries(sessionsForDate).map(([id, session]) => ({
      ...session,
      id: session.id || id,
      ownerId: session.ownerId || (isManagement || isSuperAdmin ? undefined : authContextUser?.uid)
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

  const sendManagementMessage = async (targetSheikhId: string, messageData: Partial<DailyReport>, alternateUids?: string[]) => {
    if (!authContextUser || (!isSuperAdmin && !isManagement)) {
      throw new Error("Only management can send messages to sheikhs");
    }

    const reportId = Date.now().toString();
    const date = new Date().toISOString().split('T')[0];

    const finalMessage: DailyReport = {
      id: reportId,
      date,
      timestamp: new Date().toISOString(),
      authorId: authContextUser.uid,
      authorName: authContextUser.displayName || 'الإدارة',
      note: messageData.note || '',
      category: messageData.category || 'رسالة إدارية',
      status: 'reviewed',
      adminNotes: null,
      isPinned: messageData.isPinned || false,
      priority: messageData.priority || 'normal',
      isManagementMessage: true,
      recipientId: targetSheikhId,
      hasNewReply: true,
      isReadByRecipient: false
    };

    const allRecipientUids = [targetSheikhId, ...(alternateUids || [])];
    const uploadOps = allRecipientUids.map(uid => {
      const reportRef = ref(db, `users/${uid}/dailyReports/${date}/${reportId}`);
      return set(reportRef, sanitizeData({ ...finalMessage, recipientId: uid }));
    });

    await Promise.all(uploadOps);

    // Log the action
    logActivity(
      'ADMIN_MSG',
      authContextUser.uid,
      `رسالة إدارية إلى: ${targetSheikhId}`,
      reportId,
      finalMessage.note.substring(0, 50),
      authContextUser.displayName || 'Admin',
      'Management',
      targetSheikhId
    );
  };

  const markManagementMessageAsRead = async (reportId: string, date: string) => {
    if (!authContextUser) return;
    const reportRef = ref(db, `users/${authContextUser.uid}/dailyReports/${date}/${reportId}`);
    await update(reportRef, { isReadByRecipient: true });
    toast({ title: '✅ تم توثيق قراءة التوجيه' });
  };

  const deleteDailyReport = async (reportId: string, date: string) => {
    if (!authContextUser) throw new Error("User not authenticated");
    const reportAuthorId = dailyReports[date]?.[reportId]?.authorId || authContextUser.uid;
    const reportDbRef = ref(db, `users/${reportAuthorId}/dailyReports/${date}/${reportId}`);
    await remove(reportDbRef);
  }

  const deleteMultipleDailyReports = async (reportsToDelete: { id: string, date: string, authorId: string }[]) => {
    if (!authContextUser) throw new Error("User not authenticated");

    const updates: { [key: string]: null } = {};

    reportsToDelete.forEach(({ id, date, authorId }) => {
      // Security check: only allow if user is author or admin
      if (isSuperAdmin || isManagement || authorId === authContextUser.uid) {
        updates[`users/${authorId}/dailyReports/${date}/${id}`] = null;
      }
    });

    if (Object.keys(updates).length > 0) {
      const dbRef = ref(db);
      await update(dbRef, updates);
    }
  }

  const restoreSessions = async (sessions: DailySession[]) => {
    if (!authContextUser) return;
    const updates: Record<string, any> = {};
    sessions.forEach(session => {
      updates[`users/${authContextUser.uid}/dailySessions/${session.date}/${session.id}`] = session;
    });
    await update(ref(db), updates);
  };

  const saveWeeklyOutcome = async (outcome: WeeklyOutcome) => {
    if (!authContextUser) return;
    const outcomeRef = ref(db, `users/${authContextUser.uid}/weeklyOutcomes/${outcome.id}`);
    await set(outcomeRef, sanitizeData(outcome));
    toast({ title: "✅ تم الحفظ", description: "تم حفظ تقييم الحصيلة الأسبوعية." });
  };

  const toggleSurahStatus = async (studentId: string, surahId: number) => {
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

    const isOnline = isEffectiveOnline();
    const progressPath = `users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`;
    const wholeMapPath = `users/${studentOwnerId}/surahProgress/${studentId}`;

    if (nextStatus === 0) {
      delete studentProgressMap[surahId];
    } else {
      studentProgressMap[surahId] = newEntry;
    }

    // 1. التحديث الفوري للحالة المحلية
    setSurahProgress(prev => {
      const next = { ...prev, [studentId]: studentProgressMap };
      saveEncrypted('surahProgress', next);
      return next;
    });

    const memorizedCount = Object.values(studentProgressMap).filter(entry => entry.status > 0).length;
    updateStudent(studentId, { memorizedSurahsCount: memorizedCount }, studentOwnerId);

    if (isOnline) {
      try {
        if (nextStatus === 0) {
          await executeWithTimeout(remove(ref(db, progressPath)), 2500);
        } else {
          await executeWithTimeout(set(ref(db, progressPath), newEntry), 2500);
        }
        await executeWithTimeout(set(ref(db, wholeMapPath), studentProgressMap), 2500);

        logActivity(
          'UPDATE_SURAH_PROGRESS',
          authContextUser.uid,
          nextStatus === 0 ? `تم حذف حالة السورة (ID: ${surahId})` : `تحديث حالة السورة (ID: ${surahId})`,
          studentId,
          students.find(s => s.id === studentId)?.fullName || 'غير معروف',
          authContextUser.displayName || 'Unknown',
          students.find(s => s.id === studentId)?.groupName || 'غير محدد',
          studentOwnerId
        );
      } catch {
        await queueOfflineMutation({
          type: nextStatus === 0 ? 'REMOVE' : 'SET',
          path: progressPath,
          payload: nextStatus === 0 ? null : newEntry,
          description: `تغيير حالة السورة (${surahId})`,
          ownerId: studentOwnerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: nextStatus === 0 ? 'REMOVE' : 'SET',
        path: progressPath,
        payload: nextStatus === 0 ? null : newEntry,
        description: `تغيير حالة السورة (${surahId})`,
        ownerId: studentOwnerId,
        authorUid: authContextUser.uid
      });
    }
  }

  const bulkUpdateSurahStatus = async (studentIds: string[], surahIds: number[], targetStatus: 0 | 1 | 2) => {
    if (!authContextUser) return;

    const updates: { [key: string]: any } = {};
    const timestamp = new Date().toISOString();
    const newProgressState = { ...surahProgress };

    studentIds.forEach(studentId => {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      const studentOwnerId = student.ownerId;
      if (!isSuperAdmin && !isManagement && authContextUser.uid !== studentOwnerId) return;

      const studentProgressMap = { ...(newProgressState[studentId] || {}) };
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
        newProgressState[studentId] = studentProgressMap;
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

    // 1. التحديث الفوري للحالة المحلية
    setSurahProgress(newProgressState);
    saveEncrypted('surahProgress', newProgressState);

    if (Object.keys(updates).length > 0) {
      const isOnline = isEffectiveOnline();
      const sanitizedUpdates = sanitizeData(updates);

      if (isOnline) {
        try {
          await executeWithTimeout(update(ref(db), sanitizedUpdates), 2500);
          toast({
            title: "✅ تم التحديث الجماعي",
            description: `تم تحديث ${surahIds.length} سورة لـ ${studentIds.length} طلاب بنجاح.`,
          });
        } catch {
          await queueOfflineMutation({
            type: 'UPDATE',
            path: '',
            payload: sanitizedUpdates,
            description: `تحديث جماعي للسور (${studentIds.length} طلاب)`,
            ownerId: authContextUser.uid,
            authorUid: authContextUser.uid
          });
          toast({
            title: "💾 تم التحديث محلياً",
            description: "تم حفظ التحديث محلياً بسبب بطء الاتصال، وسيتم رفعه تلقائياً.",
          });
        }
      } else {
        await queueOfflineMutation({
          type: 'UPDATE',
          path: '',
          payload: sanitizedUpdates,
          description: `تحديث جماعي للسور (${studentIds.length} طلاب)`,
          ownerId: authContextUser.uid,
          authorUid: authContextUser.uid
        });
        toast({
          title: "💾 تم التحديث أوفلاين",
          description: "تم حفظ التحديثات أوفلاين وسيتم الرفع فور استقرار النت.",
        });
      }

      // Auto-sync public reports for all updated students if online
      if (isOnline) {
        studentIds.forEach(id => {
          syncPublicStudentReport(id);
        });
      }
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

    // 1. التحديث الفوري للحالة المحلية
    setPayments(prev => {
      const next = [...prev, newPayment];
      saveEncrypted('payments', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const path = `users/${studentOwnerId}/payments/${paymentId}`;

    if (isOnline) {
      try {
        await executeWithTimeout(set(ref(db, path), sanitizeData(newPayment)), 2500);
      } catch (err) {
        await queueOfflineMutation({
          type: 'SET',
          path,
          payload: newPayment,
          description: `تسجيل دفعة: ${newPayment.amount} دج`,
          ownerId: studentOwnerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'SET',
        path,
        payload: newPayment,
        description: `تسجيل دفعة: ${newPayment.amount} دج`,
        ownerId: studentOwnerId,
        authorUid: authContextUser.uid
      });
      toast({
        title: "💾 تم الحفظ محلياً",
        description: "تم تسجيل الدفعة محلياً وسيتم رفعها للسحاب عند توفر الإنترنت.",
      });
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: PaymentStatus, amount: number) => {
    if (!authContextUser) throw new Error("User not authenticated");

    // Find the payment to get its owner
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) throw new Error("Payment not found");

    const student = students.find(s => s.id === payment.studentId);
    if (!student) throw new Error("Student not found");

    // Allow if user is the owner, or if user is privileged
    if (!isPrivileged && authContextUser.uid !== student.ownerId) {
      throw new Error("Not authorized to update this payment");
    }

    // 1. التحديث الفوري للحالة المحلية
    setPayments(prev => {
      const next = prev.map(p => p.id === paymentId ? { ...p, status, amount } : p);
      saveEncrypted('payments', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const path = `users/${student.ownerId}/payments/${paymentId}`;

    if (isOnline) {
      try {
        await executeWithTimeout(update(ref(db, path), { status, amount }), 2500);
      } catch (err) {
        await queueOfflineMutation({
          type: 'UPDATE',
          path,
          payload: { status, amount },
          description: `تحديث حالة الدفعة: ${status}`,
          ownerId: student.ownerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'UPDATE',
        path,
        payload: { status, amount },
        description: `تحديث حالة الدفعة: ${status}`,
        ownerId: student.ownerId,
        authorUid: authContextUser.uid
      });
    }
  };

  const bulkAddOrUpdatePayments = async (operations: Array<{
    studentId: string;
    paymentId?: string;
    status: PaymentStatus;
    amount: number;
    date: string;
  }>) => {
    if (!authContextUser) throw new Error("User not authenticated");

    const updates: Record<string, any> = {};

    for (const op of operations) {
      const student = students.find(s => s.id === op.studentId);
      if (!student) continue;

      const studentOwnerId = student.ownerId;
      if (!studentOwnerId) continue;

      if (!isPrivileged && authContextUser.uid !== studentOwnerId) {
        throw new Error("Not authorized to modify payment for this student");
      }

      if (op.paymentId) {
        updates[`users/${studentOwnerId}/payments/${op.paymentId}/status`] = op.status;
        updates[`users/${studentOwnerId}/payments/${op.paymentId}/amount`] = op.amount;
      } else {
        const paymentId = uuidv4();
        const newPayment: Payment = {
          id: paymentId,
          studentId: op.studentId,
          amount: op.amount,
          date: op.date,
          status: op.status,
        };
        updates[`users/${studentOwnerId}/payments/${paymentId}`] = newPayment;
      }
    }

    if (Object.keys(updates).length > 0) {
      // 1. التحديث الفوري للحالة المحلية
      setPayments(prev => {
        let next = [...prev];
        for (const op of operations) {
          if (op.paymentId) {
            next = next.map(p => p.id === op.paymentId ? { ...p, status: op.status, amount: op.amount } : p);
          } else {
            const student = students.find(s => s.id === op.studentId);
            if (student) {
              const matchedPayment = Object.values(updates).find((p: any) => p && p.studentId === op.studentId);
              if (matchedPayment) next.push(matchedPayment);
            }
          }
        }
        saveEncrypted('payments', next);
        return next;
      });

      const isOnline = isEffectiveOnline();
      const sanitizedUpdates = sanitizeData(updates);

      if (isOnline) {
        try {
          await executeWithTimeout(update(ref(db), sanitizedUpdates), 2500);
        } catch {
          await queueOfflineMutation({
            type: 'UPDATE',
            path: '',
            payload: sanitizedUpdates,
            description: `تحديث مدفوعات جماعية (${operations.length} طالب)`,
            ownerId: authContextUser.uid,
            authorUid: authContextUser.uid
          });
        }
      } else {
        await queueOfflineMutation({
          type: 'UPDATE',
          path: '',
          payload: sanitizedUpdates,
          description: `تحديث مدفوعات جماعية (${operations.length} طالب)`,
          ownerId: authContextUser.uid,
          authorUid: authContextUser.uid
        });
      }
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    if (!authContextUser) throw new Error("User not authenticated");
    setSettingsState(newSettings);
    saveEncrypted('settings', newSettings);

    const isOnline = isEffectiveOnline();
    const settingsPath = `users/${authContextUser.uid}/settings`;
    const sanitized = sanitizeData(newSettings);

    if (isOnline) {
      try {
        const settingsRef = ref(db, settingsPath);
        await executeWithTimeout(set(settingsRef, sanitized), 2500);
      } catch {
        await queueOfflineMutation({
          type: 'SET',
          path: settingsPath,
          payload: sanitized,
          description: 'تحديث إعدادات التطبيق',
          ownerId: authContextUser.uid,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'SET',
        path: settingsPath,
        payload: sanitized,
        description: 'تحديث إعدادات التطبيق',
        ownerId: authContextUser.uid,
        authorUid: authContextUser.uid
      });
    }
  };

  const updateSheikhGroupSettings = async (
    sheikhId: string,
    mode?: 'unified' | 'individual' | 'hybrid' | 'not_set',
    targetSurah?: GroupSurahConfig
  ) => {
    if (!authContextUser) throw new Error("User not authenticated");
    
    if (authContextUser.uid !== sheikhId && !isPrivileged) {
      throw new Error("Not authorized to update settings for this sheikh");
    }

    try {
      const sheikhSettingsPath = `users/${sheikhId}/settings`;
      const updates: any = {};
      if (mode !== undefined) updates.groupMemorizationMode = mode;
      if (targetSurah !== undefined) updates.groupSurah = targetSurah;

      if (authContextUser.uid === sheikhId) {
        setSettingsState((prev) => {
          const next = {
            ...prev,
            ...(mode !== undefined ? { groupMemorizationMode: mode } : {}),
            ...(targetSurah !== undefined ? { groupSurah: targetSurah } : {}),
          };
          saveEncrypted('settings', next);
          return next;
        });
      }

      const isOnline = isEffectiveOnline();
      const sanitized = sanitizeData(updates);

      if (isOnline) {
        try {
          const sheikhSettingsRef = ref(db, sheikhSettingsPath);
          await executeWithTimeout(update(sheikhSettingsRef, sanitized), 2500);
        } catch {
          await queueOfflineMutation({
            type: 'UPDATE',
            path: sheikhSettingsPath,
            payload: sanitized,
            description: 'تحديث إعدادات الفوج والورد',
            ownerId: sheikhId,
            authorUid: authContextUser.uid
          });
        }
      } else {
        await queueOfflineMutation({
          type: 'UPDATE',
          path: sheikhSettingsPath,
          payload: sanitized,
          description: 'تحديث إعدادات الفوج والورد',
          ownerId: sheikhId,
          authorUid: authContextUser.uid
        });
      }

      toast({
        title: "✅ تم حفظ الإعدادات",
        description: "تم تحديث إعدادات الفوج والورد بنجاح في النظام.",
      });
    } catch (error: any) {
      console.error("Failed to update sheikh group settings:", error);
      toast({
        title: "❌ خطأ في الحفظ",
        description: error.message || "حدث خطأ أثناء حفظ إعدادات المجموعة.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const generateDemoData = async () => {
    if (!isPrivileged) return;

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
        { name: "الأستاذة ميمونه", group: "فوج 17", email: "admin17@gmail.com" },
        { name: "الأستاذة حياة", group: "فوج 18", email: "admin18@gmail.com" },
        { name: "فوج 1 إبتدائي", group: "فوج 19", email: "admin19@gmail.com" },
        { name: "الشيخ عبد الكريم ترممو", group: "فوج 20", email: "admin20@gmail.com" },
        { name: "الشيخ كنيوة عرفات", group: "فوج 21", email: "admin21@gmail.com" },
        { name: "الشيخ عبد الرحمان كنيوة", group: "فوج 22", email: "admin22@gmail.com" },
      ];

      const updates: any = {};

      demoSheikhs.forEach((sheikh, index) => {
        const emailMatch = sheikh.email.match(/admin(\d+)/);
        const emailNum = emailMatch ? parseInt(emailMatch[1], 10) : (index + 1);
        const fakeUid = `demo_sheikh_${emailNum}`;

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

    const ownerId = isPrivileged ? logData.details?.ownerId || authContextUser.uid : authContextUser.uid;

    // 1. التحديث الفوري للحالة المحلية (0ms)
    setAdminLogs(prev => {
      const next = [log, ...prev];
      saveEncrypted('adminLogs', next);
      return next;
    });

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const path = `users/${ownerId}/admin_logs/${logId}`;
    const sanitizedLog = sanitizeData(log);

    if (isOnline) {
      try {
        const logRef = ref(db, path);
        await set(logRef, sanitizedLog);

        // Sync with public report if it exists
        try {
          const publicReportRef = ref(db, `public_student_reports/${logData.studentId}`);
          const publicReportSnap = await get(publicReportRef);
          if (publicReportSnap.exists()) {
            const publicAdminLogsRef = ref(db, `public_student_reports/${logData.studentId}/adminLogs/${logId}`);
            await set(publicAdminLogsRef, sanitizedLog);
          }
        } catch (error) {
          console.error("Error syncing with public report:", error);
        }
      } catch (err) {
        await queueOfflineMutation({
          type: 'SET',
          path,
          payload: sanitizedLog,
          description: `تسجيل وصل: ${log.type} (${log.studentName})`,
          ownerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'SET',
        path,
        payload: sanitizedLog,
        description: `تسجيل وصل: ${log.type} (${log.studentName})`,
        ownerId,
        authorUid: authContextUser.uid
      });
    }

    toast({
      title: "✅ تم الحفظ والطباعة",
      description: `تم تسجيل الوصل في النظام بنجاح.`,
    });
  };

  const deleteAdminLog = async (log: AdminLog) => {
    if (!authContextUser) return;
    const ownerId = log.details?.ownerId || authContextUser.uid;

    // 1. التحديث الفوري للحالة المحلية
    setAdminLogs(prev => {
      const next = prev.filter(l => l.id !== log.id);
      saveEncrypted('adminLogs', next);
      return next;
    });

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const path = `users/${ownerId}/admin_logs/${log.id}`;

    if (isOnline) {
      try {
        const logRef = ref(db, path);
        await remove(logRef);

        const publicLogRef = ref(db, `public_student_reports/${log.studentId}/adminLogs/${log.id}`);
        await remove(publicLogRef);
      } catch (e) {
        await queueOfflineMutation({
          type: 'REMOVE',
          path,
          description: `حذف وصل: ${log.type} (${log.studentName})`,
          ownerId,
          authorUid: authContextUser.uid
        });
      }
    } else {
      await queueOfflineMutation({
        type: 'REMOVE',
        path,
        description: `حذف وصل: ${log.type} (${log.studentName})`,
        ownerId,
        authorUid: authContextUser.uid
      });
    }

    toast({
      title: "🗑️ تم الحذف",
      description: "تم حذف الوصل من السجلات بنجاح.",
    });
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

  const syncPublicStudentReport = async (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      const pointsConfig = settings.points;
      const monthStartDate = startOfMonth(new Date());
      const monthEndDate = endOfMonth(new Date());

      // Get sessions in current month
      const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate =>
        Object.values(sessionsOnDate).filter(session => {
          if (!session?.date) return false;
          try {
            const sessionDate = parseISO(session.date);
            return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
          } catch (e) { return false; }
        })
      );

      // Calculate scores for all active students in the same group
      const groupStudents = students.filter(s => s.status === 'نشط' && s.groupName === student.groupName);
      const studentScores: Record<string, { id: string; points: number; stats: any }> = {};
      groupStudents.forEach(s => {
        studentScores[s.id] = { id: s.id, points: 0, stats: { absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0 } };
      });

      sessionsInMonth.forEach(session => {
        (session.records ?? []).forEach(record => {
          if (studentScores[record.studentId]) {
            let memoLevel = record.memorization;
            if (memoLevel === 'متوسط') memoLevel = 'مقبول';
            if (memoLevel === 'جيد جدا') memoLevel = 'جيد جداً';

            let behaviorLevel = record.behavior;
            if ((behaviorLevel as string) === 'متوسط') behaviorLevel = 'مقبول';
            if ((behaviorLevel as string) === 'غير منضبط') behaviorLevel = 'مشاغب';

            if (record.attendance && pointsConfig.attendance) {
              studentScores[record.studentId].points += (pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] || 0);
            }
            if (memoLevel && pointsConfig.evaluation) {
              studentScores[record.studentId].points += (pointsConfig.evaluation[memoLevel as keyof typeof pointsConfig.evaluation] || 0);
            }
            if (behaviorLevel && pointsConfig.behavior) {
              studentScores[record.studentId].points += (pointsConfig.behavior[behaviorLevel as keyof typeof pointsConfig.behavior] || 0);
            }
            if (record.review && pointsConfig.review) {
              studentScores[record.studentId].points += (pointsConfig.review.completed || 0);
            }

            if (record.attendance === 'غائب') studentScores[record.studentId].stats.absent++;
            if (record.attendance === 'تعويض') studentScores[record.studentId].stats.makeup++;
            if (behaviorLevel === 'هادئ') studentScores[record.studentId].stats.calm++;
            if (behaviorLevel === 'مقبول') studentScores[record.studentId].stats.medium++;
            if (behaviorLevel === 'مشاغب') studentScores[record.studentId].stats.undisciplined++;
          }
        });
      });

      const rankedStudents = Object.values(studentScores).sort((a, b) => b.points - a.points);
      const rankIndex = rankedStudents.findIndex(s => s.id === student.id);
      const rank = rankIndex !== -1 ? rankIndex + 1 : null;

      const currentPoints = studentScores[student.id]?.points || 0;
      const studentStats = studentScores[student.id]?.stats || { absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0 };
      const uncompensatedAbsences = studentStats.absent - studentStats.makeup;

      let medal: 'gold' | 'silver' | 'bronze' | null = null;
      if (rank === 1 && uncompensatedAbsences <= 0 && studentStats.calm > (studentStats.medium + studentStats.undisciplined)) {
        medal = 'gold';
      } else if (rank === 2 && uncompensatedAbsences <= 1) {
        medal = 'silver';
      } else if (rank === 3 && uncompensatedAbsences <= 2) {
        medal = 'bronze';
      }

      // Mastery count
      const studentMastery = surahProgress[student.id] || {};
      const masteredCount = Object.values(studentMastery).filter(s => s.status === 2).length;

      // Student records in month
      const studentRecordsInMonth = sessionsInMonth.flatMap(s => s.records ?? []).filter(r => r.studentId === student.id);
      const attendanceScore = studentRecordsInMonth.length > 0 ? ((studentRecordsInMonth.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length) / studentRecordsInMonth.length) * 10 : 0;
      const disciplineScore = studentRecordsInMonth.length > 0 ? ((studentRecordsInMonth.filter(r => r.behavior === 'هادئ').length * 2 + studentRecordsInMonth.filter(r => r.behavior === 'مقبول' || (r.behavior as any) === 'متوسط').length * 1) / (studentRecordsInMonth.length * 2)) * 10 : 0;
      const memorizationScore = (masteredCount / 114) * 10; // 114 surahs

      const activeCovenant = (student.covenants || []).find(c => c.status === 'نشط' && c.card !== 'بدون');
      const latestBadge = settings.badges?.find(b => b.id === 'mastery_king' && currentPoints >= b.threshold) || null;

      // Generate history snapshot
      const fullHistory: any = {};
      Object.keys(dailySessions || {}).forEach(date => {
        const sessions = dailySessions[date];
        const studentSessions = Object.values(sessions).filter(s =>
          s.records?.some(r => r.studentId === studentId)
        );
        if (studentSessions.length > 0) {
          fullHistory[date] = {
            records: studentSessions.flatMap(s => (s.records || []).filter(r => r.studentId === studentId)),
            isHoliday: studentSessions.some(s => s.isHoliday),
            isSheikhAbsentNoSub: studentSessions.some(s => s.isSheikhAbsentNoSub),
            isSheikhAbsentWithSub: studentSessions.some(s => s.isSheikhAbsentWithSub),
          };
        }
      });

      const sheikh = allUsers.find(u => u.uid === student.ownerId);
      const resolvedSheikhName = sheikh?.displayName || student.sheikhName || 'غير حدد';

      const studentAdminLogs = (adminLogs || []).filter(log => log.studentId === studentId);

      const shareRef = ref(db, `public_student_reports/${studentId}`);
      await set(shareRef, sanitizeData({
        student: {
          ...student,
          sheikhName: resolvedSheikhName,
          // Inject pre-calculated portal metrics
          isPublicReport: true,
          rank,
          medal,
          currentPoints,
          uncompensatedAbsences,
          masteredCount,
          attendanceRate: attendanceScore,
          disciplineScore,
          memorizationScore,
          activeCovenant: activeCovenant || null,
          latestBadge: latestBadge || null
        } as any,
        studentData: fullHistory,
        adminLogs: studentAdminLogs.reduce((acc: any, log) => {
          acc[log.id] = log;
          return acc;
        }, {}),
        generatedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.error("Auto-sync public report failed:", e);
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

      // Auto-sync public report
      syncPublicStudentReport(studentId);
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



  const moveDailySession = async (sessionId: string, date: string, sourceOwnerId: string, targetOwnerId: string) => {
    if (!authContextUser || !sessionId || !sourceOwnerId || !targetOwnerId) return;

    try {
      // Check if old structure exists
      const dayRef = ref(db, `users/${sourceOwnerId}/dailySessions/${date}`);
      const daySnap = await get(dayRef);
      if (daySnap.exists()) {
        const val = daySnap.val();
        let sessionDataToMove = null;
        let isOldStructure = false;

        if (val && typeof val === 'object' && 'date' in val) {
          sessionDataToMove = val;
          isOldStructure = true;
        } else if (val && typeof val === 'object' && val[sessionId]) {
          sessionDataToMove = val[sessionId];
        }

        if (sessionDataToMove) {
          const updatedSessionData = { ...sessionDataToMove, ownerId: targetOwnerId, id: sessionId };

          const updates: any = {};
          updates[`users/${targetOwnerId}/dailySessions/${date}/${sessionId}`] = updatedSessionData;
          if (isOldStructure) {
            updates[`users/${sourceOwnerId}/dailySessions/${date}`] = null;
          } else {
            updates[`users/${sourceOwnerId}/dailySessions/${date}/${sessionId}`] = null;
          }

          await update(ref(db), updates);

          await logActivity(
            'MOVE_SESSION',
            authContextUser.uid,
            `تم نقل حصة بتاريخ ${date} من المستخدم ${sourceOwnerId} إلى ${targetOwnerId}`,
            sessionId,
            sessionDataToMove.sessionType,
            authContextUser.displayName || 'Unknown',
            authContextUser.group || 'غير محدد',
            targetOwnerId
          );

          toast({
            title: "تم النقل بنجاح",
            description: "تم نقل الحصة إلى حساب الشيخ المحدد.",
          });
        }
      }
    } catch (error) {
      console.error("Error moving session:", error);
      toast({
        title: "خطأ في النقل",
        description: "حدث خطأ أثناء نقل الحصة.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const bulkUpdateStudents = async (updates: Record<string, Partial<Student>>) => {
    if (!authContextUser) return;
    try {
      const fbUpdates: Record<string, any> = {};
      const timestamp = new Date().toISOString();

      // 1. التحديث الفوري للحالة المحلية
      setStudents(prev => {
        const next = prev.map(s => {
          if (updates[s.id]) {
            return { ...s, ...updates[s.id], updatedAt: new Date() };
          }
          return s;
        });
        saveEncrypted('students', next);
        return next;
      });

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

      const isOnline = isEffectiveOnline();
      const sanitizedUpdates = sanitizeData(fbUpdates);

      if (isOnline) {
        try {
          await executeWithTimeout(update(ref(db), sanitizedUpdates), 2500);
          toast({
            title: "✅ تم التحديث بنجاح",
            description: `تم تحديث بيانات ${Object.keys(updates).length} طالب(ة).`,
          });
        } catch {
          await queueOfflineMutation({
            type: 'UPDATE',
            path: '',
            payload: sanitizedUpdates,
            description: `تحديث جماعي لـ ${Object.keys(updates).length} طالب`,
            ownerId: authContextUser.uid,
            authorUid: authContextUser.uid
          });
          toast({
            title: "💾 تم التحديث محلياً",
            description: "تم حفظ التحديث محلياً بسبب بطء الاتصال، وستُرفع التحديثات تلقائياً.",
          });
        }
      } else {
        await queueOfflineMutation({
          type: 'UPDATE',
          path: '',
          payload: sanitizedUpdates,
          description: `تحديث جماعي لـ ${Object.keys(updates).length} طالب`,
          ownerId: authContextUser.uid,
          authorUid: authContextUser.uid
        });
        toast({
          title: "💾 تم التحديث محلياً بنجاح",
          description: "تم حفظ التحديثات أوفلاين وستُرفع تلقائياً عند استقرار الإنترنت.",
        });
      }
    } catch (error: any) {
      console.error("Bulk update error:", error);
      toast({
        title: "❌ خطأ في التحديث",
        description: error.message || "حدث خطأ أثناء محاولة تحديث البيانات.",
        variant: "destructive"
      });
    }
  };

  const setSurahEvaluation = async (studentId: string, surahId: number, evaluation: import('@/lib/types').SurahEvaluation) => {
    if (!authContextUser) return;

    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const studentOwnerId = student.ownerId;
    const studentProgressMap = { ...(surahProgress[studentId] || {}) };
    const currentEntry = studentProgressMap[surahId] || { status: 0 };

    // Set completion date when moving from 0 to >0
    const needsCompletedAt = (evaluation !== 'لم يحفظ' && currentEntry.status === 0);

    // Map evaluation to internal status for scoring/legacy compatibility
    let status: 0 | 1 | 2 = 0;
    if (evaluation === 'ممتاز') status = 2;
    else if (evaluation === 'لم يحفظ') status = 0;
    else status = 1;

    const newEntry: import('@/lib/types').SurahMasteryEntry = {
      status,
      evaluation,
      completedAt: needsCompletedAt ? new Date().toISOString() : (currentEntry.completedAt || undefined)
    };

    // 1. التحديث الفوري للحالة المحلية
    if (evaluation === 'لم يحفظ') {
      delete studentProgressMap[surahId];
    } else {
      studentProgressMap[surahId] = newEntry;
    }

    setSurahProgress(prev => {
      const next = { ...prev, [studentId]: studentProgressMap };
      saveEncrypted('surahProgress', next);
      return next;
    });

    const isOnline = isEffectiveOnline();
    const progressPath = `users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`;

    if (isOnline) {
      try {
        if (evaluation === 'لم يحفظ') {
          await executeWithTimeout(remove(ref(db, progressPath)), 2500);
        } else {
          await executeWithTimeout(set(ref(db, progressPath), newEntry), 2500);
        }

        logActivity(
          'UPDATE_SURAH_PROGRESS',
          authContextUser.uid,
          `تقييم السورة (ID: ${surahId}): ${evaluation}`,
          studentId,
          student?.fullName || 'غير معروف',
          authContextUser.displayName || 'Sheikh',
          student?.groupName || 'غير محدد',
          studentOwnerId
        );

        toast({
          title: `✅ تم تقييم السورة`,
          description: `التقييم: ${evaluation}`,
        });
      } catch {
        await queueOfflineMutation({
          type: evaluation === 'لم يحفظ' ? 'REMOVE' : 'SET',
          path: progressPath,
          payload: evaluation === 'لم يحفظ' ? null : newEntry,
          description: `تقييم سورة (${surahId}) للطالب ${student.fullName}`,
          ownerId: studentOwnerId,
          authorUid: authContextUser.uid
        });
        toast({
          title: `💾 تم التقييم محلياً`,
          description: `تم حفظ تقييم السورة محلياً بسبب ضعف الشبكة، وسيتم رفعه تلقائياً.`,
        });
      }
    } else {
      await queueOfflineMutation({
        type: evaluation === 'لم يحفظ' ? 'REMOVE' : 'SET',
        path: progressPath,
        payload: evaluation === 'لم يحفظ' ? null : newEntry,
        description: `تقييم سورة (${surahId}) للطالب ${student.fullName}`,
        ownerId: studentOwnerId,
        authorUid: authContextUser.uid
      });
      toast({
        title: `💾 تم التقييم أوفلاين`,
        description: `تم حفظ تقييم السورة محلياً (${evaluation}) وسيُرفع عند الاتصال بالإنترنت.`,
      });
    }

    // Auto-sync public student report
    if (isOnline) {
      syncPublicStudentReport(studentId);
    }
  };

  const migrateSurahDataToEvaluationSystem = async () => {
    if (!authContextUser || !isSuperAdmin) return;

    toast({ title: "⏳ بدء هجرة البيانات..." });
    let migratedCount = 0;

    try {
      for (const studentId in surahProgress) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        const studentOwnerId = student.ownerId;
        const progress = surahProgress[studentId];

        for (const surahIdStr in progress) {
          const surahId = parseInt(surahIdStr);
          const entry = progress[surahId];

          // Skip if already has evaluation or admin5Evaluation
          if (entry.evaluation) continue;

          // Legacy check for admin5Evaluation
          // @ts-ignore - we are migrating away from this
          const legacyEval = entry.admin5Evaluation;
          if (legacyEval) {
            await update(ref(db, `users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`), {
              evaluation: legacyEval
            });
            migratedCount++;
            continue;
          }

          let newEvaluation: import('@/lib/types').SurahEvaluation | null = null;
          if (entry.status === 2) newEvaluation = 'ممتاز';
          else if (entry.status === 1) newEvaluation = 'جيد';
          else if (entry.status === 0) newEvaluation = 'لم يحفظ';

          if (newEvaluation) {
            await update(ref(db, `users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`), {
              evaluation: newEvaluation
            });
            migratedCount++;
          }
        }
      }

      toast({ title: `✅ تمت الهجرة بنجاح`, description: `تم تحديث ${migratedCount} حصة.` });
    } catch (error) {
      console.error("Migration error:", error);
      toast({ title: "❌ فشلت الهجرة", variant: "destructive" });
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
      setSurahEvaluation,
      bulkUpdateSurahStatus,
      addPayment,
      updatePaymentStatus,
      bulkAddOrUpdatePayments,
      saveSettings,
      generateDemoData,
      shareStudentRecord,
      saveAdminLog,
      deleteAdminLog,
      getNextTicketNumber,
      transferStudent,
      saveMeeting: async (meetingData, meetingId) => {
        if (!authContextUser || !isPrivileged) return;
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
        if (!authContextUser || !isPrivileged) return;
        const meetingRef = ref(db, `meetings/${meetingId}`);
        await remove(meetingRef);
        toast({ title: '🗑️ تم حذف الاجتماع' });
      },
      deleteMeetingSuggestion: async (meetingId, suggestionId) => {
        if (!authContextUser || !isPrivileged) return;
        const suggestionRef = ref(db, `meetings/${meetingId}/suggestions/${suggestionId}`);
        await remove(suggestionRef);
        toast({ title: '🗑️ تم حذف المقترح' });
      },
      meetings,
      internalNotifications,
      addInternalNotification,
      markNotificationAsRead,
      sendManagementMessage,
      markManagementMessageAsRead,
      moveDailySession,
      restoreSessions,
      updateSheikhGroupSettings,
      weeklyOutcomes,
      saveWeeklyOutcome,
      deleteMultipleDailyReports,
      migrateSurahDataToEvaluationSystem,
      selectedGroup,
      setSelectedGroup
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


