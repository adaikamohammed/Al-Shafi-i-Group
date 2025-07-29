

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, SessionRecord, DailySession, DailyReport, SurahProgress } from '@/lib/types';
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Helper functions to interact with localStorage
const getLocalStorage = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  const storedValue = localStorage.getItem(key);
  try {
     return storedValue ? JSON.parse(storedValue) : defaultValue;
  } catch (error) {
    console.error("Error parsing JSON from localStorage", key, error);
    return defaultValue;
  }
};

const setLocalStorage = (key: string, value: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
};


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

  // Load data from localStorage when user is authenticated
  useEffect(() => {
    if (!authLoading) {
      if (user) {
        const storedStudents = getLocalStorage(`students_${user.uid}`, []).map((s: any) => ({
            ...s,
            birthDate: new Date(s.birthDate),
            registrationDate: new Date(s.registrationDate),
            updatedAt: new Date(s.updatedAt)
        }));
        const storedSessions = getLocalStorage(`dailySessions_${user.uid}`, {});
        const storedReports = getLocalStorage(`dailyReports_${user.uid}`, {});
        const storedSurahProgress = getLocalStorage(`surahProgress_${user.uid}`, {});
        
        setStudents(storedStudents);
        setDailySessions(storedSessions);
        setDailyReports(storedReports);
        setSurahProgress(storedSurahProgress);
      } else {
        // Clear data if user logs out
        setStudents([]);
        setDailySessions({});
        setDailyReports({});
        setSurahProgress({});
      }
      setLoading(false);
    }
  }, [user, authLoading]);
  
  // Save students to localStorage whenever they change
  useEffect(() => {
    if (user && !loading) {
      setLocalStorage(`students_${user.uid}`, students);
    }
  }, [students, user, loading]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (user && !loading) {
      setLocalStorage(`dailySessions_${user.uid}`, dailySessions);
    }
  }, [dailySessions, user, loading]);

  // Save reports to localStorage whenever they change
  useEffect(() => {
    if (user && !loading) {
        setLocalStorage(`dailyReports_${user.uid}`, dailyReports);
    }
  }, [dailyReports, user, loading]);
  
    // Save surah progress to localStorage whenever it changes
  useEffect(() => {
    if (user && !loading) {
        setLocalStorage(`surahProgress_${user.uid}`, surahProgress);
    }
  }, [surahProgress, user, loading]);


  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    const newStudent: Student = {
      ...studentData,
      id: uuidv4(),
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    setStudents(prev => [...prev, newStudent]);
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>[]) => {
     const studentsToSave: Student[] = newStudents.map(s => ({
         ...s,
         id: uuidv4(),
         memorizedSurahsCount: 0,
         updatedAt: new Date(),
     }));
     setStudents(prev => [...prev, ...studentsToSave]);
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    setStudents(prev =>
      prev.map(s =>
        s.id === studentId ? { ...s, ...updatedData, updatedAt: new Date() } : s
      )
    );
  };
  
  const deleteStudent = (studentId: string) => {
      setStudents(prev => prev.filter(s => s.id !== studentId));
  }
  
  const deleteAllStudents = () => {
      setStudents([]);
  }

  const addDailySession = (session: DailySession) => {
    setDailySessions(prev => ({
        ...prev,
        [session.date]: session
    }));
  };
  
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
    setDailyReports(prev => ({
        ...prev,
        [report.date]: report
    }));
  }
  
 const toggleSurahStatus = (studentId: string, surahId: number) => {
    let newProgress: number[] = [];
    
    setSurahProgress(prev => {
        const studentProgress = prev[studentId] ? [...prev[studentId]] : [];
        const surahIndex = studentProgress.indexOf(surahId);
        if (surahIndex > -1) {
            studentProgress.splice(surahIndex, 1);
        } else {
            studentProgress.push(surahId);
        }
        newProgress = studentProgress;
        return { ...prev, [studentId]: studentProgress };
    });
    
    // After updating progress, update the student's memorized surahs count
    updateStudent(studentId, { memorizedSurahsCount: newProgress.length });
  }

  return (
    <StudentContext.Provider value={{ students, dailySessions, dailyReports, loading, surahProgress, addStudent, updateStudent, deleteStudent, deleteAllStudents, addDailySession, getSessionForDate, getRecordsForDateRange, importStudents, saveDailyReport, toggleSurahStatus }}>
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
