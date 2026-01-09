

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, DailySession, DailyReport, Payment, AppSettings, SurahMastery, PointsConfig, Reward, BadgeConfig, DailyRecord } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';
import { ref, set, onValue, off, remove, DatabaseReference } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_POINTS_CONFIG: PointsConfig = {
    attendance: { 'حاضر': 3, 'متأخر': 1, 'تعويض': 1.5, 'غائب': -2 },
    evaluation: { 'ممتاز': 3, 'جيد': 2, 'متوسط': 1, 'ضعيف': 0 },
    behavior: { 'هادئ': 2, 'متوسط': 1, 'غير منضبط': -1 },
    review: { 'completed': 1 },
    surah: { 'memorized': 20, 'mastered': 50 }
};

const DEFAULT_REWARDS: Reward[] = [
    { id: 'weekly_reader', name: 'لقب قارئ الأسبوع', cost: 500, icon: "Star", description: 'تعزيز الثقة بالنفس أمام الزملاء.' },
    { id: 'review_exempt', name: 'إعفاء من تسميع مراجعة', cost: 1000, icon: "Medal", description: 'مكافأة على الحفظ المتقن السابق.' },
    { id: 'leader_for_day', name: 'قائد الفوج لليوم', cost: 800, icon: "UserCheck", description: 'تنمية المهارات القيادية لدى الطالب.' },
    { id: 'physical_gift', name: 'هدية عينية (مصحف/قلم)', cost: 3000, icon: "Gift", description: 'تشجيع مادي ملموس.' },
];

const DEFAULT_BADGES: BadgeConfig[] = [
    { id: 'mastery_king', name: 'ملك الإتقان', icon: 'Crown', threshold: 1000, metric: 'masteryScore' },
];

const TIER_PRICES = {
    firstPayment: { 'فئة الأكابر': 2500, 'فئة الأصاغر': 2000 },
    renewal: { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 },
};

const DEFAULT_SETTINGS: AppSettings = {
    seasonStartDate: new Date(new Date().getFullYear(), 8, 1).toISOString(), // Default to Sep 1st of current year
    prices: TIER_PRICES,
    points: DEFAULT_POINTS_CONFIG,
    rewards: DEFAULT_REWARDS,
    badges: DEFAULT_BADGES
};


