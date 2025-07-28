
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, SessionRecord, AppUser } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { db, auth } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, Timestamp, onSnapshot, setDoc, where, query, getDoc, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged } from 'firebase/auth';

interface StudentContextType {
  students: Student[];
  dailyRecords: SessionRecord[];
  appUser: AppUser | null;
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
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged is the recommended way to get the current user.
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
            setLoading(true);
            const userDocRef = doc(db, 'users', currentUser.uid);

            const unsubscribeUser = onSnapshot(userDocRef, (userDocSnap) => {
                if (userDocSnap.exists()) {
                    const userData = { uid: currentUser.uid, ...userDocSnap.data() } as AppUser;
                    setAppUser(userData);

                    let studentsQuery;
                    let recordsQuery;

                    if (userData.role === 'إدارة') {
                        studentsQuery = query(collectionGroup(db, 'students'));
                        recordsQuery = query(collectionGroup(db, 'records'));
                    } else {
                        studentsQuery = query(collection(db, 'users', currentUser.uid, 'students'));
                        recordsQuery = query(collection(db, 'users', currentUser.uid, 'records'));
                    }

                    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
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
                        studentsData.sort((a, b) => a.fullName.localeCompare(b.fullName));
                        setStudents(studentsData);
                        setLoading(false);
                    }, (error) => {
                        console.error("Error fetching students:", error);
                        toast({ title: "خطأ", description: "لم نتمكن من تحميل بيانات الطلبة.", variant: "destructive" });
                        setLoading(false);
                    });

                    const unsubscribeRecords = onSnapshot(recordsQuery, (snapshot) => {
                        const recordsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as SessionRecord);
                        setDailyRecords(recordsData);
                    }, (error) => {
                        console.error("Error fetching records:", error);
                        toast({ title: "خطأ", description: "لم نتمكن من تحميل سجلات الحصص.", variant: "destructive" });
                    });
                    
                    // Return cleanup functions for student and record listeners
                    return () => {
                        unsubscribeStudents();
                        unsubscribeRecords();
                    };

                } else {
                    console.error("User document not found!");
                    setAppUser(null);
                    setLoading(false);
                }
            }, (error) => {
                console.error("Error fetching user document:", error);
                setLoading(false);
            });
             return () => unsubscribeUser();
        } else {
            // User is signed out
            setStudents([]);
            setDailyRecords([]);
            setAppUser(null);
            setLoading(false);
        }
    });

    return () => unsubscribeAuth();
  }, [toast]);


  const addStudent = async (studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>) => {
    if (!auth.currentUser) throw new Error("User not logged in");
    const newStudentRef = doc(collection(db, 'users', auth.currentUser.uid, 'students'));
    const newStudent = {
      ...studentData,
      memorizedSurahsCount: 0,
      updatedAt: new Date(),
    };
    await setDoc(newStudentRef, newStudent);
  };

  const updateStudent = async (studentId: string, updatedData: Partial<Student>) => {
    if (!auth.currentUser) throw new Error("User not logged in");
    const studentRef = doc(db, 'users', auth.currentUser.uid, 'students', studentId);
    const finalData = { ...updatedData, updatedAt: new Date() };
    await setDoc(studentRef, finalData, { merge: true });
  };
  
  const addMultipleDailyRecords = async (newRecords: SessionRecord[]) => {
      if (!auth.currentUser) throw new Error("User not logged in");
      if (newRecords.length === 0) return;
      
      const batch = writeBatch(db);
      const recordsCollectionRef = collection(db, 'users', auth.currentUser.uid, 'records');
      
      const date = newRecords[0].date;

      const q = query(recordsCollectionRef, where("date", "==", date));
      const existingRecordsSnap = await getDocs(q);
      existingRecordsSnap.forEach(doc => {
          batch.delete(doc.ref);
      });
      
      newRecords.forEach(record => {
          const recordId = `${record.date}_${record.studentId}`;
          const recordRef = doc(recordsCollectionRef, recordId);
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
    <StudentContext.Provider value={{ students, dailyRecords, appUser, loading, addStudent, updateStudent, addMultipleDailyRecords, getRecordsForDate, getRecordsForDateRange }}>
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
