
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
      
      if (!data) {
          setStudents([]);
          setDailySessions({});
          setDailyReports({});
          setSurahProgress({});
          setLoading(false);
          return;
      }
      
      if (isAdmin) {
        // Aggregate data from all users for the admin
        let allStudents: Student[] = [];
        let allSessions: Record<string, DailySession> = {};
        let allReports: Record<string, DailyReport> = {};
        let allSurahProgress: Record<string, number[]> = {};

        Object.entries(data).forEach(([uid, userData]: [string, any]) => {
            if (userData.students) {
                const userStudents = Object.values(userData.students).map((s: any) => ({
                    ...s,
                    ownerId: uid, // Attach owner's UID to each student
                    birthDate: new Date(s.birthDate),
                    registrationDate: new Date(s.registrationDate),
                    updatedAt: new Date(s.updatedAt)
                }));
                allStudents.push(...userStudents);
            }
            if(userData.dailySessions) Object.assign(allSessions, userData.dailySessions);
            if(userData.dailyReports) Object.assign(allReports, userData.dailyReports);
            if(userData.surahProgress) Object.assign(allSurahProgress, userData.surahProgress);
        });
        
        setStudents(allStudents);
        setDailySessions(allSessions);
        setDailyReports(allReports);
        setSurahProgress(allSurahProgress);
      } else {
        // Regular user, just set their own data
        const storedStudents = data.students ? Object.values(data.students).map((s: any) => ({
            ...s,
            ownerId: user.uid, // Attach owner's UID
            birthDate: new Date(s.birthDate),
            registrationDate: new Date(s.registrationDate),
            updatedAt: new Date(s.updatedAt)
        })) : [];
        setStudents(storedStudents);
        setDailySessions(data.dailySessions || {});
        setDailyReports(data.dailyReports || {});
        setSurahProgress(data.surahProgress || {});
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

  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => {
    if (!user) return;
    const studentId = uuidv4();
    const newStudent: Student = {
      ...studentData,
      id: studentId,
      ownerId: user.uid,
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    const studentRef = ref(db, `users/${user.uid}/students/${studentId}`);
    set(studentRef, {...newStudent, birthDate: newStudent.birthDate.toISOString(), registrationDate: newStudent.registrationDate.toISOString(), updatedAt: newStudent.updatedAt.toISOString() });
  };
  
  const importStudents = (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>[]) => {
     if (!user) return;
     newStudents.forEach(s => addStudent(s));
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    const studentToUpdate = students.find(s => s.id === studentId);
    if (!studentToUpdate || !studentToUpdate.ownerId) return;
    
    const ownerUid = studentToUpdate.ownerId;
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
      const studentToDelete = students.find(s => s.id === studentId);
      if (!studentToDelete || !studentToDelete.ownerId) return;
      
      const ownerUid = studentToDelete.ownerId;
      const studentRef = ref(db, `users/${ownerUid}/students/${studentId}`);
      remove(studentRef);
  }
  
  const deleteAllStudents = () => {
      if (!user) return;
      // This action should only be performed by a user on their own data.
      // Admin should delete users one by one or via a dedicated admin function.
      const studentsRef = ref(db, `users/${user.uid}/students`);
      remove(studentsRef);
  }

  const addDailySession = (session: DailySession) => {
    if (!user) return;
    // We assume sessions are owned by the current user. Admin can see all, but only writes for their own group if they have one.
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
    const student = students.find(s => s.id === studentId);
    if (!student || !student.ownerId) return;
    const ownerUid = student.ownerId;
    
    let newProgress: number[] = [];
    const studentProgress = surahProgress[studentId] ? [...surahProgress[studentId]] : [];
    const surahIndex = studentProgress.indexOf(surahId);

    if (surahIndex > -1) {
        studentProgress.splice(surahIndex, 1);
    } else {
        studentProgress.push(surahId);
    }
    newProgress = studentProgress;
    
    const surahProgressRef = ref(db, `users/${ownerUid}/surahProgress/${studentId}`);
    set(surahProgressRef, newProgress);
    
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
