
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, SessionRecord } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, Timestamp, onSnapshot, setDoc } from 'firebase/firestore';

interface StudentContextType {
  students: Student[];
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => Promise<void>;
  updateStudent: (studentId: string, updatedData: Partial<Student>) => Promise<void>;
  dailyRecords: SessionRecord[];
  addMultipleDailyRecords: (records: SessionRecord[]) => Promise<void>;
  getRecordsForDate: (date: string) => SessionRecord[];
  getRecordsForDateRange: (startDate: string, endDate: string) => SessionRecord[];
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [dailyRecords, setDailyRecords] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStudents([]);
      setDailyRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const studentsCollectionRef = collection(db, 'users', user.uid, 'students');
    const recordsCollectionRef = collection(db, 'users', user.uid, 'records');

    const unsubscribeStudents = onSnapshot(studentsCollectionRef, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            birthDate: (data.birthDate as Timestamp)?.toDate(),
            registrationDate: (data.registrationDate as Timestamp)?.toDate(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate(),
          } as Student;
      });
      setStudents(studentsData);
    });
    
    const unsubscribeRecords = onSnapshot(recordsCollectionRef, (snapshot) => {
        const recordsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
            } as SessionRecord;
        });
        setDailyRecords(recordsData);
    });

    setLoading(false);

    return () => {
        unsubscribeStudents();
        unsubscribeRecords();
    }
  }, [user]);

  const addStudent = async (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    if (!user) return;
    const newStudentRef = doc(collection(db, 'users', user.uid, 'students'));
    const newStudent: Student = {
      ...studentData,
      id: newStudentRef.id,
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    await setDoc(newStudentRef, newStudent);
  };

  const updateStudent = async (studentId: string, updatedData: Partial<Student>) => {
    if (!user) return;
    const studentRef = doc(db, 'users', user.uid, 'students', studentId);
    await setDoc(studentRef, { ...updatedData, updatedAt: new Date() }, { merge: true });
  };
  
  const addMultipleDailyRecords = async (newRecords: SessionRecord[]) => {
      if (!user) return;
      const batch = writeBatch(db);
      const recordsCollectionRef = collection(db, 'users', user.uid, 'records');

      newRecords.forEach(record => {
          const recordId = `${record.date}_${record.studentId}`;
          const recordRef = doc(recordsCollectionRef, recordId);
          batch.set(recordRef, record);
      });
      await batch.commit();
  };

  const getRecordsForDate = (date: string) => {
      return dailyRecords.filter(r => r.date === date);
  }

  const getRecordsForDateRange = (startDate: string, endDate: string) => {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return dailyRecords.filter(r => isWithinInterval(parseISO(r.date), { start, end }));
  }

  return (
    <StudentContext.Provider value={{ students, addStudent, updateStudent, dailyRecords, addMultipleDailyRecords, getRecordsForDate, getRecordsForDateRange }}>
      {loading ? (
        <div className="flex items-center justify-center h-screen">Loading data...</div>
      ) : (
        children
      )}
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
