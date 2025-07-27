"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Student } from '@/lib/types';
import { students as initialStudents } from '@/lib/data';

interface StudentContextType {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  addStudent: (student: Student) => void;
  updateStudent: (studentId: string, updatedData: Partial<Student>) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const [students, setStudents] = useState<Student[]>(initialStudents);

  const addStudent = (student: Student) => {
    setStudents(prevStudents => [...prevStudents, student]);
  };

  const updateStudent = (studentId: string, updatedData: Partial<Student>) => {
    setStudents(prevStudents =>
      prevStudents.map(student =>
        student.id === studentId ? { ...student, ...updatedData } : student
      )
    );
  };

  return (
    <StudentContext.Provider value={{ students, setStudents, addStudent, updateStudent }}>
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
