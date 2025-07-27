"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Student, SessionRecord } from '@/lib/types';
import { students as initialStudents } from '@/lib/data';
import { isWithinInterval, parseISO } from 'date-fns';

interface StudentContextType {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  addStudent: (student: Student) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student>) => void;
  dailyRecords: SessionRecord[];
  addOrUpdateDailyRecord: (record: SessionRecord) => void;
  addMultipleDailyRecords: (records: SessionRecord[]) => void;
  getRecordsForDate: (date: string) => SessionRecord[];
  getRecordsForDateRange: (startDate: string, endDate: string) => SessionRecord[];
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [dailyRecords, setDailyRecords] = useState<SessionRecord[]>([]);

  const addStudent = (student: Student) => {
    setStudents(prevStudents => [...prevStudents, student]);
  };

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    setStudents(prevStudents =>
      prevStudents.map(student =>
        student.id === studentId ? { ...student, ...updatedData, updatedAt: new Date() } : student
      )
    );
  };
  
  const addOrUpdateDailyRecord = (newRecord: SessionRecord) => {
    setDailyRecords(prevRecords => {
        const recordIndex = prevRecords.findIndex(r => r.date === newRecord.date && r.studentId === newRecord.studentId);
        if (recordIndex > -1) {
            const updatedRecords = [...prevRecords];
            updatedRecords[recordIndex] = newRecord;
            return updatedRecords;
        } else {
            return [...prevRecords, newRecord];
        }
    });
  };

  const addMultipleDailyRecords = (newRecords: SessionRecord[]) => {
      setDailyRecords(prevRecords => {
          const recordsMap = new Map(prevRecords.map(r => {
              const key = r.studentId === 'holiday' ? r.date : `${r.date}-${r.studentId}`;
              return [key, r];
          }));
          
          newRecords.forEach(nr => {
              // If we are adding a holiday, remove all other records for that day.
              if (nr.sessionType === 'يوم عطلة' && nr.studentId === 'holiday') {
                  recordsMap.forEach((val, key) => {
                      if (key.startsWith(nr.date)) {
                          recordsMap.delete(key);
                      }
                  });
                   recordsMap.set(nr.date, nr);
              } 
              // If we are adding a normal session, ensure no holiday record exists for that day.
              else if (nr.sessionType !== 'يوم عطلة') {
                   if (recordsMap.has(nr.date)) {
                       recordsMap.delete(nr.date);
                   }
                   recordsMap.set(`${nr.date}-${nr.studentId}`, nr);
              }
          });

          return Array.from(recordsMap.values());
      });
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
    <StudentContext.Provider value={{ students, setStudents, addStudent, updateStudent, dailyRecords, addOrUpdateDailyRecord, addMultipleDailyRecords, getRecordsForDate, getRecordsForDateRange }}>
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
