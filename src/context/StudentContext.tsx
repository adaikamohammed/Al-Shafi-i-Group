

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, DailySession, DailyReport, Payment, AppSettings, SurahMastery, PointsConfig, Reward, BadgeConfig, DailyRecord, Covenant, PreRegistration } from '@/lib/types';
import { isWithinInterval, parseISO, isValid } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '@/lib/firebase';
import { ref, set, onValue, off, remove, DatabaseReference, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';

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
  preRegistrations: PreRegistration[];
  dailySessions: Record<string, Record<string, DailySession>>;
  dailyReports: { [date: string]: { [reportId: string]: DailyReport } };
  surahProgress: Record<string, SurahMastery>;
  payments: Payment[];
  settings: AppSettings;
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'> & { photoFile?: File | null }) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student> & { photoFile?: File | null }, ownerId: string) => void;
  deleteStudent: (studentId: string, ownerId: string) => void;
  deleteAllStudents: () => void;
  addDailySession: (session: DailySession) => void;
  deleteDailySession: (sessionId: string) => void;
  getSessionsForDay: (date: string) => DailySession[];
  getSessionById: (sessionId: string) => DailySession | undefined;
  getRecordsForDateRange: (startDate: string, endDate: string) => Record<string, DailySession[]>;
  importStudents: (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => void;
  importPreRegistrations: (newPreRegs: Omit<PreRegistration, 'id'>[]) => void;
  updatePreRegistration: (regId: string, data: Partial<PreRegistration> & { photoFile?: File | null }, isEditing: boolean) => Promise<void>;
  deleteAllPreRegistrations: () => void;
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
  const [preRegistrations, setPreRegistrations] = useState<PreRegistration[]>([]);
  const [dailySessions, setDailySessions] = useState<Record<string, Record<string, DailySession>>>({});
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
      setPreRegistrations([]);
      return;
    }

    setLoading(true);

    let usersRef: DatabaseReference;
    let preRegsRef: DatabaseReference;
    let usersListener: () => void;
    let preRegsListener: () => void;

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

    // Listener for pre_registrations
    preRegsRef = ref(db, 'pre_registrations');
    preRegsListener = onValue(preRegsRef, (snapshot) => {
        const data = snapshot.val();
        const preRegsArray: PreRegistration[] = data ? Object.entries(data).map(([id, r]) => processPreRegData({ id, ...(r as any) })) : [];
        setPreRegistrations(preRegsArray);
    }, (error) => {
        console.error(`Firebase read failed for pre_registrations: ${error.message}`);
    });


    if (isSuperAdmin) {
      usersRef = ref(db, 'users');
      usersListener = onValue(usersRef, (snapshot) => {
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
      usersRef = ref(db, `users/${authContextUser.uid}`);
      usersListener = onValue(usersRef, (snapshot) => {
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
              processStudentData({ ...s, id }, authContextUser.uid)
          );
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
      off(usersRef, 'value', usersListener);
      off(preRegsRef, 'value', preRegsListener);
    };
  }, [authContextUser, authLoading, isSuperAdmin]);


  const addStudent = async (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'> & { photoFile?: File | null }) => {
    if (!authContextUser) return;

    const studentId = uuidv4();
    let photoURL = '';

    if (studentData.photoFile) {
        const imageRef = storageRef(storage, `student_photos/${studentId}`);
        await uploadBytes(imageRef, studentData.photoFile);
        photoURL = await getDownloadURL(imageRef);
    }
    
    const { photoFile, ...restOfStudentData } = studentData;

    const newStudent: Omit<Student, 'id'> & {id: string} = {
      ...(restOfStudentData as any),
      id: studentId,
      ownerId: authContextUser.uid,
      memorizedSurahsCount: 0,
      subscriptionTier: studentData.subscriptionTier || 'فئة الأصاغر',
      updatedAt: new Date(),
      covenants: [],
      photoURL: photoURL
    };
    const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
    set(studentRef, {
        ...newStudent, 
        birthDate: newStudent.birthDate.toISOString(), 
        registrationDate: newStudent.registrationDate.toISOString(), 
        updatedAt: newStudent.updatedAt.toISOString(),
        covenants: newStudent.covenants || null // Use null for empty array
    });
    
    const surahProgressRef = ref(db, `users/${authContextUser.uid}/surahProgress/${studentId}`);
    set(surahProgressRef, {});
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => {
     if (!authContextUser) return;
     newStudents.forEach(s => addStudent(s));
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
        photoURL: finalPhotoURL,
        birthDate: data.birthDate instanceof Date ? data.birthDate.toISOString() : data.birthDate,
    };
    
    if (isEditing) {
        finalData.requestedAt = data.requestedAt instanceof Date ? data.requestedAt.toISOString() : data.requestedAt;
    } else {
        finalData.requestedAt = new Date().toISOString();
        finalData.status = 'مرشح';
    }

    const regRef = ref(db, `pre_registrations/${regId}`);
    await update(regRef, finalData);

    toast({
        title: isEditing ? '✅ تم التحديث' : '✅ تم التسجيل',
        description: `تم تحديث بيانات ${data.fullName} بنجاح.`
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

  const updateStudent = async (studentId: string, updatedData: Partial<Student> & { photoFile?: File | null }, ownerId: string) => {
    if (!authContextUser) return;
    
    if (isSuperAdmin || authContextUser.uid !== ownerId) return;

    const originalStudent = (students ?? []).find(s => s.id === studentId);
    if (!originalStudent) return;
    
    let finalPhotoURL = originalStudent.photoURL;

    if (updatedData.photoFile) {
        const imageRef = storageRef(storage, `student_photos/${studentId}`);
        await uploadBytes(imageRef, updatedData.photoFile);
        finalPhotoURL = await getDownloadURL(imageRef);
    }
    
    const { photoFile, ...restOfUpdatedData } = updatedData;

    const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
    const finalData = { ...originalStudent, ...restOfUpdatedData, photoURL: finalPhotoURL, updatedAt: new Date() };

    const covenantsObject = (finalData.covenants || []).reduce((acc, cov) => {
      acc[cov.id] = cov;
      return acc;
    }, {} as Record<string, Covenant>);

    set(studentRef, {
        ...finalData,
        birthDate: finalData.birthDate.toISOString(),
        registrationDate: finalData.registrationDate.toISOString(),
        updatedAt: finalData.updatedAt.toISOString(),
        covenants: Object.keys(covenantsObject).length > 0 ? covenantsObject : null
    });
  };
  
  const deleteStudent = async (studentId: string, ownerId: string) => {
      if (!authContextUser) return;
      if (isSuperAdmin || authContextUser.uid !== ownerId) return;
      const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
      await remove(studentRef);

      // Delete photo from storage
      try {
        const imageRef = storageRef(storage, `student_photos/${studentId}`);
        await deleteObject(imageRef);
      } catch(error: any) {
        if(error.code !== 'storage/object-not-found') {
            console.error("Error deleting student photo:", error);
        }
      }
  }
  
  const deleteAllStudents = () => {
      if (!authContextUser || isSuperAdmin) return;
      
      students.forEach(student => {
          if (student.ownerId === authContextUser.uid) {
              deleteStudent(student.id, student.ownerId);
          }
      });
  }

  const addDailySession = (session: DailySession) => {
    if (!authContextUser || isSuperAdmin) return;
    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${session.date}/${session.id}`);
    set(sessionRef, session);
  };
  
  const deleteDailySession = (sessionId: string) => {
    if (!authContextUser || isSuperAdmin) return;
    const date = sessionId.substring(0, 10);
    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${date}/${sessionId}`);
    remove(sessionRef);
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
                if(isWithinInterval(parseISO(date), { start, end })) {
                    filteredSessions[date] = Object.values(sessionsOnDay);
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
    const currentStatus = studentProgressMap[surahId] || 0;

    const nextStatus = (currentStatus + 1) % 3;
    studentProgressMap[surahId] = nextStatus;
    
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


    if (nextStatus === 0) {
        delete studentProgressMap[surahId];
    }

    const surahProgressRef = ref(db, `users/${authContextUser.uid}/surahProgress/${studentId}`);
    set(surahProgressRef, surahProgressMap);
    
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
    <StudentContext.Provider value={{ students, preRegistrations, dailySessions, dailyReports, loading, surahProgress, payments, settings, addStudent, updateStudent, deleteStudent, deleteAllStudents, addDailySession, deleteDailySession, getSessionsForDay, getSessionById, getRecordsForDateRange, importStudents, importPreRegistrations, updatePreRegistration, deleteAllPreRegistrations, saveDailyReport, deleteDailyReport, toggleSurahStatus, addPayment, deletePayment, saveSettings }}>
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

  


