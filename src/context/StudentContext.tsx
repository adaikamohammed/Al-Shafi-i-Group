
"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Student, SessionRecord } from '@/lib/types';
import { isWithinInterval, parseISO } from 'date-fns';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, Timestamp, onSnapshot, setDoc, where, query, getDoc, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

// This type is now defined here and shared with AuthContext
export interface AppUser {
    uid: string;
    name: string;
    email: string | null;
    photoURL?: string | null;
    createdAt: any;
    role: 'شيخ' | 'إدارة';
}

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
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [dailyRecords, setDailyRecords] = useState<SessionRecord[]>([]);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We start loading whenever auth state changes
    setLoading(true);

    if (authLoading) {
      // If auth is loading, we are definitely loading.
      return;
    }

    if (!user) {
      // If no user, clear data and stop loading.
      setStudents([]);
      setDailyRecords([]);
      setAppUser(null);
      setLoading(false);
      return;
    }

    // Auth is done and we have a user. Now, let's fetch user's role.
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribes: (() => void)[] = [];

    getDoc(userDocRef).then(userDocSnap => {
        if (!userDocSnap.exists()) {
            console.error("User document not found!");
            setLoading(false);
            return;
        }

        const currentUser = userDocSnap.data() as AppUser;
        setAppUser(currentUser);
        
        let studentsQuery;
        let recordsQuery;

        if (currentUser.role === 'إدارة') {
            // Admin can see all students and records
            // Note: This requires Firestore index configuration.
            // collectionGroup('students') and collectionGroup('records')
            // For now, let's show a message on the relevant pages.
            // We will load no data for admin to prevent errors until UI is ready.
             studentsQuery = query(collectionGroup(db, 'students'));
             recordsQuery = query(collectionGroup(db, 'records'));
        } else {
            // Teacher sees their own data
            studentsQuery = query(collection(db, 'users', user.uid, 'students'));
            recordsQuery = query(collection(db, 'users', user.uid, 'records'));
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
            setLoading(false); // Stop loading only after the first successful fetch
        }, (error) => {
            console.error("Error fetching students:", error);
            toast({ title: "خطأ", description: "لم نتمكن من تحميل بيانات الطلبة.", variant: "destructive"});
            setLoading(false);
        });

        const unsubscribeRecords = onSnapshot(recordsQuery, (snapshot) => {
            const recordsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as SessionRecord);
            setDailyRecords(recordsData);
        }, (error) => {
            console.error("Error fetching records:", error);
            toast({ title: "خطأ", description: "لم نتمكن من تحميل سجلات الحصص.", variant: "destructive"});
        });

        unsubscribes.push(unsubscribeStudents, unsubscribeRecords);

    }).catch(error => {
        console.error("Error fetching user role:", error);
        toast({ title: "خطأ", description: "لم نتمكن من تحديد صلاحيات المستخدم.", variant: "destructive"});
        setLoading(false);
    });

    return () => {
        unsubscribes.forEach(unsub => unsub());
    }
  }, [user, authLoading, toast]);


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
    // For admins, the path would be different. This needs more logic for admin role.
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
