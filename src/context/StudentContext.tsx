
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, SessionRecord } from '@/lib/types';
import { isWithinInterval, parseISO, format } from 'date-fns';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Helper functions to interact with localStorage
const getLocalStorage = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  const storedValue = localStorage.getItem(key);
  return storedValue ? JSON.parse(storedValue) : defaultValue;
};

const setLocalStorage = (key: string, value: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
};


interface StudentContextType {
  students: Student[];
  dailyRecords: SessionRecord[];
  loading: boolean;
  addStudent: (student: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student>) => void;
  deleteStudent: (studentId: string) => void;
  addMultipleDailyRecords: (records: SessionRecord[]) => void;
  getRecordsForDate: (date: string) => SessionRecord[];
  getRecordsForDateRange: (startDate: string, endDate: string) => SessionRecord[];
  importStudents: (newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>[]) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [dailyRecords, setDailyRecords] = useState<SessionRecord[]>([]);
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
        const storedRecords = getLocalStorage(`dailyRecords_${user.uid}`, []);
        setStudents(storedStudents);
        setDailyRecords(storedRecords);
      } else {
        // Clear data if user logs out
        setStudents([]);
        setDailyRecords([]);
      }
      setLoading(false);
    }
  }, [user, authLoading]);
  
  // Save students to localStorage whenever they change
  useEffect(() => {
    if (user) {
      setLocalStorage(`students_${user.uid}`, students);
    }
  }, [students, user]);

  // Save records to localStorage whenever they change
  useEffect(() => {
    if (user) {
      setLocalStorage(`dailyRecords_${user.uid}`, dailyRecords);
    }
  }, [dailyRecords, user]);


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

  const addMultipleDailyRecords = (newRecords: SessionRecord[]) => {
    if (newRecords.length === 0) return;
    const date = newRecords[0].date;
    
    // Remove old records for the same date to avoid duplicates
    const otherDateRecords = dailyRecords.filter(r => r.date !== date);

    setDailyRecords([...otherDateRecords, ...newRecords]);
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
    <StudentContext.Provider value={{ students, dailyRecords, loading, addStudent, updateStudent, deleteStudent, addMultipleDailyRecords, getRecordsForDate, getRecordsForDateRange, importStudents }}>
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
