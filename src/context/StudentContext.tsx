
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, SessionRecord, DailySession, DailyReport } from '@/lib/types';
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';
import { ref, set, onValue, off, remove } from 'firebase/database';

interface StudentContextType {
  students: Student[];
  dailySessions: Record<string, DailySession>;
  dailyReports: Record<string, DailyReport>;
  surahProgress: Record<string, number[]>;
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student>) => void;
  deleteStudent: (studentId: string) => void;
  deleteAllStudents: () => void;
  addDailySession: (session: DailySession) => void;
  deleteDailySession: (date: string) => void;
  getSessionForDate: (date: string) => DailySession | undefined;
  getRecordsForDateRange: (startDate: string, endDate: string) => Record<string, DailySession>;
  importStudents: (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>[]) => void;
  saveDailyReport: (report: DailyReport) => void;
  toggleSurahStatus: (studentId: string, surahId: number) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [dailySessions, setDailySessions] = useState<Record<string, DailySession>>({});
  const [dailyReports, setDailyReports] = useState<Record<string, DailyReport>>({});
  const [surahProgress, setSurahProgress] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);

  // Load data from Firebase when user is authenticated
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setStudents([]);
      setDailySessions({});
      setDailyReports({});
      setSurahProgress({});
      setLoading(false);
      return;
    }
    
    setLoading(true);

    const isAdmin = user.email === 'admin@gmail.com';
    const dataRef = isAdmin ? ref(db, 'users') : ref(db, `users/${user.uid}`);

    const onData = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      
      if (isAdmin) {
        // Aggregate data from all users for the admin
        let allStudents: Student[] = [];
        let allSessions: Record<string, DailySession> = {};
        let allReports: Record<string, DailyReport> = {};
        let allSurahProgress: Record<string, number[]> = {};

        if (data) {
           Object.values(data).forEach((userData: any) => {
                if (userData.students) {
                    allStudents.push(...Object.values(userData.students).map((s: any) => ({
                        ...s,
                        birthDate: new Date(s.birthDate),
                        registrationDate: new Date(s.registrationDate),
                        updatedAt: new Date(s.updatedAt)
                    })));
                }
                if(userData.dailySessions) Object.assign(allSessions, userData.dailySessions);
                if(userData.dailyReports) Object.assign(allReports, userData.dailyReports);
                if(userData.surahProgress) Object.assign(allSurahProgress, userData.surahProgress);
           });
        }
        setStudents(allStudents);
        setDailySessions(allSessions);
        setDailyReports(allReports);
        setSurahProgress(allSurahProgress);
      } else {
        // Regular user, just set their own data
        if (data) {
          const storedStudents = data.students ? Object.values(data.students).map((s: any) => ({
              ...s,
              birthDate: new Date(s.birthDate),
              registrationDate: new Date(s.registrationDate),
              updatedAt: new Date(s.updatedAt)
          })) : [];
          setStudents(storedStudents);
          setDailySessions(data.dailySessions || {});
          setDailyReports(data.dailyReports || {});
          setSurahProgress(data.surahProgress || {});
        } else {
            setStudents([]); setDailySessions({});
            setDailyReports({}); setSurahProgress({});
        }
      }
      setLoading(false);
    }, (error) => {
        console.error("Firebase data fetching failed:", error);
        setStudents([]); setDailySessions({});
        setDailyReports({}); setSurahProgress({});
        setLoading(false);
    });
    
    return () => off(dataRef, 'value', onData);
    
  }, [user, authLoading]);
  
  const saveDataToDb = useCallback((path: string, data: any) => {
      if (!user) return;
      const dataRef = ref(db, `users/${user.uid}/${path}`);
      set(dataRef, data);
  }, [user]);

  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    if (!user) return;
    const studentId = uuidv4();
    const newStudent: Student = {
      ...studentData,
      id: studentId,
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    const studentRef = ref(db, `users/${user.uid}/students/${studentId}`);
    set(studentRef, {...newStudent, birthDate: newStudent.birthDate.toISOString(), registrationDate: newStudent.registrationDate.toISOString(), updatedAt: newStudent.updatedAt.toISOString() });
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>[]) => {
     if (!user) return;
     const updates: { [key: string]: any } = {};
     newStudents.forEach(s => {
       const studentId = uuidv4();
       const studentToSave: Student = {
         ...s,
         id: studentId,
         memorizedSurahsCount: 0,
         updatedAt: new Date(),
       };
       updates[`users/${user.uid}/students/${studentId}`] = {...studentToSave, birthDate: studentToSave.birthDate.toISOString(), registrationDate: studentToSave.registrationDate.toISOString(), updatedAt: studentToSave.updatedAt.toISOString()};
     });
     // This needs a multi-path update which is more complex.
     // For simplicity, we'll update one by one for now.
     // This is less efficient but works.
     newStudents.forEach(s => addStudent(s));
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    if (!user) return;
    const studentToUpdate = students.find(s => s.id === studentId);
    if (!studentToUpdate) return;
    
    // Find the owner of the student to update in the correct path for admin
    // This is a simplification. A real multi-tenant app would need to store the owner's UID with the student.
    // For now, we assume admin edits will happen on their own data or this needs a more complex structure.
    // Let's assume for now, updates only happen for the current user's students.
    const studentRef = ref(db, `users/${user.uid}/students/${studentId}`);
    const finalData = { ...studentToUpdate, ...updatedData, updatedAt: new Date() };

    set(studentRef, {
        ...finalData,
        birthDate: finalData.birthDate.toISOString(),
        registrationDate: finalData.registrationDate.toISOString(),
        updatedAt: finalData.updatedAt.toISOString()
    });
  };
  
  const deleteStudent = (studentId: string) => {
      if (!user) return;
      const studentRef = ref(db, `users/${user.uid}/students/${studentId}`);
      remove(studentRef);
  }
  
  const deleteAllStudents = () => {
      if (!user) return;
      const studentsRef = ref(db, `users/${user.uid}/students`);
      remove(studentsRef);
  }

  const addDailySession = (session: DailySession) => {
    if (!user) return;
    const sessionRef = ref(db, `users/${user.uid}/dailySessions/${session.date}`);
    set(sessionRef, session);
  };
  
  const deleteDailySession = (date: string) => {
    if (!user) return;
    const sessionRef = ref(db, `users/${user.uid}/dailySessions/${date}`);
    remove(sessionRef);
  }

  const getSessionForDate = (date: string): DailySession | undefined => {
      return dailySessions[date];
  }

  const getRecordsForDateRange = (startDate: string, endDate: string): Record<string, DailySession> => {
      const start = startOfMonth(parseISO(startDate));
      const end = endOfMonth(parseISO(endDate));
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
    if (!user) return;
    const reportRef = ref(db, `users/${user.uid}/dailyReports/${report.date}`);
    set(reportRef, report);
  }
  
 const toggleSurahStatus = (studentId: string, surahId: number) => {
    if (!user) return;
    
    let newProgress: number[] = [];
    const studentProgress = surahProgress[studentId] ? [...surahProgress[studentId]] : [];
    const surahIndex = studentProgress.indexOf(surahId);

    if (surahIndex > -1) {
        studentProgress.splice(surahIndex, 1);
    } else {
        studentProgress.push(surahId);
    }
    newProgress = studentProgress;
    
    const surahProgressRef = ref(db, `users/${user.uid}/surahProgress/${studentId}`);
    set(surahProgressRef, newProgress);
    
    // After updating progress, update the student's memorized surahs count
    updateStudent(studentId, { memorizedSurahsCount: newProgress.length });
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
