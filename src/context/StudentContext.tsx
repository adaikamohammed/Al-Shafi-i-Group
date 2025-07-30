

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, DailySession, DailyReport } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '@/lib/firebase';
import { ref, set, onValue, off, remove, DatabaseReference } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

interface StudentContextType {
  students: Student[];
  dailySessions: Record<string, DailySession>;
  dailyReports: { [date: string]: { [reportId: string]: DailyReport } };
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
  saveDailyReport: (report: Omit<DailyReport, 'id'>, imageFile?: File | null) => Promise<void>;
  toggleSurahStatus: (studentId: string, surahId: number) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user: authContextUser, authLoading } = useAuth();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [dailySessions, setDailySessions] = useState<Record<string, DailySession>>({});
  const [dailyReports, setDailyReports] = useState<{ [date: string]: { [reportId: string]: DailyReport } }>({});
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
      const dataPath = `users/${authContextUser.uid}`;
      dataRef = ref(db, dataPath);
      
      const handleValueChange = (snapshot: any) => {
          if (!snapshot.exists()) {
              setStudents([]); setDailySessions({}); setDailyReports({}); setSurahProgress({});
              setLoading(false);
              return;
          }

          const data = snapshot.val();
          
          let userStudents: Student[] = [];
          if (data.students) {
              userStudents = Object.entries(data.students).map(([id, s]: [string, any]) => ({
                  ...s,
                  id,
                  ownerId: authContextUser.uid,
                  birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
                  registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
                  updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
              }));
          }

          setStudents(userStudents);
          setDailySessions(data.dailySessions || {});
          setDailyReports(data.dailyReports || {});
          setSurahProgress(data.surahProgress || {});
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
  }, [authContextUser, authLoading]);


  const addStudent = (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>) => {
    if (!authContextUser) return;

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
     if (!authContextUser) return;
     newStudents.forEach(s => addStudent(s));
  }

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    if (!authContextUser) return;
    
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
  
  const deleteStudent = (studentId: string) => {
      if (!authContextUser) return;
      const studentRef = ref(db, `users/${authContextUser.uid}/students/${studentId}`);
      remove(studentRef);
  }
  
  const deleteAllStudents = () => {
      if (!authContextUser) return;
      const userStudentsRef = ref(db, `users/${authContextUser.uid}/students`);
      remove(userStudentsRef);
  }

  const addDailySession = (session: DailySession) => {
    if (!authContextUser) return;
    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${session.date}`);
    set(sessionRef, session);
  };
  
  const deleteDailySession = (date: string) => {
    if (!authContextUser) return;
    const sessionRef = ref(db, `users/${authContextUser.uid}/dailySessions/${date}`);
    remove(sessionRef);
  }

  const getSessionForDate = (date: string): DailySession | undefined => {
      return dailySessions ? dailySessions[date] : undefined;
  }

  const getRecordsForDateRange = (startDate: string, endDate: string): Record<string, DailySession> => {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const filteredSessions: Record<string, DailySession> = {};

       Object.entries(dailySessions ?? {}).forEach(([date, session]) => {
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
  
  const saveDailyReport = async (reportData: Omit<DailyReport, 'id'>, imageFile?: File | null) => {
    if (!authContextUser) throw new Error("User not authenticated");
    
    const reportId = Date.now().toString();
    const finalReport: DailyReport = { ...reportData, id: reportId };

    if (imageFile) {
      const imageStorageRef = storageRef(storage, `dailyReports/${finalReport.date}/${reportId}.jpg`);
      const uploadResult = await uploadBytes(imageStorageRef, imageFile);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      finalReport.imageUrl = downloadURL;
    }

    const reportRef = ref(db, `users/${authContextUser.uid}/dailyReports/${finalReport.date}/${reportId}`);
    await set(reportRef, finalReport);
  }
  
 const toggleSurahStatus = (studentId: string, surahId: number) => {
    if (!authContextUser) return;

    const studentProgressList = (surahProgress ? surahProgress[studentId] : []) || [];
    const surahIndex = studentProgressList.indexOf(surahId);

    if (surahIndex > -1) {
        studentProgressList.splice(surahIndex, 1);
    } else {
        studentProgressList.push(surahId);
    }
    
    const surahProgressRef = ref(db, `users/${authContextUser.uid}/surahProgress/${studentId}`);
    set(surahProgressRef, studentProgressList);
    
    updateStudent(studentId, { memorizedSurahsCount: studentProgressList.length });
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
