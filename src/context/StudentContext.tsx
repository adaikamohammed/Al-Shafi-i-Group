
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, SessionRecord } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, Timestamp, onSnapshot, setDoc, where, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface StudentContextType {
  students: Student[];
  dailyRecords: SessionRecord[];
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => Promise<void>;
  updateStudent: (studentId: string, updatedData: Partial<Student>) => Promise<void>;
  addMultipleDailyRecords: (records: SessionRecord[]) => Promise<void>;
  getRecordsForDate: (date: string) => SessionRecord[];
  getRecordsForDateRange: (startDate: string, endDate: string) => SessionRecord[];
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
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
      // Sort students alphabetically by name
      studentsData.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setStudents(studentsData);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching students:", error);
        toast({ title: "خطأ", description: "لم نتمكن من تحميل بيانات الطلبة.", variant: "destructive"});
        setLoading(false);
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
    }, (error) => {
        console.error("Error fetching records:", error);
        toast({ title: "خطأ", description: "لم نتمكن من تحميل سجلات الحصص.", variant: "destructive"});
    });

    return () => {
        unsubscribeStudents();
        unsubscribeRecords();
    }
  }, [user, toast]);

  const addStudent = async (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    if (!user) throw new Error("User not logged in");
    const newStudentRef = doc(collection(db, 'users', user.uid, 'students'));
    const newStudent = {
      ...studentData,
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    await setDoc(newStudentRef, newStudent);
  };

  const updateStudent = async (studentId: string, updatedData: Partial<Student>) => {
    if (!user) throw new Error("User not logged in");
    const studentRef = doc(db, 'users', user.uid, 'students', studentId);
    const finalData = { ...updatedData, updatedAt: new Date() };
    await setDoc(studentRef, finalData, { merge: true });
  };
  
  const addMultipleDailyRecords = async (newRecords: SessionRecord[]) => {
      if (!user) throw new Error("User not logged in");
      if (newRecords.length === 0) return;
      
      const batch = writeBatch(db);
      const recordsCollectionRef = collection(db, 'users', user.uid, 'records');
      
      const date = newRecords[0].date;
      const isHoliday = newRecords.some(r => r.sessionType === 'يوم عطلة');

      // First, delete all existing records for the specific date to avoid duplicates or orphaned data.
      const q = query(recordsCollectionRef, where("date", "==", date));
      const existingRecordsSnap = await getDocs(q);
      existingRecordsSnap.forEach(doc => {
          batch.delete(doc.ref);
      });
      
      // Now, add the new records.
      newRecords.forEach(record => {
          const recordId = `${record.date}_${record.studentId}`;
          const recordRef = doc(recordsCollectionRef, recordId);
          // Convert date objects from student data back to Timestamps for Firestore
          const a = record as any;
          if (a.birthDate) a.birthDate = Timestamp.fromDate(a.birthDate);
          if (a.registrationDate) a.registrationDate = Timestamp.fromDate(a.registrationDate);
          batch.set(recordRef, a);
      });
      
      await batch.commit();
  };

  const getRecordsForDate = (date: string): SessionRecord[] => {
      return dailyRecords.filter(r => r.date === date);
  }

  const getRecordsForDateRange = (startDate: string, endDate: string): SessionRecord[] => {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return dailyRecords.filter(r => {
        try {
            if (!r.date || typeof r.date !== 'string') return false;
            return isWithinInterval(parseISO(r.date), { start, end })
        } catch (e) {
            console.warn(`Invalid date found in records: ${r.date}`);
            return false;
        }
      });
  }

  return (
    <StudentContext.Provider value={{ students, dailyRecords, loading, addStudent, updateStudent, addMultipleDailyRecords, getRecordsForDate, getRecordsForDateRange }}>
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
