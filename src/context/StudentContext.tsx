

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import type { Student, DailySession, DailyReport, Payment, AppSettings, SurahMastery, PointsConfig, Reward, BadgeConfig, DailyRecord, Covenant, PreRegistration, AppUser, PaymentStatus, SurahMasteryEntry, AdminLog, ActivityLog, Meeting, MeetingSuggestion, InternalNotification, WeeklyOutcome } from '@/lib/types';
import { isWithinInterval, parseISO, isValid, isAfter, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '@/lib/firebase';
import { ref, set, push, onValue, off, remove, DatabaseReference, update, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { sanitizeData } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';

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
          ...data.profile
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
        setStudents(val ? Object.entries(val).map(([id, st]: [string, any]) =>
          processStudentData({ ...st, id }, authContextUser.uid, (role === 'sheikh' ? authContextUser.group : st.groupName) as string)
        ) : []);
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
      }, handleError);
      onValue(reportsRef, (s: any) => setDailyReports(s.val() || {}), handleError);
      onValue(progressRef, (s: any) => setSurahProgress(s.val() || {}), handleError);
      onValue(paymentsRef, (s: any) => {
        const val = s.val();
        setPayments(val ? Object.entries(val).map(([id, p]) => ({ id, ...(p as Omit<Payment, 'id'>) })) : []);
      }, handleError);
      onValue(adminLogsRef, (s: any) => {
        const val = s.val();
        setAdminLogs(val ? Object.entries(val).map(([id, l]) => ({ id, ...(l as Omit<AdminLog, 'id'>) })) : []);
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
      onValue(settingsRef, (s: any) => setSettingsState(mergeSettings(s.val())), handleError);
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
      birthDate: newStudent.birthDate instanceof Date ? newStudent.birthDate.toISOString() : newStudent.birthDate || null,
      registrationDate: newStudent.registrationDate instanceof Date ? newStudent.registrationDate.toISOString() : newStudent.registrationDate,
      updatedAt: newStudent.updatedAt instanceof Date ? newStudent.updatedAt.toISOString() : newStudent.updatedAt,
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
      birthDate: sanitizedData.birthDate instanceof Date ? sanitizedData.birthDate.toISOString() : sanitizedData.birthDate || null,
      registrationDate: sanitizedData.registrationDate instanceof Date ? sanitizedData.registrationDate.toISOString() : sanitizedData.registrationDate,
      updatedAt: sanitizedData.updatedAt instanceof Date ? sanitizedData.updatedAt.toISOString() : sanitizedData.updatedAt,
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

    // Auto-sync public student report
    syncPublicStudentReport(studentId);
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

  const addDailySession = async (session: DailySession, targetOwnerId?: string): Promise<void> => {
    // Allow if user is authenticated. If superAdmin, they MUST provide targetOwnerId (or use their own if debugging, but mainly for others)
    if (!authContextUser) return;

    // Use targetOwnerId if provided (for Admins), otherwise use current user's UID
    const ownerId = (isSuperAdmin || isManagement) && targetOwnerId ? targetOwnerId : authContextUser.uid;

    try {
      // Clean up old top-level keys if the date path has the old structure
      const dayRef = ref(db, `users/${ownerId}/dailySessions/${session.date}`);
      const daySnap = await get(dayRef);
      if (daySnap.exists()) {
        const val = daySnap.val();
        if (val && typeof val === 'object' && 'date' in val) {
          // It's the old structure! Delete the entire date node first to clean up the top-level keys
          await remove(dayRef);
        }
      }

      // الحفظ في Firebase
      const sessionRef = ref(db, `users/${ownerId}/dailySessions/${session.date}/${session.id}`);
      await set(sessionRef, sanitizeData({ ...session, ownerId, createdAt: session.createdAt || new Date().toISOString() })); // Ensure ownerId and createdAt are set in the record

      // تسجيل النشاط
      await logActivity(
        'ADD_SESSION',
        authContextUser.uid,
        `تم تسجيل حصة جديدة بتاريخ: ${session.date} ${targetOwnerId ? `(نيابة عن شيخ)` : ''}`,
        session.id,
        session.sessionType,
        authContextUser.displayName || 'Unknown',
        authContextUser.group || 'غير محدد',
        ownerId // The owner of the data
      );

      // Auto-sync public reports for all students in this session
      const records = session.records || [];
      records.forEach(r => {
        if (r.studentId) {
          syncPublicStudentReport(r.studentId);
        }
      });

      // ─── Auto Push Notification: check for 3 consecutive absences or 3 لم يحفظ in 7 days ───
      // Run in background without blocking session save
      setTimeout(async () => {
        try {
          const allSessionsSnap = await get(ref(db, `users/${ownerId}/dailySessions`));
          if (!allSessionsSnap.exists()) return;
          const allSessions = allSessionsSnap.val();

          // Collect last 14 days of records per student
          const today = new Date();
          const checkDays: string[] = [];
          for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            checkDays.push(d.toISOString().split('T')[0]);
          }
          const last7Days = checkDays.slice(0, 7);

          records.forEach((r: any) => {
            if (!r.studentId) return;
            const studentName = students.find(s => s.id === r.studentId)?.fullName || r.studentId;

            // Build history across 14 days
            const attendanceHistory: string[] = [];
            const memHistory: { date: string; value: string }[] = [];

            checkDays.forEach(dateStr => {
              const daySess = allSessions[dateStr];
              if (!daySess) return;
              Object.values(daySess as Record<string, any>).forEach((sess: any) => {
                if (!sess?.records) return;
                const sessRecords = Array.isArray(sess.records) ? sess.records : Object.values(sess.records);
                const rec = (sessRecords as any[]).find((x: any) => x.studentId === r.studentId);
                if (!rec) return;
                if (rec.attendance) attendanceHistory.push(rec.attendance);
                if (rec.memorization && !rec.review) {
                  memHistory.push({ date: dateStr, value: rec.memorization });
                }
              });
            });

            // Check: 3 consecutive absences
            let consecutiveAbsences = 0;
            let maxConsecutive = 0;
            attendanceHistory.forEach(a => {
              if (a === 'غائب' || a === 'غياب') {
                consecutiveAbsences++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveAbsences);
              } else {
                consecutiveAbsences = 0;
              }
            });

            // Check: 3 لم يحفظ in last 7 days
            const notMemLast7 = memHistory.filter(m => last7Days.includes(m.date) && m.value === 'لم يحفظ').length;

            if (maxConsecutive >= 3) {
              fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  targetUid: ownerId,
                  title: `⚠️ تنبيه غياب متكرر`,
                  body: `الطالب "${studentName}" غاب لـ ${maxConsecutive} حصص متتالية. يُرجى التواصل مع ولي أمره.`
                })
              }).catch(console.error);
            } else if (notMemLast7 >= 3) {
              fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  targetUid: ownerId,
                  title: `📖 تنبيه تراجع الحفظ`,
                  body: `الطالب "${studentName}" لم يحفظ درسه ${notMemLast7} مرات في الأسبوع الماضي. يُرجى متابعته.`
                })
              }).catch(console.error);
            }
          });
        } catch (e) {
          // Silent fail – don't block UX for notification errors
          console.warn('Push notification check failed silently:', e);
        }
      }, 2000);
    } catch (error) {
      console.error("Error saving session:", error);
      throw error;
    }
  };

  const deleteDailySession = (sessionId: string, date?: string, targetOwnerId?: string) => {
    if (!authContextUser || !sessionId) return;

    // Determine the path owner
    const ownerId = (isSuperAdmin || isManagement) && targetOwnerId ? targetOwnerId : authContextUser.uid;

    // استخدام التاريخ الممرر أو استخراجه من الـ ID كخيار احتياطي
    const targetDate = date || sessionId.substring(0, 10);

    const dayRef = ref(db, `users/${ownerId}/dailySessions/${targetDate}`);

    // Attempt to find session in local state for logging
    const sessionsForDate = dailySessions[targetDate] || {};
    const sessionToDelete = Object.values(sessionsForDate).find(s => s.id === sessionId);

    get(dayRef).then((snap: any) => {
      if (snap.exists()) {
        const val = snap.val();
        if (val && typeof val === 'object') {
          if ('date' in val) {
            // Old structure - delete the whole day node
            remove(dayRef).then(() => {
              logActivity(
                'DELETE_SESSION',
                authContextUser.uid,
                `تم حذف حصة بتاريخ: ${targetDate} ${targetOwnerId ? '(نيابة عن شيخ)' : ''}`,
                sessionId,
                sessionToDelete?.sessionType || 'غير معروف',
                authContextUser.displayName || 'Unknown',
                authContextUser.group || 'غير محدد',
                ownerId
              );
            });
          } else {
            // New structure - delete just the session id
            const sessionRef = ref(db, `users/${ownerId}/dailySessions/${targetDate}/${sessionId}`);
            remove(sessionRef).then(() => {
              logActivity(
                'DELETE_SESSION',
                authContextUser.uid,
                `تم حذف حصة بتاريخ: ${targetDate} ${targetOwnerId ? '(نيابة عن شيخ)' : ''}`,
                sessionId,
                sessionToDelete?.sessionType || 'غير معروف',
                authContextUser.displayName || 'Unknown',
                authContextUser.group || 'غير محدد',
                ownerId
              );
            });
          }
        }
      }
    });
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

    // Old point system removed as requested by user. 
    // Qualitative 6-tier evaluation now handles progress tracking.

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

      // Auto-sync public reports for all updated students
      studentIds.forEach(id => {
        syncPublicStudentReport(id);
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

    // Allow if user is the owner, or if user is privileged
    if (!isPrivileged && authContextUser.uid !== student.ownerId) {
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
        { name: "الأستاذة ميمونه", group: "فوج 17", email: "admin17@gmail.com" },
        { name: "الأستاذة حياة", group: "فوج 18", email: "admin18@gmail.com" },
        { name: "فوج 1 إبتدائي", group: "فوج 19", email: "admin19@gmail.com" },
        { name: "الشيخ عبد الكريم ترممو", group: "فوج 20", email: "admin20@gmail.com" },
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

    const ownerId = isPrivileged ? logData.details.ownerId || authContextUser.uid : authContextUser.uid;
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

    const progressRef = ref(db, `users/${studentOwnerId}/surahProgress/${studentId}/${surahId}`);

    if (evaluation === 'لم يحفظ') {
      await remove(progressRef);
    } else {
      await set(progressRef, newEntry);
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

    // Auto-sync public student report
    syncPublicStudentReport(studentId);
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


