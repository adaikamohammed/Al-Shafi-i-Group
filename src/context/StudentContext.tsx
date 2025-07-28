
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Student, SessionRecord } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';

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

const getSafeLocalStorage = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') {
        return defaultValue;
    }
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        return defaultValue;
    }
};

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [dailyRecords, setDailyRecords] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const getStorageKey = useCallback((dataType: 'students' | 'records') => {
    if (!user) return null;
    return `${user.uid}_${dataType}`;
  }, [user]);

  useEffect(() => {
    setLoading(authLoading);
    if (!authLoading && user) {
        const studentKey = getStorageKey('students');
        const recordsKey = getStorageKey('records');

        if (studentKey && recordsKey) {
            const storedStudents = getSafeLocalStorage(studentKey, []);
            const storedRecords = getSafeLocalStorage(recordsKey, []);
            
            // Dates are stored as strings in JSON, need to convert them back
            const parsedStudents = storedStudents.map((s: any) => ({
                ...s,
                birthDate: s.birthDate ? new Date(s.birthDate) : undefined,
                registrationDate: s.registrationDate ? new Date(s.registrationDate) : undefined,
                updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
            }));

            setStudents(parsedStudents);
            setDailyRecords(storedRecords);
        }
        setLoading(false);
    } else if (!authLoading && !user) {
        setStudents([]);
        setDailyRecords([]);
        setLoading(false);
    }
  }, [user, authLoading, getStorageKey]);

  useEffect(() => {
    const studentKey = getStorageKey('students');
    if (studentKey) {
        localStorage.setItem(studentKey, JSON.stringify(students));
    }
  }, [students, getStorageKey]);

  useEffect(() => {
    const recordsKey = getStorageKey('records');
    if (recordsKey) {
        localStorage.setItem(recordsKey, JSON.stringify(dailyRecords));
    }
  }, [dailyRecords, getStorageKey]);

  const addStudent = async (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    setStudents(prev => [
        ...prev,
        {
            ...studentData,
            id: new Date().toISOString(), // Simple unique ID
            memorizedSurahsCount: 0,
            updatedAt: new Date(),
        }
    ]);
  };

  const updateStudent = async (studentId: string, updatedData: Partial<Student>) => {
    setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, ...updatedData, updatedAt: new Date() } : s
    ));
  };
  
  const addMultipleDailyRecords = async (newRecords: SessionRecord[]) => {
    if (newRecords.length === 0) return;
    const date = newRecords[0].date;

    // Remove old records for the same day and add new ones
    setDailyRecords(prev => [
        ...prev.filter(r => r.date !== date),
        ...newRecords
    ]);
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
