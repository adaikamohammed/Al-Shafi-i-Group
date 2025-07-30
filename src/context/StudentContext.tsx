
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, DailySession, DailyReport } from '@/lib/types';
import { isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from '@/lib/firebase';
import { ref, set, onValue, off, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';

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
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [dailySessions, setDailySessions] = useState<Record<string, DailySession>>({});
  const [dailyReports, setDailyReports] = useState<Record<string, DailyReport>>({});
  const [surahProgress, setSurahProgress] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged is the key to ensure we have the user object before fetching data.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoading(true);

      if (currentUser) {
        let dbRef;
        // Determine the database path based on user role
        if (currentUser.email === 'admin@gmail.com') {
          dbRef = ref(db, 'users');
        } else {
          dbRef = ref(db, `users/${currentUser.uid}`);
        }

        onValue(dbRef, (snapshot) => {
          const data = snapshot.val();
          
          if (currentUser.email === 'admin@gmail.com') {
            // Admin user logic: aggregate data from all users
            let allStudents: Student[] = [];
            let allSessions: Record<string, DailySession> = {};
            let allReports: Record<string, DailyReport> = {};
            let allSurahProgress: Record<string, number[]> = {};

            if (data) {
                Object.entries(data).forEach(([uid, userData]: [string, any]) => {
                    if (userData.students) {
                        const userStudents: Student[] = Object.values(userData.students).map((s: any) => ({
                            ...s,
                            ownerId: uid, // IMPORTANT: Store the owner's UID
                            birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
                            registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
                            updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
                        }));
                        allStudents.push(...userStudents);
                    }
                    if (userData.dailySessions) Object.assign(allSessions, userData.dailySessions);
                    if (userData.dailyReports) Object.assign(allReports, userData.dailyReports);
                    if (userData.surahProgress) Object.assign(allSurahProgress, userData.surahProgress);
                });
            }
            setStudents(allStudents);
            setDailySessions(allSessions);
            setDailyReports(allReports);
            setSurahProgress(allSurahProgress);
          } else {
             // Regular user logic: get data from their own node
             const storedStudents = data?.students ? Object.values(data.students).map((s: any) => ({
                ...s,
                ownerId: currentUser.uid,
                birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
                registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
                updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
            })) : [];
            setStudents(storedStudents);
            setDailySessions(data?.dailySessions || {});
            setDailyReports(data?.dailyReports || {});
            setSurahProgress(data?.surahProgress || {});
          }
          setLoading(false);
        }, (error) => {
          console.error("Firebase data fetching failed:", error);
          setLoading(false);
        });

        // The function to detach the listener will be the return value of onAuthStateChanged
        return () => off(dbRef);
      } else {
        // No user is logged in
        setStudents([]);
        setDailySessions({});
        setDailyReports({});
        setSurahProgress({});
        setLoading(false);
      }
    });

    // Cleanup the subscription on component unmount
    return () => unsubscribe();
  }, []); // The empty dependency array ensures this effect runs only once

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
      if (!user || user.email === 'admin@gmail.com') return; // Prevent admin from deleting all students of one user
      const studentsRef = ref(db, `users/${user.uid}/students`);
      remove(studentsRef);
  }

  const addDailySession = (session: DailySession) => {
    if (!user) return;

    // Determine the correct owner UID
    let ownerUid;
    if (user.email === 'admin@gmail.com') {
      // For admin, find the owner from the first student in the record
      const firstStudentId = session.records[0]?.studentId;
      if (firstStudentId) {
          ownerUid = students.find(s => s.id === firstStudentId)?.ownerId;
      }
      // If no records (e.g., holiday) or student not found, we can't determine owner, so we bail.
      if (!ownerUid) return;
    } else {
      // For regular users, it's their own UID
      ownerUid = user.uid;
    }
    
    const sessionRef = ref(db, `users/${ownerUid}/dailySessions/${session.date}`);
    set(sessionRef, session);
  };
  
  const deleteDailySession = (date: string) => {
    const sessionToDelete = dailySessions[date];
    if (!sessionToDelete) return;

    let ownerUid;
    const firstStudentId = sessionToDelete.records[0]?.studentId;

    if (firstStudentId) {
        ownerUid = students.find(s => s.id === firstStudentId)?.ownerId;
    } else if (user) {
        // This is likely a holiday added by the current user. Only they can delete it.
        // Admin cannot delete holidays without a student context.
        ownerUid = user.uid;
    }
    
    if (!ownerUid) return; // Cannot determine owner.
    
    // Check if the current user has permission
    if (user && (user.uid === ownerUid || user.email === 'admin@gmail.com')) {
        const sessionRef = ref(db, `users/${ownerUid}/dailySessions/${date}`);
        remove(sessionRef);
    }
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
