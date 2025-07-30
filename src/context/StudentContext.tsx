

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, SessionRecord, DailySession, DailyReport, SurahProgress } from '@/lib/types';
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
    const userRef = ref(db, `users/${user.uid}`);

    const onData = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storedStudents = (data.students || []).map((s: any) => ({
            ...s,
            birthDate: new Date(s.birthDate),
            registrationDate: new Date(s.registrationDate),
            updatedAt: new Date(s.updatedAt)
        }));
        setStudents(storedStudents);
        setDailySessions(data.dailySessions || {});
        setDailyReports(data.dailyReports || {});
        setSurahProgress(data.surahProgress || {});
      } else {
          // Data is null, which means no data exists for this user yet.
          // This is a valid state, not an error.
          setStudents([]);
          setDailySessions({});
          setDailyReports({});
          setSurahProgress({});
      }
      setLoading(false);
    }, (error) => {
        // Handle potential errors during data fetching
        console.error("Firebase data fetching failed:", error);
        setStudents([]);
        setDailySessions({});
        setDailyReports({});
        setSurahProgress({});
        setLoading(false); // Ensure loading stops even on error
    });
    
    // Detach listener on cleanup
    return () => off(userRef, 'value', onData);
    
  }, [user, authLoading]);
  
  const saveDataToDb = useCallback((path: string, data: any) => {
      if (!user) return;
      const dataRef = ref(db, `users/${user.uid}/${path}`);
      set(dataRef, data);
  }, [user]);
  
  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    const newStudent: Student = {
      ...studentData,
      id: uuidv4(),
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    const updatedStudents = [...students, newStudent];
    setStudents(updatedStudents);
    saveDataToDb('students', updatedStudents.map(s => ({...s, birthDate: s.birthDate.toISOString(), registrationDate: s.registrationDate.toISOString(), updatedAt: s.updatedAt.toISOString() })));
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>[]) => {
     const studentsToSave: Student[] = newStudents.map(s => ({
         ...s,
         id: uuidv4(),
         memorizedSurahsCount: 0,
         updatedAt: new Date(),
     }));
     const updatedStudents = [...students, ...studentsToSave];
     setStudents(updatedStudents);
     saveDataToDb('students', updatedStudents.map(s => ({...s, birthDate: s.birthDate.toISOString(), registrationDate: s.registrationDate.toISOString(), updatedAt: s.updatedAt.toISOString() })));
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    const updatedStudents = students.map(s =>
        s.id === studentId ? { ...s, ...updatedData, updatedAt: new Date() } : s
      );
    setStudents(updatedStudents);
    saveDataToDb('students', updatedStudents.map(s => ({...s, birthDate: s.birthDate.toISOString(), registrationDate: s.registrationDate.toISOString(), updatedAt: s.updatedAt.toISOString() })));
  };
  
  const deleteStudent = (studentId: string) => {
      const updatedStudents = students.filter(s => s.id !== studentId);
      setStudents(updatedStudents);
      saveDataToDb('students', updatedStudents.map(s => ({...s, birthDate: s.birthDate.toISOString(), registrationDate: s.registrationDate.toISOString(), updatedAt: s.updatedAt.toISOString() })));
  }
  
  const deleteAllStudents = () => {
      setStudents([]);
      if (user) {
        remove(ref(db, `users/${user.uid}/students`));
      }
  }

  const addDailySession = (session: DailySession) => {
    const updatedSessions = {
        ...dailySessions,
        [session.date]: session
    };
    setDailySessions(updatedSessions);
    saveDataToDb('dailySessions', updatedSessions);
  };
  
  const deleteDailySession = (date: string) => {
    const newSessions = { ...dailySessions };
    delete newSessions[date];
    setDailySessions(newSessions);
    saveDataToDb('dailySessions', newSessions);
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
    const updatedReports = {
        ...dailyReports,
        [report.date]: report
    };
    setDailyReports(updatedReports);
    saveDataToDb('dailyReports', updatedReports);
  }
  
 const toggleSurahStatus = (studentId: string, surahId: number) => {
    let newProgress: number[] = [];
    const studentProgress = surahProgress[studentId] ? [...surahProgress[studentId]] : [];
    const surahIndex = studentProgress.indexOf(surahId);
    if (surahIndex > -1) {
        studentProgress.splice(surahIndex, 1);
    } else {
        studentProgress.push(surahId);
    }
    newProgress = studentProgress;
    
    const updatedSurahProgress = { ...surahProgress, [studentId]: newProgress };
    setSurahProgress(updatedSurahProgress);
    saveDataToDb('surahProgress', updatedSurahProgress);
    
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
