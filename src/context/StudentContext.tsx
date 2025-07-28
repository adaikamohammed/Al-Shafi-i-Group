
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, SessionRecord, AppUser } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';


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
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [dailyRecords, setDailyRecords] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(authLoading);
    if (authLoading || !user) {
        setStudents([]);
        setDailyRecords([]);
        setLoading(false);
        return;
    }
    
    const studentsRef = ref(db, `students/${user.uid}`);
    const recordsRef = ref(db, `sessions/${user.uid}`);

    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
        const data = snapshot.val();
        const studentsList: Student[] = data 
            ? Object.entries(data).map(([id, studentData]: [string, any]) => ({
                ...studentData,
                id,
                birthDate: studentData.birthDate ? new Date(studentData.birthDate) : new Date(),
                registrationDate: studentData.registrationDate ? new Date(studentData.registrationDate) : new Date(),
                updatedAt: studentData.updatedAt ? new Date(studentData.updatedAt) : new Date(),
            })) 
            : [];
        setStudents(studentsList);
        setLoading(false);
    }, (error) => {
        console.error("Firebase student read failed: ", error);
        setLoading(false);
    });

    const unsubscribeRecords = onValue(recordsRef, (snapshot) => {
        const data = snapshot.val();
        const recordsList: SessionRecord[] = [];
        if (data) {
            Object.entries(data).forEach(([date, dateRecords]: [string, any]) => {
                Object.values(dateRecords as object).forEach((record: any) => {
                    recordsList.push({ ...record, date });
                });
            });
        }
        setDailyRecords(recordsList);
    }, (error) => {
        console.error("Firebase session read failed: ", error);
    });

    return () => {
        unsubscribeStudents();
        unsubscribeRecords();
    };

  }, [user, authLoading]);


  const addStudent = async (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    if (!user) throw new Error("User not authenticated");
    const newStudentId = uuidv4();
    const newStudentData = {
      ...studentData,
      id: newStudentId,
      memorizedSurahsCount: 0,
      updatedAt: new Date().toISOString(),
      birthDate: studentData.birthDate.toISOString(),
      registrationDate: studentData.registrationDate.toISOString(),
    };
    const studentRef = ref(db, `students/${user.uid}/${newStudentId}`);
    await set(studentRef, newStudentData);
  };

  const updateStudent = async (studentId: string, updatedData: Partial<Student>) => {
    if (!user) throw new Error("User not authenticated");
    
    const studentRef = ref(db, `students/${user.uid}/${studentId}`);
    
    const existingStudent = students.find(s => s.id === studentId);
    if (!existingStudent) throw new Error("Student not found");

    const dataToUpdate = {
        ...existingStudent,
        ...updatedData,
        updatedAt: new Date().toISOString(),
        birthDate: (updatedData.birthDate || existingStudent.birthDate).toISOString(),
        registrationDate: (updatedData.registrationDate || existingStudent.registrationDate).toISOString(),
    };

    await set(studentRef, dataToUpdate);
  };
  
  const addMultipleDailyRecords = async (newRecords: SessionRecord[]) => {
    if (!user) throw new Error("User not authenticated");
    if (newRecords.length === 0) return;

    const updates: { [key: string]: any } = {};
    const date = newRecords[0].date;
    const recordsForDate: { [key: string]: any } = {};

    newRecords.forEach(record => {
      const recordId = record.studentId === 'holiday' ? 'holiday_record' : record.studentId;
      const recordToSave = { ...record };
      delete (recordToSave as Partial<SessionRecord>).date; 
      recordsForDate[recordId] = recordToSave;
    });

    const dateRecordsRef = ref(db, `sessions/${user.uid}/${date}`);
    await set(dateRecordsRef, recordsForDate);
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

    