interface StudentContextType {
  students: Student[];
  dailySessions: Record<string, DailySession[]>;
  dailyReports: { [date: string]: { [reportId: string]: DailyReport } };
  surahProgress: Record<string, SurahMastery>;
  payments: Payment[];
  settings: AppSettings;
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student>, ownerId: string) => void;
  deleteStudent: (studentId: string, ownerId: string) => void;
  deleteAllStudents: () => void;
  addDailySession: (session: DailySession) => void;
  deleteDailySession: (sessionId: string) => void;
  getSessionsForDate: (date: string) => DailySession[];
  getRecordsForDateRange: (startDate: string, endDate: string) => Record<string, DailySession[]>;
  importStudents: (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => void;
  saveDailyReport: (report: Omit<DailyReport, 'id'>, reportIdToUpdate?: string) => Promise<void>;
  deleteDailyReport: (reportId: string, date: string) => Promise<void>;
  toggleSurahStatus: (studentId: string, surahId: number) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  deletePayment: (paymentId: string) => Promise<void>;
  saveSettings: (newSettings: AppSettings) => Promise<void>;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user: authContextUser, loading: authLoading, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [dailySessions, setDailySessions] = useState<Record<string, DailySession[]>>({});
  const [dailyReports, setDailyReports] = useState<{ [date: string]: { [reportId: string]: DailyReport } }>({});
  const [surahProgress, setSurahProgress] = useState<Record<string, SurahMastery>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
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
      return;
    }

    setLoading(true);

    let dataRef: DatabaseReference;
    let listener: () => void;

    if (isSuperAdmin) {
      dataRef = ref(db, 'users');
      listener = onValue(dataRef, (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          return;
        }
        const allUsersData = snapshot.val();
        let allStudents: Student[] = [];
        let allSessions: Record<string, DailySession[]> = {};
        let allReports: { [date: string]: { [reportId: string]: DailyReport } } = {};
        let allProgress: Record<string, SurahMastery> = {};
        let allPayments: Payment[] = [];
        let finalSettings: AppSettings = DEFAULT_SETTINGS;

        // Super admin sees their own settings if they exist, otherwise default.
        if (allUsersData[authContextUser.uid]?.settings) {
            finalSettings = {
                ...DEFAULT_SETTINGS,
                ...allUsersData[authContextUser.uid].settings
            }
        }

        for (const uid in allUsersData) {
          const userData = allUsersData[uid];
          if (userData.students) {
            const userStudents = Object.entries(userData.students).map(([id, s]: [string, any]) => ({
              ...s, id, ownerId: uid, groupName: userData.profile?.group || 'غير محدد',
              birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
              registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
              updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
            }));
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
        }
        setStudents(allStudents);
        setDailySessions(allSessions);
        setDailyReports(allReports);
        setSurahProgress(allProgress);
        setPayments(allPayments);
        setSettingsState(finalSettings);
        setLoading(false);
      }, (error) => {
        console.error(`Firebase read failed for super_admin: ${error.message}`);
        setLoading(false);
      });

    } else {
      dataRef = ref(db, `users/${authContextUser.uid}`);
      listener = onValue(dataRef, (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          setStudents([]); setDailySessions({}); setDailyReports({});
          setSurahProgress({}); setPayments([]); setSettingsState(DEFAULT_SETTINGS);
          return;
        }
        const data = snapshot.val();
        let userStudents: Student[] = [];
        if (data.students) {
          userStudents = Object.entries(data.students).map(([id, s]: [string, any]) => ({
            ...s, id, ownerId: authContextUser.uid,
            birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
            registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
            updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
          }));
        }
        const paymentsArray = data.payments ? Object.entries(data.payments).map(([id, p]) => ({ id, ...(p as Omit<Payment, 'id'>) })) : [];
        const userSettings = data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS;
        
        setStudents(userStudents);
        setDailySessions(data.dailySessions || {});
        setDailyReports(data.dailyReports || {});
        setSurahProgress(data.surahProgress || {});
        setPayments(paymentsArray);
        setSettingsState(userSettings);
        setLoading(false);
      }, (error) => {
        console.error(`Firebase read failed for user ${authContextUser.uid}: ${error.message}`);
        setLoading(false);
      });
    }

    return () => {
      off(dataRef, 'value', listener);
    };
  }, [authContextUser, authLoading, isSuperAdmin]);


  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => {
    if (!authContextUser) return;

    const studentId = uuidv4();
    const newStudent: Omit<Student, 'id'> & {id: string} = {
      ...studentData,
      id: studentId,
      ownerId: authContextUser.uid,
      memorizedSurahsCount: 0,
      subscriptionTier: studentData.subscriptionTier || 'فئة الأصاغر',
      updatedAt: new Date(),
    };
    const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
    set(studentRef, {
        ...newStudent, 
        birthDate: newStudent.birthDate.toISOString(), 
        registrationDate: newStudent.registrationDate.toISOString(), 
        updatedAt: newStudent.updatedAt.toISOString() 
    });
    
    // Initialize surah progress for the new student
    const surahProgressRef = ref(db, `users/${authContextUser.uid}/surahProgress/${studentId}`);
    set(surahProgressRef, {});
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => {
     if (!authContextUser) return;
     newStudents.forEach(s => addStudent(s));
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>, ownerId: string) => {
    if (!authContextUser) return;
    
    // Super admin cannot edit student data directly.
    if (isSuperAdmin || authContextUser.uid !== ownerId) return;

    const originalStudent = (students ?? []).find(s => s.id === studentId);
    if (!originalStudent) return;
    
    const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
    const finalData = { ...originalStudent, ...updatedData, updatedAt: new Date() };

    set(studentRef, {
        ...finalData,
        birthDate: finalData.birthDate.toISOString(),
        registrationDate: finalData.registrationDate.toISOString(),
        updatedAt: finalData.updatedAt.toISOString()
    });
  };
  
  const deleteStudent = (studentId: string, ownerId: string) => {
      if (!authContextUser) return;
      if (isSuperAdmin || authContextUser.uid !== ownerId) return;
      const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
      remove(studentRef);
  }
  
  const deleteAllStudents = () => {
      if (!authContextUser || isSuperAdmin) return;
      const userStudentsRef = ref(db, `users/${authContextUser.uid}/students`);
      remove(userStudentsRef);
  }

  const addDailySession = (session: DailySession) => {
    if (!authContextUser || isSuperAdmin) return;
    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${session.date}/${session.id}`);
    set(sessionRef, session);
  };
  
  const deleteDailySession = (sessionId: string) => {
    if (!authContextUser || isSuperAdmin) return;
    const date = sessionId.substring(0, 10); // Extract YYYY-MM-DD from session ID
    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${date}/${sessionId}`);
    remove(sessionRef);
  }

  const getSessionsForDate = (date: string): DailySession[] => {
      const sessionsForDate = (dailySessions ?? {})[date];
      return sessionsForDate ? Object.values(sessionsForDate) : [];
  }

  const getRecordsForDateRange = (startDate: string, endDate: string): Record<string, DailySession[]> => {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const filteredSessions: Record<string, DailySession[]> = {};

       Object.entries(dailySessions ?? {}).forEach(([date, sessions]) => {
           try {
                if(isWithinInterval(parseISO(date), { start, end })) {
                    filteredSessions[date] = Object.values(sessions);
                }
           } catch(e) {
                console.warn(`Invalid date found in records: ${date}`);
           }
       });
       return filteredSessions;
  }
  
  const saveDailyReport = async (reportData: Omit<DailyReport, 'id'>, reportIdToUpdate?: string) => {
    if (!authContextUser || isSuperAdmin) throw new Error("User cannot save reports");
    
    const reportId = reportIdToUpdate || Date.now().toString();
    
    const reportToSave: DailyReport = {
        ...reportData,
        id: reportId,
    };

    const reportRef = ref(db, `users/${authContextUser.uid}/dailyReports/${reportToSave.date}/${reportId}`);
    await set(reportRef, reportToSave);
  }

  const deleteDailyReport = async (reportId: string, date: string) => {
      if (!authContextUser || isSuperAdmin) throw new Error("User cannot delete reports");
      const reportDbRef = ref(db, `users/${authContextUser.uid}/dailyReports/${date}/${reportId}`);
      await remove(reportDbRef);
  }
  
 const toggleSurahStatus = (studentId: string, surahId: number) => {
    if (!authContextUser || isSuperAdmin) return;

    const studentOwnerId = students.find(s => s.id === studentId)?.ownerId;
    if(authContextUser.uid !== studentOwnerId) return;

    const studentProgressMap = { ...(surahProgress[studentId] || {}) };
    const currentStatus = studentProgressMap[surahId] || 0; // 0: not memorized, 1: memorized, 2: mastered

    const nextStatus = (currentStatus + 1) % 3;
    studentProgressMap[surahId] = nextStatus;
    
    const pointsMemorized = settings.points.surah['memorized'];
    const pointsMastered = settings.points.surah['mastered'];

    // Point logic
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


    if (nextStatus === 0) {
        delete studentProgressMap[surahId];
    }

    const surahProgressRef = ref(db, `users/${authContextUser.uid}/surahProgress/${studentId}`);
    set(surahProgressRef, studentProgressMap);
    
    const memorizedCount = Object.values(studentProgressMap).filter(status => status > 0).length;
    updateStudent(studentId, { memorizedSurahsCount: memorizedCount }, authContextUser.uid);
  }

  const addPayment = async (paymentData: Omit<Payment, 'id'>) => {
    if (!authContextUser || isSuperAdmin) throw new Error("User cannot add payments");
    const studentOwnerId = students.find(s => s.id === paymentData.studentId)?.ownerId;
    if(authContextUser.uid !== studentOwnerId) return;

    const paymentId = uuidv4();
    const newPayment: Payment = {
        ...paymentData,
        id: paymentId,
    };
    const paymentRef = ref(db, `users/${authContextUser.uid}/payments/${paymentId}`);
    await set(paymentRef, newPayment);
  };
  
  const deletePayment = async (paymentId: string) => {
    if (!authContextUser || isSuperAdmin) throw new Error("User cannot delete payments");

    const payment = payments.find(p => p.id === paymentId);
    if(!payment) return;
    const studentOwnerId = students.find(s => s.id === payment.studentId)?.ownerId;
    if(authContextUser.uid !== studentOwnerId) return;

    const paymentRef = ref(db, `users/${authContextUser.uid}/payments/${paymentId}`);
    await remove(paymentRef);
  }

  const saveSettings = async (newSettings: AppSettings) => {
     if (!authContextUser) throw new Error("User not authenticated");
     const settingsRef = ref(db, `users/${authContextUser.uid}/settings`);
     await set(settingsRef, newSettings);
  };

  return (
    <StudentContext.Provider value={{ students, dailySessions, dailyReports, loading, surahProgress, payments, settings, addStudent, updateStudent, deleteStudent, deleteAllStudents, addDailySession, deleteDailySession, getSessionsForDate, getRecordsForDateRange, importStudents, saveDailyReport, deleteDailyReport, toggleSurahStatus, addPayment, deletePayment, saveSettings }}>
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
