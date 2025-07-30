

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, DailySession, DailyReport } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from '@/lib/firebase';
import { ref, set, onValue, off, remove, DatabaseReference } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';


interface StudentContextType {
  students: Student[];
  dailySessions: Record<string, DailySession>;
  dailyReports: Record<string, DailyReport>;
  surahProgress: Record<string, number[]>;
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student>, ownerId?: string) => void;
  deleteStudent: (studentId: string, ownerId?: string) => void;
  deleteAllStudents: () => void;
  addDailySession: (session: DailySession, ownerId?: string) => void;
  deleteDailySession: (date: string, ownerId?: string) => void;
  getSessionForDate: (date: string) => DailySession | undefined;
  getRecordsForDateRange: (startDate: string, endDate: string) => Record<string, DailySession>;
  importStudents: (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => void;
  saveDailyReport: (report: DailyReport) => void;
  toggleSurahStatus: (studentId: string, surahId: number, ownerId?: string) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user: authContextUser, authLoading, isAdmin } = useAuth();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [dailySessions, setDailySessions] = useState<Record<string, DailySession>>({});
  const [dailyReports, setDailyReports] = useState<Record<string, DailyReport>>({});
  const [surahProgress, setSurahProgress] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let dataRef: DatabaseReference | null = null;
    let valueCallback: any = null;

    if (authLoading) {
      setLoading(true);
      return;
    }
  
    if (authContextUser) {
      setLoading(true);
      const dataPath = isAdmin ? 'users' : `users/${authContextUser.uid}`;
      dataRef = ref(db, dataPath);
      
      const handleValueChange = (snapshot: any) => {
          if (!snapshot.exists()) {
              setStudents([]); setDailySessions({}); setDailyReports({}); setSurahProgress({});
              setLoading(false);
              return;
          }

          const data = snapshot.val();
          let combinedStudents: Student[] = [];
          let combinedSessions: Record<string, DailySession> = {};
          let combinedReports: Record<string, DailyReport> = {};
          let combinedSurahProgress: Record<string, number[]> = {};

          const processUserData = (userData: any, uid: string) => {
               if (userData.students) {
                  const userStudents = Object.entries(userData.students).map(([id, s]: [string, any]) => ({
                      ...s,
                      id,
                      ownerId: uid,
                      birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
                      registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
                      updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
                  }));
                  combinedStudents.push(...userStudents);
              }
              if (userData.dailySessions) {
                  Object.entries(userData.dailySessions).forEach(([date, session]) => {
                       if (!combinedSessions[date]) combinedSessions[date] = { date, sessionType: (session as any).sessionType, records: [] };
                       if((session as any).records) {
                          (session as any).records.forEach((r: any) => combinedSessions[date].records.push(r));
                       }
                  });
              }
              if(userData.dailyReports) Object.assign(combinedReports, userData.dailyReports);
              if(userData.surahProgress) Object.assign(combinedSurahProgress, userData.surahProgress);
          }

          if (isAdmin) {
              Object.keys(data).forEach(uid => {
                  processUserData(data[uid], uid);
              });
          } else {
              processUserData(data, authContextUser.uid);
          }

          setStudents(combinedStudents);
          setDailySessions(combinedSessions);
          setDailyReports(combinedReports);
          setSurahProgress(combinedSurahProgress);
          setLoading(false);
      };

      valueCallback = onValue(dataRef, handleValueChange, (error) => {
          console.error("Firebase read failed: " + error.message);
          setLoading(false);
      });

    } else {
      setStudents([]);
      setDailySessions({});
      setDailyReports({});
      setSurahProgress({});
      setLoading(false);
    }
  
    return () => {
      if (dataRef && valueCallback) {
        off(dataRef, 'value', valueCallback);
      }
    };
  }, [authContextUser, authLoading, isAdmin]);


  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => {
    if (!authContextUser || isAdmin) return;

    const studentId = uuidv4();
    const newStudent: Student = {
      ...studentData,
      id: studentId,
      ownerId: authContextUser.uid,
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
    set(studentRef, {
        ...newStudent, 
        birthDate: newStudent.birthDate.toISOString(), 
        registrationDate: newStudent.registrationDate.toISOString(), 
        updatedAt: newStudent.updatedAt.toISOString() 
    });
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => {
     if (!authContextUser || isAdmin) return;
     newStudents.forEach(s => addStudent(s));
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>, ownerId?: string) => {
    if (!authContextUser || isAdmin) return;
    const studentOwnerId = ownerId || authContextUser.uid;
    
    const originalStudent = students.find(s => s.id === studentId);
    if (!originalStudent) return;
    
    const studentRef = ref(db, `users/${studentOwnerId}/students/${studentId}`);
    const finalData = { ...originalStudent, ...updatedData, updatedAt: new Date() };

    set(studentRef, {
        ...finalData,
        birthDate: finalData.birthDate.toISOString(),
        registrationDate: finalData.registrationDate.toISOString(),
        updatedAt: finalData.updatedAt.toISOString()
    });
  };
  
  const deleteStudent = (studentId: string, ownerId?: string) => {
      if (!authContextUser || isAdmin) return;
      const studentOwnerId = ownerId || authContextUser.uid;
      const studentRef = ref(db, `users/${studentOwnerId}/students/${studentId}`);
      remove(studentRef);
  }
  
  const deleteAllStudents = () => {
      if (!authContextUser || isAdmin) return;
      const userStudentsRef = ref(db, `users/${authContextUser.uid}/students`);
      remove(userStudentsRef);
  }

  const addDailySession = (session: DailySession, ownerId?: string) => {
    if (!authContextUser || isAdmin) return;
    const targetOwnerId = ownerId || authContextUser.uid;
    const sessionRef = ref(db, `users/${targetOwnerId}/dailySessions/${session.date}`);
    set(sessionRef, session);
  };
  
  const deleteDailySession = (date: string, ownerId?: string) => {
    if (!authContextUser || isAdmin) return;
    const targetOwnerId = ownerId || authContextUser.uid;
    const sessionRef = ref(db, `users/${targetOwnerId}/dailySessions/${date}`);
    remove(sessionRef);
  }

  const getSessionForDate = (date: string): DailySession | undefined => {
      return dailySessions[date];
  }

  const getRecordsForDateRange = (startDate: string, endDate: string): Record<string, DailySession> => {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const filteredSessions: Record<string, DailySession> = {};

       Object.entries(dailySessions).forEach(([date, session]) => {
           try {
                if(isWithinInterval(parseISO(date), { start, end })) {
                    filteredSessions[date] = session;
                }
           } catch(e) {
                console.warn(`Invalid date found in records: ${date}`);
           }
       });
       return filteredSessions;
  }
  
  const saveDailyReport = (report: DailyReport) => {
    if (!authContextUser || isAdmin) return;
    const reportRef = ref(db, `users/${report.authorId}/dailyReports/${report.date}`);
    set(reportRef, report);
  }
  
 const toggleSurahStatus = (studentId: string, surahId: number, ownerId?: string) => {
    if (!authContextUser || isAdmin) return;
    const studentOwnerId = ownerId || authContextUser.uid;

    const studentProgressList = surahProgress[studentId] ? [...surahProgress[studentId]] : [];
    const surahIndex = studentProgressList.indexOf(surahId);

    if (surahIndex > -1) {
        studentProgressList.splice(surahIndex, 1);
    } else {
        studentProgressList.push(surahId);
    }
    
    const surahProgressRef = ref(db, `users/${studentOwnerId}/surahProgress/${studentId}`);
    set(surahProgressRef, studentProgressList);
    
    updateStudent(studentId, { memorizedSurahsCount: studentProgressList.length }, studentOwnerId);
  }

  return (
    <StudentContext.Provider value={{ students, dailySessions, dailyReports, loading, surahProgress, addStudent, updateStudent, deleteStudent, deleteAllStudents, addDailySession, deleteDailySession, getSessionForDate, getRecordsForDateRange, importStudents, saveDailyReport, toggleSurahStatus }}>
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
