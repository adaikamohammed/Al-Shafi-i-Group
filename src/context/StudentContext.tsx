
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, DailySession, DailyReport, AppUser } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
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
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student>) => void;
  deleteStudent: (studentId: string) => void;
  deleteAllStudents: () => void;
  addDailySession: (session: DailySession) => void;
  deleteDailySession: (date: string) => void;
  getSessionForDate: (date: string) => DailySession | undefined;
  getRecordsForDateRange: (startDate: string, endDate: string) => Record<string, DailySession>;
  importStudents: (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => void;
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

    const handleValueChange = (snapshot: any) => {
        const userData = snapshot.val();
        
        const loadedStudents = userData?.students ? Object.values(userData.students).map((s: any) => ({
            ...s,
            id: s.id || uuidv4(),
            ownerId: user.uid,
            birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
            registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
            updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
        })) : [];

        setStudents(loadedStudents);
        setDailySessions(userData?.dailySessions || {});
        setDailyReports(userData?.dailyReports || {});
        setSurahProgress(userData?.surahProgress || {});
        setLoading(false);
    };

    onValue(userRef, handleValueChange, (error) => {
      console.error("Firebase read failed: " + error.message);
      setLoading(false);
    });

    return () => {
      off(userRef, 'value', handleValueChange);
    };
  }, [user, authLoading]);

  const getOwnerUid = useCallback(() => {
    if (!user) {
      console.error("Action requires a logged-in user.");
      return null;
    }
    return user.uid;
  }, [user]);

  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;

    const studentId = uuidv4();
    const newStudent: Student = {
      ...studentData,
      id: studentId,
      ownerId: ownerUid,
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    const studentRef = ref(db, `users/${ownerUid}/students/${studentId}`);
    set(studentRef, {
        ...newStudent, 
        birthDate: newStudent.birthDate.toISOString(), 
        registrationDate: newStudent.registrationDate.toISOString(), 
        updatedAt: newStudent.updatedAt.toISOString() 
    });
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => {
     if (!user) return;
     newStudents.forEach(s => addStudent(s));
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;
    
    const studentToUpdate = students.find(s => s.id === studentId);
    if (!studentToUpdate) return;
    
    const studentRef = ref(db, `users/${ownerUid}/students/${studentId}`);
    const finalData = { ...studentToUpdate, ...updatedData, updatedAt: new Date() };

    set(studentRef, {
        ...finalData,
        birthDate: finalData.birthDate.toISOString(),
        registrationDate: finalData.registrationDate.toISOString(),
        updatedAt: finalData.updatedAt.toISOString()
    });
  };
  
  const deleteStudent = (studentId: string) => {
      const ownerUid = getOwnerUid();
      if (!ownerUid) return;
      const studentRef = ref(db, `users/${ownerUid}/students/${studentId}`);
      remove(studentRef);
  }
  
  const deleteAllStudents = () => {
      const ownerUid = getOwnerUid();
      if (!ownerUid) return;
      const studentsRef = ref(db, `users/${ownerUid}/students`);
      remove(studentsRef);
  }

  const addDailySession = (session: DailySession) => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;
    const sessionRef = ref(db, `users/${ownerUid}/dailySessions/${session.date}`);
    set(sessionRef, session);
  };
  
  const deleteDailySession = (date: string) => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;
    const sessionRef = ref(db, `users/${ownerUid}/dailySessions/${date}`);
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
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;
    const reportRef = ref(db, `users/${ownerUid}/dailyReports/${report.date}`);
    set(reportRef, report);
  }
  
 const toggleSurahStatus = (studentId: string, surahId: number) => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;

    const studentProgress = surahProgress[studentId] ? [...surahProgress[studentId]] : [];
    const surahIndex = studentProgress.indexOf(surahId);

    if (surahIndex > -1) {
        studentProgress.splice(surahIndex, 1);
    } else {
        studentProgress.push(surahId);
    }
    
    const surahProgressRef = ref(db, `users/${ownerUid}/surahProgress/${studentId}`);
    set(surahProgressRef, studentProgress);
    
    updateStudent(studentId, { memorizedSurahsCount: studentProgress.length });
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
